// The top layer of a root (spec 010, FR-002c; spec, Open Questions 21 and 22/11): what the root does above its pools,
// from outside in, as the code writes it. A round, a floor or a ceiling; the game's `min` is a Cap and its `max` a
// Floor, with a constant limit or a limit that is a line of its own (it opens into its sources); a division `A ÷ B`
// (➗): the numerator goes on to the pools, and each factor of B is a ➗ line; a root that returns `test ? a : b` has a
// gate, and a condition outside the return has its two paths (branchesOf). Only these: anything else stays below and
// goes to the pools' rule, or is refused there with the reason.
import type { Op } from "../instrument.ts";
import type { RecNode } from "../recording.ts";
import type { Expr } from "../recorded/steps.ts";
import type { AnswerPool } from "./answer-key.ts";

export interface TopLayer {
  kind: "round" | "floor" | "ceil" | "cap" | "floor-min" | "cond" | "div";
  /** The cap's or the floor's limit, a constant numerator of a division, or the gate's test (1 yes, 0 no). */
  value?: number;
  before: number;
  after: number;
  /** A Cap's or a Floor's limit that is no constant: a line with its sources and constants. */
  limit?: AnswerPool;
  /** The root's step the layer is on: its last step, or a step of its running total. */
  step?: number;
}

const ROUNDS: Readonly<Record<string, TopLayer["kind"]>> = {
  round: "round",
  floor: "floor",
  ceil: "ceil",
};

const bare = (e: Expr): Expr => (e.t === "def" ? bare(e.e) : e);
const leftmost = (e: Expr): Expr => {
  const b = bare(e);
  return b.t === "op" ? leftmost(b.l) : b;
};
/** An expression that starts with a constant of the code: `90 + …`, `10000 × …`, or a min/max of such sides (T162). */
const startsConst = (e: Expr): boolean => {
  const b = bare(e);
  if (b.t === "fn" && (b.name === "min" || b.name === "max"))
    return b.args.length > 0 && b.args.every(startsConst);
  return b.t === "op" && leftmost(e).t === "num";
};

/**
 * The known layers of a step, from outside in, and the rest below them: with each layer whose limit is no constant,
 * that limit's expression; with each division, its divisor's expression, in the same order (`noDivision`: a step of a
 * running total, where a division is no layer). In a min or a max with no constant, the value is the side that comes
 * from what the root wrote (`own`) and the other is the limit; with neither, the cap is the side that starts with a
 * constant of the code, unless a side holds what the root wrote (`touches`); anything else is refused (`refused`):
 * ambiguity is never resolved by order.
 */
export function peelTop(
  e: Expr,
  {
    own = () => false,
    touches = () => false,
    noDivision = false,
  }: {
    own?: (e: Expr) => boolean;
    touches?: (e: Expr) => boolean;
    noDivision?: boolean;
  } = {},
): {
  layers: TopLayer[];
  limits: Map<TopLayer, Expr>;
  divisors: Expr[];
  rest: Expr;
  refused?: string;
} {
  const layers: TopLayer[] = [];
  const limits = new Map<TopLayer, Expr>();
  const divisors: Expr[] = [];
  for (;;) {
    e = bare(e);
    const after = e.v;
    if (typeof after !== "number") break;
    if (e.t === "fn" && e.name !== null) {
      const round = ROUNDS[e.name];
      const [a, b] = e.args;
      if (round && a && e.args.length === 1 && typeof a.v === "number") {
        layers.push({ kind: round, before: a.v, after });
        e = a;
        continue;
      }
      if (
        (e.name === "min" || e.name === "max") &&
        a &&
        b &&
        e.args.length === 2
      ) {
        const kind = e.name === "min" ? "cap" : "floor-min";
        const k = a.t === "num" ? a : b.t === "num" ? b : null;
        // with no constant: the value is the side from what the root wrote; with neither, the cap is the side that
        // starts with a constant of the code (spec, Open Questions 22/11); anything else is ambiguous
        const value = k
          ? k === a
            ? b
            : a
          : own(a) !== own(b)
            ? own(a)
              ? a
              : b
            : !own(a) &&
                !touches(a) &&
                !touches(b) &&
                startsConst(a) !== startsConst(b)
              ? startsConst(a)
                ? b
                : a
              : null;
        if (!value)
          return {
            layers,
            limits,
            divisors,
            rest: e,
            refused: "o limite do min/max não se distingue do valor",
          };
        const main = value;
        const limit = main === a ? b : a;
        if (typeof main.v === "number" && typeof limit.v === "number") {
          const layer: TopLayer = {
            kind,
            value: limit.v,
            before: main.v,
            after,
          };
          layers.push(layer);
          if (!k) limits.set(layer, limit);
          e = main;
          continue;
        }
      }
    }
    if (
      !noDivision &&
      e.t === "op" &&
      e.o === "/" &&
      typeof e.l.v === "number" &&
      typeof e.r.v === "number"
    ) {
      const n = bare(e.l);
      layers.push({
        kind: "div",
        ...(n.t === "num" && typeof n.v === "number" ? { value: n.v } : {}),
        before: e.r.v,
        after,
      });
      divisors.push(e.r);
      e = e.l;
      continue;
    }
    break;
  }
  return { layers, limits, divisors, rest: e };
}

