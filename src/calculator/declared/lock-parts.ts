// The parts of a recorded level the lock and the draft read (spec 010, research R2, R4, R6): the leaves of an
// expression, the reference each one stands for, the place of a two-source term in the root's steps, and what a
// declared leaf would hide below it (spec, Open Questions 22/11): a read of the save, or a call that reads it. A game
// table's read (recorded/steps.ts GAME_TABLE) and a part of not-leaves.ts are no child.
import type { RecNode, Recording } from "../recording.ts";
import { GAME_TABLE } from "../recorded/steps.ts";
import type { Expr } from "../recorded/steps.ts";
import { callRef } from "./answer-key-pool.ts";
import type { AnswerTerm } from "./answer-key.ts";
import type { LevelContext } from "./lock-levels.ts";
import { notLeafOf } from "./not-leaves.ts";

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

/** The place of a two-source term in the root's steps: the smallest part around its first call that holds every ref. */
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
      const around = [...up, e].reverse().find((x) => {
        const ks = new Set(leavesOf(x).map((l) => keyOfLeaf(l, ctx.rec)));
        return term.refs.every((r) => ks.has(r));
      });
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
