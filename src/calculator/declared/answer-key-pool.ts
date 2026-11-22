// The pools of the answer key and their terms (spec 010, research R1 and R9): the shapes a term and a stretch of the
// root take, the pool each operator makes, and the joining of same-kind stretches in a row into one pool, each pool's
// value from the running total around it. answer-key-terms.ts opens the terms and passes these on.
import type { Expr } from "../recorded/steps.ts";
import type { AnswerPool } from "./answer-key.ts";

export const relDiff = (a: number, b: number): number =>
  a === b ? 0 : Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-300);

export interface AnswerTerm {
  kind: "source" | "constant";
  /** The main reference: `Block(args)` of a call or the path of a read; in a constant, its number. */
  ref: string;
  /** All the term's references, in the code's order (the first is `ref`). */
  refs: string[];
  /** The recorded node of each reference (null for a read), to go down to its children. */
  nodes: (number | null)[];
  /** The term's value as it enters the pool, before its weight. */
  value: number;
  /**
   * 1, or 1/100 when the game divides the whole sum by 100; negative for a subtracted term; in a ➗ line, times the
   * `scale` of a constant that multiplies the sum the term is in (the 0.65 of W7).
   */
  weight: number;
  /** In a ➗ line, the constant that multiplies the sum the term is in (the 0.65 of W7, T163), already in `weight`. */
  scale?: number;
  /** The passage values crossed to reach the term. */
  via: string[];
}
export type PoolKind = "additive" | "multi";
/** The pool each operator makes, and the operator of each pool. */
export const KIND: Readonly<Record<string, PoolKind>> = {
  "+": "additive",
  "-": "additive",
  "*": "multi",
};
export const OP: Readonly<Record<PoolKind, "+" | "*">> = {
  additive: "+",
  multi: "*",
};
/** An expression to open into terms, with its weight and the steps already opened on the way down to it. */
export interface Part {
  e: Expr;
  w: number;
  seen: ReadonlySet<number>;
}
/** A stretch of the root before same-kind ones in a row are joined into one pool. */
export interface RawPool {
  kind: PoolKind;
  terms: AnswerTerm[];
  step: number;
  after: number;
  /** The total after a layer on the step or after it (a max that bites): the next stretch starts from it. */
  next?: number;
}
/** A term still with its expression and its own noise, before it is known whether it is the accumulator. */
export type RawTerm = AnswerTerm & { e: Expr; noise: Record<string, number> };

/** A term as the answer key keeps it: without its expression and its noise. */
export const strip = (t: RawTerm): AnswerTerm => ({
  kind: t.kind,
  ref: t.ref,
  refs: t.refs,
  nodes: t.nodes,
  value: t.value,
  weight: t.weight,
  ...(t.scale === undefined ? {} : { scale: t.scale }),
  via: t.via,
});

/** Same-kind stretches in a row are one pool; each pool's value from the running total around it. */
export function joinPools(raw: readonly RawPool[]): AnswerPool[] {
  const pools: AnswerPool[] = [];
  // the total each pool leaves to the next one: after its layer, when a layer ends it
  const out: number[] = [];
  let cut = false;
  for (const p of raw) {
    const last = pools.at(-1);
    if (last?.kind === p.kind && !cut) {
      last.terms.push(...p.terms);
      if (!last.steps.includes(p.step)) last.steps.push(p.step);
      last.after = p.after;
      out[out.length - 1] = p.next ?? p.after;
    } else {
      pools.push({
        kind: p.kind,
        value: 0,
        after: p.after,
        terms: [...p.terms],
        steps: [p.step],
        error: 0,
      });
      out.push(p.next ?? p.after);
    }
    // pools never join across a layer
    cut = p.next !== undefined;
  }
  let before: number | null = null;
  for (const [k, p] of pools.entries()) {
    p.value =
      p.kind === "additive" ? p.after - (before ?? 0) : p.after / (before ?? 1);
    const parts =
      p.kind === "additive"
        ? p.terms.reduce((s, t) => s + t.value * t.weight, 0)
        : p.terms.reduce((s, t) => s * t.value, 1);
    p.error = relDiff(parts, p.value);
    before = out[k] ?? p.after;
  }
  return pools;
}
