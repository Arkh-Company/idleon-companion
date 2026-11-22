// The top layer of a root (spec 010, FR-002c; spec, Open Questions 21/11): what the root does above its pools, from
// outside in, as the code writes it. A round, a floor or a ceiling; the game's `min` with a constant is a Cap and its
// `max` a Floor; a constant divided by a sum is a divisor (➗); a root that returns `test ? a : b` has a gate. Only
// these: anything else stays below and goes to the pools' rule, or is refused there with the reason.
import type { Op } from "../instrument.ts";
import type { RecNode } from "../recording.ts";
import type { Expr } from "../recorded/steps.ts";

export interface TopLayer {
  kind: "round" | "floor" | "ceil" | "cap" | "floor-min" | "cond" | "div";
  /** The cap's or the floor's constant, the divisor's numerator, or the gate's test (1 yes, 0 no). */
  value?: number;
  before: number;
  after: number;
}

const ROUNDS: Readonly<Record<string, TopLayer["kind"]>> = {
  round: "round",
  floor: "floor",
  ceil: "ceil",
};

/** The known layers of the root's last step, from outside in, and the rest below them. */
export function peelTop(e: Expr): { layers: TopLayer[]; rest: Expr } {
  const layers: TopLayer[] = [];
  for (;;) {
    while (e.t === "def") e = e.e;
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
        const k = a.t === "num" ? a : b.t === "num" ? b : null;
        const other = k === a ? b : a;
        if (k && typeof k.v === "number" && typeof other.v === "number") {
          layers.push({
            kind: e.name === "min" ? "cap" : "floor-min",
            value: k.v,
            before: other.v,
            after,
          });
          e = other;
          continue;
        }
      }
    }
    if (
      e.t === "op" &&
      e.o === "/" &&
      e.l.t === "num" &&
      typeof e.l.v === "number" &&
      typeof e.r.v === "number"
    ) {
      layers.push({ kind: "div", value: e.l.v, before: e.r.v, after });
      e = e.r;
      continue;
    }
    break;
  }
  return { layers, rest: e };
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
