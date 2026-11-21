// The tops of a root's step a value passes through or that round it (spec 009, T025, T030): a round, a floor or a ceil
// that changes nothing, or a clamp that does not bite, is read through (tree/pools.ts); a rounding that changes the
// value keeps the pools of the value before it, and stays in sight in the root's ⓘ (tree/mould.ts).
import { near } from "../recorded/math.ts";
import type { Expr, Step } from "../recorded/steps.ts";

const strip = (e: Expr): Expr => (e.t === "def" ? strip(e.e) : e);

/**
 * A step's expression under a top its value passes through (T025): a round, a floor or a ceil that changes nothing, or
 * a clamp (a max or a min with a number) that does not bite; else the expression itself.
 */
export function through(e: Expr, v: number): Expr {
  const x = strip(e);
  if (x.t !== "fn" || !x.name) return x;
  const vars = x.args.filter((a) => strip(a).t !== "num");
  const [inner] = vars;
  const round = ["round", "floor", "ceil"].includes(x.name);
  const clamp = ["max", "min"].includes(x.name) && x.args.length === 2;
  if (!inner || vars.length !== 1 || !(round ? x.args.length === 1 : clamp))
    return x;
  // exactly: a tolerance would let the round of a big number pass, and hide it (FR-008)
  return Number(inner.v) === v ? through(inner, v) : x;
}

/** A rounding the root's last step does to the whole of its value (spec 009 T030): its function and what it rounds. */
export interface Rounding {
  fn: "round" | "floor" | "ceil";
  /** The value before the rounding, and its expression. */
  inner: number;
  e: Expr;
  /** The root's steps with the last one in place of the rounded one: the steps the pools read. */
  steps?: Step[];
}
/**
 * The round, floor or ceil of the root's step that changes its value (STR, AGI, WIS, LUK: floor(…)), whose pools give
 * the value before it; null for none, or for one that changes nothing (`through` reads it).
 */
export function roundingOf(
  expr: Expr | null,
  steps: readonly Step[] | undefined,
  v: number,
): Rounding | null {
  const k = steps ? steps.findLastIndex((s) => near(s.v, v)) : -1;
  const top = steps?.[k]?.e ?? expr;
  const x = top ? strip(top) : null;
  const [arg] = x?.t === "fn" && x.args.length === 1 ? x.args : [];
  const fn = x?.t === "fn" ? x.name : null;
  if (!arg || (fn !== "round" && fn !== "floor" && fn !== "ceil")) return null;
  const inner = Number(arg.v);
  if (!Number.isFinite(inner) || inner === v || Math[fn](inner) !== v)
    return null;
  const e = strip(arg);
  return {
    fn,
    inner,
    e,
    ...(steps && k >= 0
      ? { steps: [...steps.slice(0, k), { v: inner, e }] }
      : {}),
  };
}
