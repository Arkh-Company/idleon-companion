// The worn food's step of a golden food's chain (spec 009, FR-005, FR-008; the Vinicius's rule of 19/11): the step
// Amount × the running total × 0.05 × log₁₀(1 + quantity) × (1 + log₁₀(1 + quantity) ÷ 2.14), the running total the
// shared multiplier the chain reads back (N.js GoldFoodBonuses, DNSM.GfoodBonus), is one row of its pool, "Equipped: <the
// food>", never a row per factor. Its log₁₀ and its quantity factor are math, only in its ⓘ; its leaves are what goes
// into the math: the step's other factors (the amount, the base rate) and the quantity its logs take.
import type { RecNode } from "../recording.ts";
import { fx3 } from "./curves.ts";
import type { Pair } from "./formulas.ts";
import {
  equippedName,
  GOLD_FOOD,
  measuresWorn,
  sourceTerm,
} from "./gold-food.ts";
import { finish, row, valueOf } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr } from "./steps.ts";
import type { Reads } from "./val-path.ts";

/** The block a chain's step is in, and how a factor of it becomes a row there. */
export interface WornStepBlock {
  block: RecNode;
  nodes: readonly RecNode[];
  reads: Reads;
  term: (e: Expr) => Row | null;
}

const strip = (e: Expr): Expr => (e.t === "def" ? strip(e.e) : e);
const isNum = (e: Expr, v: number) => {
  const x = strip(e);
  return x.t === "num" && Number(x.v) === v;
};
/** A leaf with a fixed name, no code: what goes into the logs. */
const leaf = (name: string, v: number): Row => ({
  node: row({ pieceKey: null, value: valueOf(v), code: null, name }),
  open: null,
});

/**
 * The factors `terms` of a step of a golden food's chain, but its running total, as the worn food's one row, when a log
 * among them measures the worn food's quantity; null for any other step or block.
 */
export function wornStep(
  terms: readonly Expr[],
  { block, nodes, reads, term }: WornStepBlock,
): Row | null {
  if (!GOLD_FOOD.test.test(block.b)) return null;
  // the argument of a log call that measures the worn food, 1 + its quantity
  const logArg = (t: Expr): number | null => {
    const y = strip(t);
    const arg =
      y.t === "call" && nodes[y.id]?.b === "getLOG" ? nodes[y.id]?.a[0] : null;
    return measuresWorn(arg, reads) ? Number(arg) : null;
  };
  // the quantity factor, 1 + log₁₀(1 + quantity) ÷ 2.14, by the argument of its log
  const factorArg = (t: Expr): number | null => {
    const y = strip(t);
    const q = y.t === "op" && y.o === "+" && isNum(y.l, 1) ? strip(y.r) : null;
    return q?.t === "op" && q.o === "/" && isNum(q.r, 2.14)
      ? logArg(q.l)
      : null;
  };
  const maths = terms.map((t) =>
    logArg(t) !== null ? "log" : factorArg(t) !== null ? "factor" : null,
  );
  const arg = terms
    .map((t) => logArg(t) ?? factorArg(t))
    .find((a) => a !== null);
  if (arg === undefined || arg === null) return null;
  const parts = terms.map((t, i) => (maths[i] ? null : term(t)));
  if (parts.some((p, i) => !maths[i] && !p)) return null;
  const value = terms.reduce((a, t) => a * Number(t.v), 1);
  const q = fx3(arg - 1);
  const log = (s: string) => `log₁₀(1 + ${s})`;
  const shown = terms.map((t, i): [string, string] => {
    const r = parts[i];
    if (maths[i] === "log") return [log("Quantity"), log(q)];
    if (maths[i] === "factor")
      return [`(1 + ${log("Quantity")} ÷ 2.14)`, `(1 + ${log(q)} ÷ 2.14)`];
    return [r ? sourceTerm(r) : "", fx3(Number(t.v))];
  });
  const f: Pair = [
    shown.map(([n]) => n).join(" × "),
    `${shown.map(([, v]) => v).join(" × ")} = ${fx3(value)}`,
  ];
  const name = equippedName(reads);
  const leaves = [
    ...parts.filter((p): p is Row => p !== null),
    leaf("Quantity", arg - 1),
  ];
  return {
    node: row({
      pieceKey: null,
      value: valueOf(value),
      code: null,
      ...(name === null ? {} : { name }),
    }),
    open: null,
    f,
    group: finish(value, leaves, false),
  };
}
