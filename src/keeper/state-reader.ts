// The state rotation: 12 reads of the game a second, by the catalog, never two in flight, property reads only. The keys
// and the cursor live here, outside the game (FR-001, FR-002). Slices are never logged (FR-007).
import {
  ACTIONS_GROUP,
  CATALOG,
  CHARACTER_ROW,
  groupOf,
  isObject,
} from "../shared/index.ts";
import type {
  CatalogRow,
  StateClass,
  StatePath,
  StateSlice,
} from "../shared/index.ts";
import type { Cdp } from "./cdp.ts";
import type { EngineRef } from "./engine-ref.ts";
import type { VarsReader } from "./vars-reader.ts";

const VARS_PATH: StatePath = ["_vars"];
const MAX_SLICE_BYTES = 25_000;
const UNREAD_CHARACTER_BYTES = 25_000;
const UNREAD_BYTES = 2_000;
const FAILS_BEFORE_WARNING = 10;

/** The actions slice has its own slots; the rest of the fast reading is `fast`. */
type Lane = "actions" | StateClass;
/** One second of slots (research R3): 3 for the actions slice, 7 for the other fast slices, 2 for the slow reading. */
const SLOTS: readonly Lane[] = [
  "actions",
  "fast",
  "slow",
  "fast",
  "actions",
  "fast",
  "fast",
  "fast",
  "actions",
  "fast",
  "slow",
  "fast",
];
/** The first lap of a character takes every slot, in this order (research R9). */
const FIRST_LAP: readonly Lane[] = ["actions", "fast", "slow"];
/** Where a slot goes when its lane has nothing to read. */
const SPARE_SLOT: readonly Lane[] = ["fast", "actions", "slow"];

