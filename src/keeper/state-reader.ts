// The state rotation: one read of the game every 250 ms, never two in flight, property reads only. The keys and the
// cursor live here, outside the game (FR-001, FR-002). Slices are never logged (FR-007).
import { classOf, isObject } from "../shared/index.ts";
import type { StateClass, StatePath, StateSlice } from "../shared/index.ts";
import type { Cdp } from "./cdp.ts";
import type { EngineRef } from "./engine-ref.ts";

const MAX_SLICE_BYTES = 25_000;
const UNREAD_CHARACTER_BYTES = 25_000;
const UNREAD_BYTES = 2_000;
/** Of every 4 slices, 3 are `formula` and the last one is `other` (research R2). */
const SLOTS_PER_OTHER = 4;
const FAILS_BEFORE_WARNING = 10;

export interface PlanPiece {
  path: StatePath;
  /** Measured at the last read; `null` before the first one. */
  bytes: number | null;
}

/** Not read yet: the `_vars` join the rotation in T016. */
export interface VarsReader {
  read(ref: EngineRef): Promise<Record<string, unknown> | null>;
  release(ref: EngineRef | null): Promise<void>;
}

export function pieceBytes(p: PlanPiece): number {
  if (p.bytes !== null) return p.bytes;
  return p.path[0] === "PlayerDATABASE" && p.path.length === 2
    ? UNREAD_CHARACTER_BYTES
    : UNREAD_BYTES;
}

/** Groups in order, up to `maxBytes` each, except a larger piece, which goes alone. */
export function pack(pieces: PlanPiece[], maxBytes: number): PlanPiece[][] {
  const groups: PlanPiece[][] = [];
  let group: PlanPiece[] = [];
  let size = 0;
  for (const p of pieces) {
    const bytes = pieceBytes(p);
    if (group.length > 0 && size + bytes > maxBytes) {
      groups.push(group);
      group = [];
      size = 0;
    }
    group.push(p);
    size += bytes;
  }
  if (group.length > 0) groups.push(group);
  return groups;
}

/** Runs what it is given one at a time, in order; a rejection goes to its caller and does not stop the next one. */
export function oneAtATime(): <T>(f: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(f: () => Promise<T>) => {
    const run = tail.then(f);
    tail = run.catch(() => undefined);
    return run;
  };
}

type Sentinel = StateSlice["sentinel"] & { char: string };

/** One class's place in the rotation. */
interface Queue {
  paths: StatePath[];
  groups: PlanPiece[][];
  next: number;
  /** Read whole since the keys were listed; a class with nothing to read starts done. */
  done: boolean;
}
type Plan = Record<StateClass, Queue>;

/** The sentinel of an answer, `null` with no character (there may be no map then); a bad one fails the read. */
function sentinelOf(v: Record<string, unknown>): Sentinel | null {
  if (v.char === null) return null;
  if (typeof v.char !== "string" || typeof v.map !== "number")
    throw new Error("bad sentinel");
  return { char: v.char, map: v.map };
}

const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

/** A callback that throws is the caller's problem: it never stops the rotation. */
function safely(f: () => void): void {
  try {
    f();
  } catch {
    // ignored on purpose
  }
}

