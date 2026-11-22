// The helpers of the real-trees run (spec 010, FR-026, NFR-003, contracts/real-trees-run.md): `just trees` and
// `just draft` over the real game, only on Vinicius's PC, one process. The run is real-trees.integration.test.ts; here
// is what CI can test over the invented game: the variables, the target, the plan, the probe of the roots and the
// summary. Every output goes to TREES_OUT, outside the repository, and carries no character's name.
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { Op } from "../instrument.ts";
import type { Recording, RoutineRun } from "../recording.ts";
import type { RootCall } from "../tree-record.ts";
import { answerKey } from "./answer-key.ts";
import type { AnswerKey, PoolKind } from "./answer-key.ts";
import type { Blueprint, BlueprintStage, RoutineStep } from "./blueprint.ts";
import { callArgs, refKey } from "./refs.ts";

export type TreesMode = "check" | "draft" | "roots";
const MODES: readonly string[] = ["check", "draft", "roots"];
/** The justfile's own rule for a target. */
const TARGET = /^[a-z0-9-]{1,80}$/;
const LOTS = ["w1", "w2", "w3", "w4", "w5", "w6", "w7", "character", "account"];

/**
 * The run's variables, or null when one of the three paths or the target is missing: the integration test skips
 * (`just test` runs it too). A target or a mode outside the rules is an error, never a skip.
 */
export function treesEnv(env: NodeJS.ProcessEnv): {
  gameDir: string;
  snapshot: string;
  out: string;
  target: string;
  mode: TreesMode;
} | null {
  const gameDir = env.TREES_GAME_DIR ?? "";
  const snapshot = env.TREES_SNAPSHOT ?? "";
  const out = env.TREES_OUT ?? "";
  const target = env.TREES_TARGET ?? "";
  const mode = env.TREES_MODE ?? "";
  if (!gameDir || !snapshot || !out || !target || !mode) return null;
  if (!TARGET.test(target))
    throw new Error("TREES_TARGET fora da regra: um id, um lote, all ou roots");
  if (!MODES.includes(mode))
    throw new Error("TREES_MODE é check, draft ou roots");
  return { gameDir, snapshot, out, target, mode: mode as TreesMode };
}

/** The target's ids, in the catalog's order: a lot, all (or roots: every tree number) or one id of the catalog. */
export function targetIds(
  target: string,
  catalog: readonly { id: string; lot: string }[],
): string[] {
  if (target === "all" || target === "roots") return catalog.map((n) => n.id);
  if (LOTS.includes(target))
    return catalog.filter((n) => n.lot === target).map((n) => n.id);
  if (!catalog.some((n) => n.id === target))
    throw new Error(`alvo fora do catálogo: ${target}`);
  return [target];
}

/** A path inside TREES_OUT; anything that would fall outside it is refused. */
export function outPath(out: string, ...parts: string[]): string {
  const base = resolve(out);
  const p = resolve(base, ...parts);
  const rel = relative(base, p);
  if (
    rel === "" ||
    rel === ".." ||
    rel.startsWith(`..${sep}`) ||
    isAbsolute(rel)
  )
    throw new Error("saída fora de TREES_OUT");
  return p;
}

/** The check mode locks only the complete blueprints; a sketch or a draft counts as no blueprint written. */
export function checkPlan(
  ids: readonly string[],
  stages: ReadonlyMap<string, BlueprintStage>,
): { lock: string[]; notWritten: string[] } {
  const lock = ids.filter((id) => stages.get(id) === "complete");
  return { lock, notWritten: ids.filter((id) => !lock.includes(id)) };
}

/** The root's call (a root of one call), with `{character}` in its arguments resolved. */
export function rootCallOf(bp: Blueprint, character = 0): RootCall {
  const { ref } = bp.root;
  if (!ref) throw new Error(`a raiz de ${bp.id} é uma soma de chamadas`);
  return [ref.call, callArgs(ref, character)];
}

/** Every call the root records: its one call, each call of a sum in order, or none for a routine's root. */
export const rootCallsOf = (bp: Blueprint, character = 0): RootCall[] =>
  bp.root.routine
    ? []
    : bp.root.calls
      ? bp.root.calls.map((c) => [c.call, callArgs(c, character)] as const)
      : [rootCallOf(bp, character)];

/** A routine's steps in order: one step, or a list of them. */
const stepsOf = (
  r: RoutineStep | readonly RoutineStep[],
): readonly RoutineStep[] => ("length" in r ? r : [r]);

/** The root's routine as the recorder runs it, step by step (block calls, or a helper actor's events). */
export function routineStepOf(
  bp: Blueprint,
  character = 0,
): RoutineRun[] | undefined {
  const r = bp.root.routine;
  if (!r) return undefined;
  return stepsOf(r).map((s): RoutineRun =>
    "call" in s
      ? { block: s.call, args: callArgs(s, character) }
      : {
          slot: s.slot,
          behavior: s.behavior,
          event: s.event,
          args: [...(s.args ?? [])],
          ...(s.set ? { set: s.set } : {}),
        },
  );
}

