// The answer key of a number (spec 010, FR-002c, FR-008, research R1 and R9; the prototype's gabarito.ts): what the
// recording gives, read from the root block's steps and writes only, never calling the game. Above the pools, the root
// may have a top layer (answer-key-top.ts). Below it, the root's form is a chain (a running total written more than
// once, the last write the value), an expression (no running total: the root's last step, split along its left side)
// or a leaf (a value read or a constant, no pool). Each write, or each stretch of the expression, adds or multiplies;
// same-kind ones in a row are one pool. Any other form is refused with the reason, never guessed. Two root shapes of
// the blueprint come here too (spec, Open Questions 21 and 22/11): a sum of calls, a routine run on the recorder's copy,
// and a part of a call (terms of its recorded pool, by reference; answer-key-shapes.ts).
import type { Op } from "../instrument.ts";
import type { Recording } from "../recording.ts";
import { makeSteps } from "../recorded/steps.ts";
import { near, outOfRule } from "./answer-key-terms.ts";
import type { RootFormError } from "./answer-key-terms.ts";
import {
  itemOf,
  partInWriters,
  partKey,
  routineKey,
  sumKey,
} from "./answer-key-shapes.ts";
import { answerKeyOfSteps, topOf } from "./answer-key-steps.ts";
import type { AnswerKey } from "./answer-key-steps.ts";
import { branchesOf, gateOf } from "./answer-key-top.ts";

export type {
  AnswerTerm,
  PoolKind,
  RootFormError,
} from "./answer-key-terms.ts";
export type { TopLayer } from "./answer-key-top.ts";
export type { AnswerKey, AnswerPool } from "./answer-key-steps.ts";
export { answerKeyOfSteps, topOf } from "./answer-key-steps.ts";

/** The blueprint's root shape, its references already turned into keys: a sum of calls, or a part of the call. */
export type RootShape =
  | { sum: number }
  | { part: readonly string[]; branch?: string }
  | { routine: string }
  | { item: number }
  | null;

export function answerKey(
  rec: Recording,
  ops: readonly Op[],
  shape: RootShape = null,
): AnswerKey | RootFormError {
  if (shape && "sum" in shape) return sumKey(rec, shape.sum);
  if (shape && "routine" in shape) return routineKey(rec, shape.routine);
  const top = topOf(rec);
  if (!top) return outOfRule("a gravação não tem raiz");
  const gate = typeof top.v !== "number" ? null : gateOf(top, ops, top.v);
  const made = makeSteps(rec, ops);
  const blockSteps = made.of(top.id);
  const branches = branchesOf(top, ops, blockSteps.exprOf);
  if (shape && "item" in shape) {
    const value = itemOf(rec, top, shape.item);
    if (typeof value !== "number") return value;
    // the item's step by its value: more than one step with it is ambiguous
    if (blockSteps.steps.filter((s) => near(s.v, value)).length > 1)
      return outOfRule(`o item ${String(shape.item)} está em mais de um passo`);
    return answerKeyOfSteps(rec, blockSteps, {
      branches,
      value,
      ops,
      turnOf: made.turnOf,
    });
  }
  const key = answerKeyOfSteps(rec, blockSteps, {
    gate,
    branches,
    ops,
    turnOf: made.turnOf,
  });
  if (!shape || !("part" in shape)) return key;
  const inner = (
    node: number,
    value: number,
    turn?: { from: number; to: number },
  ) => {
    const n = rec.nodes[node];
    const steps = turn && n ? made.turnOf(n, turn) : made.of(node);
    return answerKeyOfSteps(rec, steps, {
      node,
      value,
      ops,
      turnOf: made.turnOf,
    });
  };
  // a branch's part is only in the loop's turns of that branch (T163)
  if (shape.branch !== undefined)
    return (
      partInWriters(rec, top, shape.part, inner, shape.branch) ??
      outOfRule(`nenhuma volta achou o item na lista ${shape.branch}`)
    );
  const own = "error" in key ? key : partKey(key, shape.part);
  // found inside a bigger term of the root (a total the root crossed, the Obol's TotalStatsDN2, T177 r1): the pool of
  // the total that builds it, when one holds it whole
  if (
    !("error" in own) &&
    own.pools.some((p) =>
      p.terms.some((t) => t.refs.some((r) => !shape.part.includes(r))),
    )
  ) {
    const built = partInWriters(rec, top, shape.part, inner);
    return built && !("error" in built) ? built : own;
  }
  // found, or refused as ambiguous in the root: never looked for again elsewhere
  if (!("error" in own) || ("part" in own && own.part === "ambiguous"))
    return own;
  return partInWriters(rec, top, shape.part, inner) ?? own;
}