export function startStateReader(deps: {
  send: Cdp["send"];
  engine: () => EngineRef | null;
  listSource: string;
  sliceSource: string;
  turn: ReturnType<typeof oneAtATime>;
  onSlice: (s: StateSlice) => void;
  onFailing: () => void;
  vars?: VarsReader;
  everyMs?: number;
}): { stop(): Promise<void> } {
  let stopped = false;
  let busy: Promise<void> | null = null;
  let fails = 0;
  let slot = 0;
  let plan: Plan | null = null;
  let last: Sentinel | null = null;
  let cycles = { formula: 0, all: 0 };
  const measured = new Map<string, number>();

  const queue = (paths: StatePath[]): Queue => ({
    paths,
    groups: pack(
      paths.map((path) => ({
        path,
        bytes: measured.get(JSON.stringify(path)) ?? null,
      })),
      MAX_SLICE_BYTES,
    ),
    next: 0,
    done: paths.length === 0,
  });

  /** Rotation counts follow the sentinel: a new character starts over, a new map discards the partial `formula` pass. */
  function observe(now: Sentinel | null): void {
    if (now?.char !== last?.char) {
      cycles = { formula: 0, all: 0 };
      plan = null;
    } else if (now?.map !== last?.map) {
      cycles = { ...cycles, formula: 0 };
      if (plan) plan.formula.next = 0;
    }
    last = now;
  }

  async function evaluate(
    ref: EngineRef,
    source: string,
    paths?: StatePath[],
  ): Promise<Record<string, unknown>> {
    const answer = (await deps.send(
      "Runtime.callFunctionOn",
      {
        objectId: ref.objectId,
        functionDeclaration: source,
        returnByValue: true,
        ...(paths ? { arguments: [{ value: paths }] } : {}),
      },
      ref.sessionId,
    )) as { result?: { value?: unknown }; exceptionDetails?: unknown };
    const value = answer.result?.value;
    if (answer.exceptionDetails !== undefined || !isObject(value))
      throw new Error("the read failed");
    return value;
  }

  async function readList(ref: EngineRef): Promise<void> {
    const v = await evaluate(ref, deps.listSource);
    const now = sentinelOf(v);
    const { top, split } = v;
    if (!isStrings(top) || !isObject(split))
      throw new Error("bad list of keys");
    const children = Object.entries(split);
    if (!children.every(([, kids]) => isStrings(kids)))
      throw new Error("bad list of keys");
    if (stopped) return;
    fails = 0;
    observe(now);
    if (!now) return;
    const paths: StatePath[] = [
      ...top.map((k): StatePath => [k]),
      ...children.flatMap(([k, kids]) =>
        (kids as string[]).map((c): StatePath => [k, c]),
      ),
    ];
    const of = (cls: StateClass) =>
      queue(paths.filter((p) => classOf(p, now.char) === cls));
    if (paths.length > 0) plan = { formula: of("formula"), other: of("other") };
  }

  /** The slice's pieces are read: moves the cursor and raises the counts when a pass of the class ends. */
  function advance(p: Plan, cls: StateClass): void {
    slot++;
    const q = p[cls];
    q.next++;
    if (q.next < q.groups.length) return;
    p[cls] = { ...queue(q.paths), done: true };
    if (cls === "formula") cycles = { ...cycles, formula: cycles.formula + 1 };
    if (p.formula.done && p.other.done) {
      cycles = { ...cycles, all: cycles.all + 1 };
      plan = null; // the next slot lists the keys again
    }
  }

  async function readSlice(ref: EngineRef, p: Plan): Promise<void> {
    const wanted: StateClass =
      slot % SLOTS_PER_OTHER === SLOTS_PER_OTHER - 1 ? "other" : "formula";
    const cls: StateClass =
      p[wanted].groups.length > 0
        ? wanted
        : wanted === "formula"
          ? "other"
          : "formula";
    const q = p[cls];
    const paths = (q.groups[q.next] ?? []).map((x) => x.path);
    const v = await evaluate(ref, deps.sliceSource, paths);
    const now = sentinelOf(v);
    if (!Array.isArray(v.out) || v.out.length !== paths.length)
      throw new Error("bad slice");
    const values = v.out as unknown[];
    if (stopped) return;
    fails = 0;
    paths.forEach((path, i) => {
      measured.set(JSON.stringify(path), JSON.stringify(values[i]).length);
    });
    advance(p, cls);
    observe(now);
    if (!now) return;
    const slice: StateSlice = {
      sentinel: { char: now.char, map: now.map },
      pieces: paths.map((path, i) => ({ path, value: values[i] })),
      at: Date.now(),
      cycles,
    };
    safely(() => {
      deps.onSlice(slice);
    });
  }

  /** One slot: asks for the engine only now, as the wait for the turn may have outlived it. */
  async function read(): Promise<void> {
    if (stopped) return;
    const ref = deps.engine();
    if (!ref) return;
    if (plan) await readSlice(ref, plan);
    else await readList(ref);
  }

  /** The cursor did not move, so the next slot reads the same pieces: no pass counts with a piece missing. */
  function failed(): void {
    if (stopped) return;
    fails++;
    if (fails === FAILS_BEFORE_WARNING)
      safely(() => {
        deps.onFailing();
      });
  }

  // A slot that finds a read in flight (or waiting for its turn) is skipped.
  const timer = setInterval(() => {
    if (busy) return;
    busy = deps
      .turn(read)
      .catch(failed)
      .finally(() => {
        busy = null;
      });
  }, deps.everyMs ?? 250);

  return {
    /** Resolves after the read in flight, if any; none starts after this. */
    stop() {
      stopped = true;
      clearInterval(timer);
      return busy ?? Promise.resolve();
    },
  };
}