/** The recorder's copy of the state with the root's marker set on it (never the save, never the running app). */
export function mosaicWith(
  mosaic: string,
  scratch: Readonly<Record<string, string | number>> | undefined,
): string {
  if (!scratch) return mosaic;
  const m = JSON.parse(mosaic) as { attrs: Record<string, unknown> };
  return JSON.stringify({ ...m, attrs: { ...m.attrs, ...scratch } });
}

export type RootForm = AnswerKey["form"] | "outOfRule" | "liveMap" | "error";
export interface RootProbe {
  id: string;
  /** The root's reference key. */
  call: string;
  form: RootForm;
  pools: PoolKind[];
  /** Why a root is out of the rule, has no value or failed; null for a root in the rule. */
  reason: string | null;
  ms: number;
  /** The time of each stage, in ms: the recording's (tree-record.ts), then the answer key's. */
  stages: Record<string, number>;
}

const NO_VALUE =
  "a raiz não deu número: pede o mapa vivo, ou a chamada da raiz está errada";

/**
 * Records one sketch's root and classifies its form (research R1); a recording or an answer key that fails, or a call
 * of the root that fails, is an `error` of that root, by kind.
 */
export function probeRoot(
  record: (
    roots: readonly RootCall[],
    scratch?: Readonly<Record<string, string | number>>,
    routine?: readonly RoutineRun[],
  ) => Recording,
  ops: readonly Op[],
  bp: Blueprint,
  character = 0,
): RootProbe {
  const t0 = performance.now();
  const { ref, calls, part, branch, scratch, routine, sum, item } = bp.root;
  const first = routine ? stepsOf(routine)[0] : undefined;
  const base = {
    id: bp.id,
    call: ref
      ? refKey(ref, character)
      : first
        ? `routine ${"call" in first ? refKey(first, character) : first.event}`
        : `sum of ${String(calls?.length ?? 0)} calls`,
  };
  const stages: Record<string, number> = {};
  const done = (
    form: RootForm,
    pools: PoolKind[],
    reason: string | null,
  ): RootProbe => ({
    ...base,
    form,
    pools,
    reason,
    ms: performance.now() - t0,
    stages,
  });
  // A root that breaks is an error of its own: the run goes on to the others.
  let stage = "a gravação";
  try {
    const roots = rootCallsOf(bp, character);
    const rec: Recording = record(roots, scratch, routineStepOf(bp, character));
    for (const [k, ms] of Object.entries(rec.ms ?? {}))
      stages[k] = Math.round(ms);
    const tops = (rec.nodes[rec.root ?? -1]?.c ?? [])
      .slice(0, roots.length)
      .map((id) => rec.nodes[id]);
    // a call that failed (the recorder marks it) or gave no number: the live map, or a wrong call
    // a root that returns a list (an item of it is the number), or a part of what it wrote (the Seraph, T161), gives
    // no number of its own
    if (
      tops.length < roots.length ||
      tops.some((n) => n?.err) ||
      (item === undefined &&
        part === undefined &&
        tops.some((n) => typeof n?.v !== "number"))
    )
      return done("liveMap", [], NO_VALUE);
    stage = "o gabarito";
    const shape = routine
      ? { routine: refKey({ read: sum ?? "" }, character) }
      : item !== undefined
        ? { item }
        : calls
          ? { sum: calls.length }
          : part
            ? {
                part: part.map((r) => refKey(r, character)),
                ...(branch === undefined
                  ? {}
                  : { branch: refKey({ read: branch }, character) }),
              }
            : null;
    const t1 = performance.now();
    const key = answerKey(rec, ops, shape);
    stages.answerKey = Math.round(performance.now() - t1);
    if ("error" in key) return done("outOfRule", [], key.reason);
    return done(
      key.form,
      key.pools.map((p) => p.kind),
      null,
    );
  } catch (e) {
    // the recording's stages measured before it failed (tree-record.ts puts them on the error)
    const ms = (e as { ms?: unknown } | null)?.ms;
    if (typeof ms === "object" && ms !== null)
      for (const [k, v] of Object.entries(ms))
        if (typeof v === "number") stages[k] = Math.round(v);
    // only the error's kind: its message could carry a text of the save
    return done(
      "error",
      [],
      `${stage} falhou (${e instanceof Error ? e.name : "erro"})`,
    );
  }
}

/** `roots.json`: the count of each form, every root, the ones out of the rule and the ones that need the live map. */
export function rootsReport(probes: readonly RootProbe[]) {
  const counts: Record<RootForm, number> = {
    chain: 0,
    expression: 0,
    leaf: 0,
    sum: 0,
    outOfRule: 0,
    liveMap: 0,
    error: 0,
  };
  for (const p of probes) counts[p.form]++;
  return {
    counts,
    outOfRule: probes.filter(
      (p) => p.form === "outOfRule" || p.form === "error",
    ),
    liveMap: probes.filter((p) => p.form === "liveMap").map((p) => p.id),
    roots: probes,
  };
}

/** One line of `summary.txt`: the id, the result and the time; never a text of the save. */
export const summaryLine = (
  id: string,
  outcome: {
    result: RootForm | "passed" | "failed" | "notWritten";
    ms: number;
  },
): string => `${id}\t${outcome.result}\t${String(Math.round(outcome.ms))} ms`;