/**
 * The gate of a root that returns `test ? a : b`: its test, recorded in the root's step log, with which side ran. The
 * code is read in memory only, to see that the test follows the block's `return`.
 */
export function gateOf(
  top: RecNode,
  ops: readonly Op[],
  final: number,
): TopLayer | null {
  for (const [id, v] of top.x ?? []) {
    const op = ops[id];
    if (op?.kind !== "test" || op.block !== top.b) continue;
    // the ranges count from 1 inside the block's text (it was parsed as `(text)`)
    if (/\breturn\s*\(?\s*$/.test(op.fnText.slice(0, op.node.range[0] - 1)))
      return { kind: "cond", value: v ? 1 : 0, before: final, after: final };
  }
  return null;
}

/** The path that ran of a condition outside the root's `return`: its recorded value and expression, and the test. */
export interface Branch {
  value: number;
  /** The test's result: 1 yes, 0 no. */
  test: number;
  e: Expr;
}

/**
 * The paths that ran of the root's conditions outside its `return` (spec 010, T151), read from the recorded test op,
 * never guessed: the branch inside the conditional's own recorded op (a conditional inside a step), or the next top op
 * after the test that the code puts right after its `?` (yes) or its `:` (no) (a conditional set in a variable). Two
 * paths with the same value are left out: nothing tells them apart.
 */
export function branchesOf(
  top: RecNode,
  ops: readonly Op[],
  exprOf: ((op: number) => Expr | null) | undefined,
): Branch[] {
  if (!exprOf) return [];
  const x = top.x ?? [];
  const valueOf = new Map(x.map(([id, v]) => [id, v]));
  const out: Branch[] = [];
  x.forEach(([tid, tv], at) => {
    const t = ops[tid];
    if (t?.kind !== "test" || t.block !== top.b) return;
    const text = t.fnText;
    if (/\breturn\s*\(?\s*$/.test(text.slice(0, t.node.range[0] - 1))) return;
    const yes = tv ? 1 : 0;
    const end = t.node.range[1] - 1;
    const follows = (id: number) => {
      const o = ops[id];
      if (!o || o.kind === "test" || o.parent !== t.parent) return false;
      const between = text.slice(end, o.node.range[0] - 1);
      return yes
        ? /^[\s)]*\?[\s(]*$/.test(between)
        : /^[\s)]*\?[^?]*:[\s(]*$/.test(between);
    };
    const inside =
      t.parent !== undefined &&
      ops[t.parent]?.node.type === "ConditionalExpression";
    const branch = x
      .slice(at + 1)
      .map(([id]) => id)
      .find((id) =>
        inside
          ? ops[id]?.parent === t.parent && ops[id]?.kind !== "test"
          : follows(id),
      );
    const v = branch === undefined ? undefined : valueOf.get(branch);
    const e = branch === undefined ? null : exprOf(branch);
    if (typeof v === "number" && e) out.push({ value: v, test: yes, e });
  });
  return out.filter((b) => out.filter((o) => o.value === b.value).length === 1);
}
