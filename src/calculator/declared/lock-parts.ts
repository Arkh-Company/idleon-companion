// The parts of a recorded level the lock and the draft read (spec 010, research R2, R4, R6): the leaves of an
// expression, the reference each one stands for, the place of a two-source term in the root's steps, and what a
// declared leaf would hide below it (spec, Open Questions 22/11): a read of the save, or a call that reads it. A game
// table's read (recorded/steps.ts GAME_TABLE) and a part of not-leaves.ts are no child. And the values a level reads
// (moved out of lock-levels.ts as they were): a recorded value as a number, what a call returned, a curve's value; the
// tolerance a level closes within and the leaf's check (moved too, for lock-pieces.ts).
import type { RecNode, Recording } from "../recording.ts";
import { GAME_TABLE } from "../recorded/steps.ts";
import type { Expr } from "../recorded/steps.ts";
import { CALC_LEAF_KINDS } from "../tree-contract.ts";
import { callRef, near } from "./answer-key-pool.ts";
import type { AnswerTerm } from "./answer-key.ts";
import type { BlueprintNode } from "./blueprint.ts";
import { evalExpr } from "./expr-eval.ts";
import type { LevelContext, LevelOut } from "./lock-levels.ts";
import { notLeafOf } from "./not-leaves.ts";

/** SC-001: the parts close with the recorded value within a relative difference of 1e-6. */
export const TOLERANCE = 1e-6;

const LEAVES: readonly string[] = CALC_LEAF_KINDS.filter(
  (k) => k !== "unknown",
);

/** A declared leaf: one of the 9 kinds, counted, or a leafType refusal at its place. */
export const leafCheck = (
  node: BlueprintNode,
  where: string,
  out: LevelOut,
): void => {
  if (node.leaf !== undefined && LEAVES.includes(node.leaf))
    out.counts.leaves++;
  else out.errors.push({ kind: "leafType", where });
};

export function leavesOf(e: Expr, out: Expr[] = []): Expr[] {
  if (e.t === "def") leavesOf(e.e, out);
  else if (e.t === "op") leavesOf(e.r, leavesOf(e.l, out));
  else if (e.t === "fn") for (const a of e.args) leavesOf(a, out);
  else if (e.t === "not") leavesOf(e.a, out);
  else out.push(e);
  return out;
}

export const keyOfLeaf = (e: Expr, rec: Recording): string | null => {
  if (e.t === "read") return e.p;
  const n = e.t === "call" ? rec.nodes[e.id] : undefined;
  return n ? callRef(n) : null;
};

/**
 * The first part below a recorded call that reads the save: one of its own reads, else one of its calls that reads it
 * (at any depth); null with none. The part is named by its path or its call, never by its value.
 */
export function saveChild(
  n: RecNode,
  ctx: Pick<LevelContext, "rec" | "character">,
): string | null {
  const aside = (k: string) => notLeafOf(k, ctx.character) !== null;
  const read = (n.r ?? []).find(
    ([p]) => !GAME_TABLE.some((t) => t.test.test(p)) && !aside(p),
  );
  if (read) return read[0];
  for (const id of n.c) {
    const k = ctx.rec.nodes[id];
    if (k && !aside(callRef(k)) && saveChild(k, ctx) !== null)
      return callRef(k);
  }
  return null;
}

/**
 * The place of a two-source term in the root's steps: the smallest part around its first call that holds every ref, or
 * the % factor around it (`pctOf`).
 */
export function termExpr(
  term: AnswerTerm,
  top: RecNode,
  ctx: LevelContext,
): Expr | null {
  const first = term.nodes[0];
  const isFirst = (e: Expr) =>
    first === null || first === undefined
      ? e.t === "read" && e.p === term.ref
      : e.t === "call" && e.id === first;
  const found: Expr[] = [];
  const visit = (e: Expr, up: readonly Expr[]): void => {
    if (isFirst(e)) {
      const chain = [...up, e];
      const at = chain.findLastIndex((x) => {
        const ks = new Set(leavesOf(x).map((l) => keyOfLeaf(l, ctx.rec)));
        return term.refs.every((r) => ks.has(r));
      });
      const around = at < 0 ? undefined : (pctOf(chain, at) ?? chain[at]);
      if (around) found.push(around);
      return;
    }
    const kids =
      e.t === "def"
        ? [e.e]
        : e.t === "op"
          ? [e.l, e.r]
          : e.t === "fn"
            ? e.args
            : e.t === "not"
              ? [e.a]
              : [];
    for (const k of kids) visit(k, [...up, e]);
  };
  for (const s of ctx.stepsOf(top.id).steps) visit(s.e, []);
  // a read in more than one place: the place does not decide, and the term is not guessed
  return found.length === 1 ? (found[0] ?? null) : null;
}

