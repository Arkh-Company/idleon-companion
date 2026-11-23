// A write's turn in the answer key (spec 010, T175, T177; moved out of answer-key-steps.ts as it was): the step that gave
// a write of the root at its own place in its loop's turn, read from the turn's steps (makeSteps turnOf).
import type { Op } from "../instrument.ts";
import type { RecNode, Recording, RecWrite } from "../recording.ts";
import type { BlockSteps, LoopTurn } from "../recorded/steps.ts";
import { near } from "./answer-key-pool.ts";
import type { WriteMeta } from "./answer-key-chain.ts";
import { writeExpr, writeTurn } from "./cache-author.ts";

/** The step that gave the root's write `w` in its turn (WriteMeta.turn), or null. */
export function turnOfWrite(
  rec: Recording,
  top: RecNode,
  w: RecWrite,
  turnOf: (n: RecNode, range: LoopTurn) => BlockSteps,
  stepAt: readonly number[] | undefined,
  ops: readonly Op[] | undefined,
): ReturnType<NonNullable<WriteMeta["turn"]>> {
  const a = { node: top, write: w };
  const t = writeTurn(rec, a, turnOf);
  const op = (at?: number) => top.x?.[at ?? -1]?.[0];
  // a write of a variable a turn added to (`t += x`, T177): that assignment, with its turn's values
  const own = op(w.xi - 1);
  if (own !== undefined && ops?.[own]?.kind === "assign") {
    const ae = t.exprOf?.(own);
    return ae && near(ae.v, w.v)
      ? { e: ae, step: -1, pos: w.xi - 1, assign: true }
      : null;
  }
  const e = writeExpr(rec, a, turnOf, t);
  // the turn's step is the root's step of the same op of the code: where the step log put each
  const pos = t.stepAt?.at(-1);
  const mine = op(pos);
  const step = (stepAt ?? []).findIndex((p) => op(p) === mine);
  return e && { e, step, ...(pos !== undefined && { pos }) };
}
