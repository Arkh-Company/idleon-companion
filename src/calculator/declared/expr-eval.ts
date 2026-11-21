// The evaluator of a recorded expression (spec 010, FR-010, research R2): the lock swaps each reference for its declared
// child's value and evaluates the rest here, in memory only. An operator or a function outside these lists, a reference
// with no value, a division by zero or a result that is not a finite number gives null, never an exception.
import type { Expr } from "../recorded/steps.ts";

const bool = (b: boolean): number => (b ? 1 : 0);
const OPS: Record<string, (l: number, r: number) => number> = {
  "+": (l, r) => l + r,
  "-": (l, r) => l - r,
  "*": (l, r) => l * r,
  "/": (l, r) => (r === 0 ? NaN : l / r),
  "**": (l, r) => l ** r,
  "%": (l, r) => (r === 0 ? NaN : l % r),
  "<": (l, r) => bool(l < r),
  ">": (l, r) => bool(l > r),
  "<=": (l, r) => bool(l <= r),
  ">=": (l, r) => bool(l >= r),
  "==": (l, r) => bool(l === r),
  "===": (l, r) => bool(l === r),
  "!=": (l, r) => bool(l !== r),
  "!==": (l, r) => bool(l !== r),
  // && and ||: the right side only when the left one did not settle it (evalExpr stops before it otherwise)
  "&&": (_l, r) => r,
  "||": (_l, r) => r,
};
const FNS: Record<string, (...a: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  abs: Math.abs,
  log: Math.log,
  sqrt: Math.sqrt,
};

const finite = (x: number): number | null => (Number.isFinite(x) ? x : null);

export function evalExpr(
  e: Expr,
  valueOf: (e: Expr) => number | undefined,
): number | null {
  const given = valueOf(e);
  if (given !== undefined) return finite(given);
  const ev = (x: Expr) => evalExpr(x, valueOf);
  switch (e.t) {
    case "num":
      return typeof e.v === "number"
        ? e.v
        : typeof e.v === "boolean"
          ? bool(e.v)
          : null;
    case "def":
      return ev(e.e);
    case "not": {
      const a = ev(e.a);
      return a === null ? null : bool(a === 0);
    }
    case "op": {
      const f = OPS[e.o];
      const l = ev(e.l);
      // the side the game never ran has no value: && stops at a 0, || at anything else
      if (
        l !== null &&
        ((e.o === "&&" && l === 0) || (e.o === "||" && l !== 0))
      )
        return l;
      const r = ev(e.r);
      return f && l !== null && r !== null ? finite(f(l, r)) : null;
    }
    case "fn": {
      const f = e.name === null ? undefined : FNS[e.name];
      const args = e.args.map(ev);
      return f && args.every((a) => a !== null) ? finite(f(...args)) : null;
    }
    default:
      // a call, a read or a value with no source: only its child's value
      return null;
  }
}