export interface PlanPiece {
  path: StatePath;
  /** Measured at the last read; `null` before the first one. */
  bytes: number | null;
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
export function inTurn(): <T>(f: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(f: () => Promise<T>) => {
    const run = tail.then(f);
    tail = run.catch(() => undefined);
    return run;
  };
}

type Sentinel = StateSlice["sentinel"] & { char: string };

/** One lane's place in the rotation. */
interface Queue {
  /** In the catalog's order of groups, so the pieces of a group stay side by side (FR-018). */
  paths: StatePath[];
  groups: PlanPiece[][];
  next: number;
  /** Read whole since the keys were listed; a lane with nothing to read starts done. */
  done: boolean;
  /** Read whole since `cycles.fast` last rose or the map changed. */
  passed: boolean;
}
type Plan = Record<Lane, Queue>;

/** The sentinel of an answer, `null` with no character (there may be no map then); a bad one fails the read. */
function sentinelOf(v: Record<string, unknown>): Sentinel | null {
  if (v.char === null) return null;
  if (typeof v.char !== "string" || typeof v.map !== "number")
    throw new Error("bad sentinel");
  return { char: v.char, map: v.map };
}

const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

/** A callback that throws is the caller's problem: it never stops a reader. */
export function safely(f: () => void): void {
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
  turn: ReturnType<typeof inTurn>;
  onSlice: (s: StateSlice) => void;
  onFailing: () => void;
  vars?: VarsReader;
  everyMs?: number;
  catalog?: readonly CatalogRow[];
}): { stop(): Promise<void> } {
  let stopped = false;
  let busy: Promise<void> | null = null;
  let fails = 0;
  let slot = 0;
  let firstLap = true;
  let plan: Plan | null = null;
  let last: Sentinel | null = null;
  let cycles = { fast: 0, all: 0 };
  const measured = new Map<string, number>();
  const rows = deps.catalog ?? CATALOG;
  const groupNames = [...new Set(rows.map((r) => r.group))];
  const characterSubkeys = rows
    .filter((r) => r.reading === "rápida" && r.name.startsWith(CHARACTER_ROW))
    .map((r) => r.name.slice(CHARACTER_ROW.length));

  /** A `slow` pass starts with the `_vars`, in a slot of their own. */
  const queue = (paths: StatePath[], lane: Lane): Queue => {
    const groups = pack(
      paths.map((path) => ({
        path,
        bytes: measured.get(JSON.stringify(path)) ?? null,
      })),
      MAX_SLICE_BYTES,
    );
    if (deps.vars && lane === "slow")
      groups.unshift([{ path: VARS_PATH, bytes: null }]);
    return {
      paths,
      groups,
      next: 0,
      done: groups.length === 0,
      passed: false,
    };
  };

  /** Rotation counts follow the sentinel: a new character starts over, a new map discards the partial pass of the fast reading. */
  function observe(now: Sentinel | null): void {
    if (now?.char !== last?.char) {
      cycles = { fast: 0, all: 0 };
      plan = null;
      firstLap = true;
    } else if (now?.map !== last?.map) {
      cycles = { ...cycles, fast: 0 };
      if (plan)
        for (const q of [plan.actions, plan.fast]) {
          q.next = 0;
          q.passed = false;
        }
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
    fails = 0;
    observe(now);
    if (!now) return;
    const listed: StatePath[] = [
      ...top.map((k): StatePath => [k]),
      ...children.flatMap(([k, kids]) =>
        (kids as string[]).map((c): StatePath => [k, c]),
      ),
    ];
    const hasCharacter = listed.some(
      ([k, c]) => k === "PlayerDATABASE" && c === now.char,
    );
    const tagged = [
      ...listed,
      ...(hasCharacter ? characterSubkeys : []).map((x): StatePath => [
        "PlayerDATABASE",
        now.char,
        x,
      ]),
    ].map((path) => ({ path, group: groupOf(rows, path, now.char) }));
    const inOrder = (keep: (group: string) => boolean) =>
      groupNames
        .filter(keep)
        .flatMap((g) => tagged.filter((t) => t.group === g).map((t) => t.path));
    const slow = tagged.filter((t) => t.group === null).map((t) => t.path);
    // One pack per lane, not per group: with 35 groups, a pass of the fast lane would take about 5 s (R2, R3).
    if (tagged.length > 0)
      plan = {
        actions: queue(
          inOrder((g) => g === ACTIONS_GROUP),
          "actions",
        ),
        fast: queue(
          inOrder((g) => g !== ACTIONS_GROUP),
          "fast",
        ),
        slow: queue(slow, "slow"),
      };
  }

  /** A pass of the fast reading is both of its lanes read whole; a lane with nothing to read never holds it back. */
  const passed = (q: Queue) => q.passed || q.groups.length === 0;

  /** The slice's pieces are read: moves the cursor and raises the counts when a pass of the lane ends. */
  function advance(p: Plan, lane: Lane): void {
    if (!firstLap) slot++;
    const q = p[lane];
    q.next++;
    if (q.next < q.groups.length) return;
    p[lane] = { ...queue(q.paths, lane), done: true, passed: true };
    if (lane !== "slow" && passed(p.actions) && passed(p.fast)) {
      cycles = { ...cycles, fast: cycles.fast + 1 };
      p.actions.passed = false;
      p.fast.passed = false;
    }
    if (p.actions.done && p.fast.done && p.slow.done) {
      cycles = { ...cycles, all: cycles.all + 1 };
      plan = null; // the next slot lists the keys again
      firstLap = false;
    }
  }

  function laneNow(p: Plan): Lane {
    if (firstLap) return FIRST_LAP.find((l) => !p[l].done) ?? "slow";
    const wanted = SLOTS[slot % SLOTS.length] ?? "fast";
    return (
      [wanted, ...SPARE_SLOT].find((l) => p[l].groups.length > 0) ?? "slow"
    );
  }

  async function readSlice(ref: EngineRef, p: Plan): Promise<void> {
    const lane = laneNow(p);
    const q = p[lane];
    const paths = (q.groups[q.next] ?? []).map((x) => x.path);
    const isVars = paths[0] === VARS_PATH;
    const reads = isVars ? [] : paths;
    const v = await evaluate(ref, deps.sliceSource, reads); // with no reads, it answers only the sentinel
    const now = sentinelOf(v);
    if (!Array.isArray(v.out) || v.out.length !== reads.length)
      throw new Error("bad slice");
    const values = isVars
      ? [(now && (await deps.vars?.read(ref, () => stopped))) ?? {}]
      : (v.out as unknown[]);
    if (stopped) return;
    fails = 0;
    paths.forEach((path, i) => {
      measured.set(JSON.stringify(path), JSON.stringify(values[i]).length);
    });
    advance(p, lane);
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
  }, deps.everyMs ?? 83);

  return {
    /** Resolves after the read in flight, if any, and the release of the `_vars`; no read starts after this. */
    async stop() {
      stopped = true;
      clearInterval(timer);
      await busy;
      await deps.vars?.release(deps.engine());
    },
  };
}
