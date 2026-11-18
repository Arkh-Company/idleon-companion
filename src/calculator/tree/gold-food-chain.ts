// A golden food computed as a chain of steps (spec 009, FR-007, FR-008, FR-017; 009 r2): two terms of its steps that the
// rules of names leave with no name of their own get one by their role in GoldFoodBonuses (tree/gold-food.ts), the
// names the Vinicius chose, in English as every tree. The worn food's quantity factor, 1 + log₁₀(10 + quantity) ÷ 2.14,
// is the "Quantity multiplier"; the emporium's term, Amount × the shared multiplier × 0.05 × log₁₀, is the emporium's
// row, its parts with the shared multiplier among them, so they multiply to it.
import type { RecNode } from "../recording.ts";
import { fx3 } from "./curves.ts";
import { flat } from "./expr.ts";
import type { Pair } from "./formulas.ts";
import { emporiumName, GOLD_FOOD } from "./gold-food.ts";
import { near } from "./math.ts";
import { withName } from "./row-checks.ts";
import { finish, row, valueOf } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr, Step } from "./steps.ts";
import type { Reads } from "./val-path.ts";

/** Each name by its role, with its proof by reference (the worn food's factor; the shared multiplier). */
export const GOLD_FOOD_TERMS = {
  quantity: { name: "Quantity multiplier", proof: "N.js GoldFoodBonuses" },
  multiplier: { name: "Golden food multiplier", proof: "N.js GoldFoodBonuses" },
};

const strip = (e: Expr): Expr => (e.t === "def" ? strip(e.e) : e);
const isNum = (e: Expr, v: number) => {
  const x = strip(e);
  return x.t === "num" && Number(x.v) === v;
};

/** The block a chain's terms are built in, and how a term becomes a row there. */
export interface GoldFoodBlock {
  block: RecNode;
  nodes: readonly RecNode[];
  steps: readonly Step[];
  reads: Reads;
  term: (e: Expr, op: "*" | "+") => Row | null;
}

/** Term `e` of a golden food's step, named by its role; null for any other term or block (the assembly's row). */
export function goldFoodTerm(
  e: Expr,
  op: "*" | "+",
  { block, nodes, steps, reads, term }: GoldFoodBlock,
): Row | null {
  if (!GOLD_FOOD.test.test(block.b)) return null;
  const x = strip(e);
  const isLog = (y: Expr) => y.t === "call" && nodes[y.id]?.b === "getLOG";
  // 1 + log₁₀(10 + quantity) ÷ 2.14
  const q = x.t === "op" && x.o === "+" && isNum(x.l, 1) ? strip(x.r) : null;
  const log =
    q?.t === "op" && q.o === "/" && isNum(q.r, 2.14) ? strip(q.l) : null;
  if (log?.t === "call" && isLog(log)) {
    const r = term(e, op);
    const quantity = Number(nodes[log.id]?.a[0]) - 10;
    const f: Pair = [
      "1 + log₁₀(quantity + 10) ÷ 2.14",
      `1 + log₁₀(${fx3(quantity)} + 10) ÷ 2.14 = ${fx3(Number(e.v))}`,
    ];
    return r && { ...withName(r, GOLD_FOOD_TERMS.quantity.name), f };
  }
  // Amount × the shared multiplier × 0.05 × log₁₀(…): the multiplier is the value of an earlier step, kept in a variable
  if (x.t !== "op" || x.o !== "*") return null;
  const fs = flat(x, "*");
  const multi = fs.find(
    (t) => t.t === "def" && steps.some((st) => near(st.v, t.v)),
  );
  if (!multi || !fs.some(isLog)) return null;
  const parts = fs.map((t) =>
    t === multi
      ? {
          node: row({
            pieceKey: null,
            value: valueOf(t.v ?? null),
            code: null,
            name: GOLD_FOOD_TERMS.multiplier.name,
            fmt: "x",
          }),
          open: null,
        }
      : term(t, "*"),
  );
  if (parts.some((p) => !p)) return null;
  const name = emporiumName(reads);
  return {
    node: row({
      pieceKey: null,
      value: valueOf(e.v ?? null),
      code: null,
      ...(name === null ? {} : { name }),
    }),
    open: null,
    group: finish(
      e.v,
      parts.flatMap((p) => p ?? []),
      true,
    ),
  };
}