/**
 * The % factor around a sum, `1 + sum / 100` (T172, the LUK's Multi pools; answer-key-expression.ts `isPct`): a Multi's
 * term of several parts is the factor, never the sum inside it; null when the sum at `chain[at]` is in no such factor.
 */
function pctOf(chain: readonly Expr[], at: number): Expr | null {
  const sum = chain[at];
  const div = chain[at - 1];
  const plus = chain[at - 2];
  const one = (x: Expr) => x.t === "num" && x.v === 1;
  const isDiv =
    div?.t === "op" &&
    div.o === "/" &&
    div.l === sum &&
    div.r.t === "num" &&
    div.r.v === 100;
  const isPlus =
    plus?.t === "op" &&
    plus.o === "+" &&
    ((one(plus.l) && plus.r === div) || (one(plus.r) && plus.l === div));
  return isDiv && isPlus ? plus : null;
}

/** A recorded value as a number: a boolean is 1 or 0, a text only when it is a number. */
export const num = (v: unknown): number | null =>
  typeof v === "number"
    ? v
    : typeof v === "boolean"
      ? Number(v)
      : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))
        ? Number(v)
        : null;

/**
 * The expression a call returned: its last call when it began after the last step (`return Call(…)`, by the recorded
 * place, T184), else its last step with its value, or else the last call it made. A return with its recorded place (`rt`,
 * Fase 4 r3) gives that place's last call, or its last read when the value checks it. With none, a last call and a last read
 * both after the last step: the one worth the call's value; both worth it, none, never by their order.
 */
export function returnOf(n: RecNode, ctx: LevelContext): Expr | null {
  const { steps, stepAt } = ctx.stepsOf(n.id);
  const last = steps.at(-1);
  const kid = ctx.rec.nodes[n.c.at(-1) ?? -1];
  const call: Expr | null = kid
    ? { t: "call", id: kid.id, v: num(kid.v) }
    : null;
  const lastAt = stepAt?.at(-1) ?? -1;
  const rx = n.rx ?? [];
  const r = rx.at(-1);
  const readAfter = r !== undefined && r[2] > lastAt;
  // every call is a child, so a call's return is its last one, worth what the lock counts again (lock-levels); a read
  // of no number (a boolean) is no log entry, so the last one confirms by its value
  if (n.rt === "call") return call;
  if (n.rt === "read")
    return r && near(num(r[1]), n.v)
      ? { t: "read", p: r[0], v: num(r[1]) }
      : null;
  if (kid && lastAt < kid.pxi) {
    const byCall = near(kid.v, n.v);
    const byRead = readAfter && near(num(r[1]), n.v);
    if (byCall && byRead) return null;
    if (byCall) return call;
    if (byRead) return { t: "read", p: r[0], v: num(r[1]) };
  }
  if (last && near(last.v, n.v)) return last.e;
  // a 0 that no step nor call gave is the code's own `return 0` before its count (T183: the gate, a level 0)
  if (n.v === 0) return { t: "num", v: 0 };
  // a bare `return read` (a cache, a table's cell): the call's last read, made after its last step, by its place
  if (readAfter && near(num(r[1]), n.v))
    return { t: "read", p: r[0], v: num(r[1]) };
  // with only tests run (no arithmetic, no call), a number no read gave is the code's literal (an achievement's 1)
  const tests = ["leaf", "test", "cmp"];
  const onlyTests =
    !!ctx.ops &&
    (n.x ?? []).every(([id]) => tests.includes(ctx.ops?.[id]?.kind ?? ""));
  if (onlyTests && !kid && typeof n.v === "number") return { t: "num", v: n.v };
  return call;
}

/** A call that returned the code's literal (`returnOf`): its parts are what it read before the return. */
export const literal = (e: Expr | null): boolean => e?.t === "num";

/** A curve's value: counted again from its own last step when its numeric arguments differ, else the recorded one. */
export function transparentValue(
  k: RecNode,
  ctx: LevelContext,
): { v: number | null; byRecorded: boolean } {
  const args = k.a.filter((a): a is number => typeof a === "number");
  const step = ctx.stepsOf(k.id).steps.at(-1);
  if (step && new Set(args).size === args.length) {
    const v = evalExpr(step.e, (e) =>
      e.t === "val"
        ? typeof e.v === "number" && args.includes(e.v)
          ? e.v
          : undefined
        : e.t === "call" || e.t === "read"
          ? (num(e.v) ?? undefined)
          : undefined,
    );
    if (v !== null) return { v, byRecorded: false };
  }
  return { v: num(k.v), byRecorded: true };
}
