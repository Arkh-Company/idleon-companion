// A golden food computed as a chain of steps (spec 009, FR-007, FR-008, FR-017; 009 r2): two terms of its steps that the
// rules of names leave with no name of their own get one by their role in GoldFoodBonuses (tree/gold-food.ts), the
// names the Vinicius chose, in English as every tree. The worn food's quantity factor, 1 + log₁₀(1 + quantity) ÷ 2.14,
// is the "Quantity multiplier", alone or inside its product. A product Amount × the shared multiplier × 0.05 × log₁₀ …
// is the worn food's row when one of its logs measures the worn food's quantity, and the emporium's row otherwise, its
// logs of the emporium's level, with or without the factor N.js gives it too (009 T023 r3, r4): each with its parts,
// the shared multiplier among them, so they multiply to it.
import type { RecNode } from "../recording.ts";
import { fx3 } from "./curves.ts";
import { flat } from "./expr.ts";
import type { Pair } from "./formulas.ts";
import {
  emporiumName,
  equippedName,
  GOLD_FOOD,
  measuresWorn,
  multiFormula,
} from "./gold-food.ts";
import { formulaOut, near } from "./math.ts";
import { withName } from "./row-checks.ts";
import { finish, row, valueOf } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr, Step } from "./steps.ts";
import type { Reads } from "./val-path.ts";

/** Each name by its role, with its proof by reference (the worn food's factor; the shared multiplier). */
export const GOLD_FOOD_TERMS = {
  quantity: { name: "Quantity multiplier", proof: "N.js GoldFoodBonuses" },
  multiplier: {
    name: "GFood Multi",
    proof: "N.js GoldFoodBonuses; bench pieces.cjs goldFood",
  },
};

const strip = (e: Expr): Expr => (e.t === "def" ? strip(e.e) : e);
/** The box the game keeps the shared multiplier in (N.js GoldFoodBonuses). */
const MULTI_BOX = "DNSM.GfoodBonusMULTI";
const isNum = (e: Expr, v: number) => {
  const x = strip(e);
  return x.t === "num" && Number(x.v) === v;
};

/** The shared multiplier, GFood Multi: no piece and no rows of its own. */
const shared = (v: number): Row => ({
  node: row({
    pieceKey: null,
    value: valueOf(v),
    code: null,
    name: GOLD_FOOD_TERMS.multiplier.name,
    fmt: "x",
  }),
  open: null,
});

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
  // the argument of a log call that measures the worn food, 1 + its quantity; null for any other expression
  const wornArg = (y: Expr): number | null => {
    const arg =
      y.t === "call" && nodes[y.id]?.b === "getLOG" && nodes[y.id]?.a[0];
    return measuresWorn(arg, reads) ? Number(arg) : null;
  };
  // the worn food's quantity factor, 1 + log₁₀(1 + quantity) ÷ 2.14, as its row; null for any other term (the
  // emporium's factor measures its level)
  const quantityRow = (t: Expr, o: "*" | "+"): Row | null => {
    const y = strip(t);
    const q = y.t === "op" && y.o === "+" && isNum(y.l, 1) ? strip(y.r) : null;
    const log =
      q?.t === "op" && q.o === "/" && isNum(q.r, 2.14) ? strip(q.l) : null;
    const arg = log ? wornArg(log) : null;
    if (arg === null) return null;
    const r = term(t, o);
    const f: Pair = [
      "1 + log₁₀(1 + quantity) ÷ 2.14",
      `1 + log₁₀(1 + ${fx3(arg - 1)}) ÷ 2.14 = ${fx3(Number(t.v))}`,
    ];
    return r && { ...withName(r, GOLD_FOOD_TERMS.quantity.name), f };
  };
  const factor = quantityRow(e, op);
  if (factor) return factor;
  // Amount × the shared multiplier × …, its log₁₀ loose or inside the quantity factor: the multiplier is the value of an
  // earlier step, kept in a variable or, as the game does, in a box the block reads back (009 T023 r1, r2). Read on its
  // own, the box is the chain's working value, which the chain follows into its first pools: no row here.
  const step = (t: Expr) =>
    (t.t === "def" || (t.t === "read" && t.p === MULTI_BOX)) &&
    steps.find((st) => near(st.v, t.v));
  if (x.t !== "op" || x.o !== "*") return null;
  const fs = flat(x, "*");
  const multi = fs.find(step);
  const at = multi && step(multi);
  if (!multi || !at) return null;
  const parts = fs.map((t) =>
    t === multi ? shared(Number(t.v)) : (quantityRow(t, "*") ?? term(t, "*")),
  );
  if (parts.some((p) => !p)) return null;
  // named by what its logs measure: the worn food's quantity, else the emporium's level (009 T023 r4)
  const logs = (y: Expr): Expr[] =>
    y.t === "op"
      ? [...logs(y.l), ...logs(y.r)]
      : y.t === "def"
        ? logs(y.e)
        : [y];
  const name = fs.some(
    (t) => t !== multi && logs(t).some((y) => wornArg(y) !== null),
  )
    ? equippedName(reads)
    : emporiumName(reads);
  // the shared multiplier is a value its own steps prove (the chain's first pools), with the 008's ⓘ: never a "?"
  const pair = multiFormula(
    multi.t === "read" ? at : { v: Number(multi.v), e: strip(multi) },
    reads,
  );
  const proven = (r: Row): Row =>
    r.node.name === GOLD_FOOD_TERMS.multiplier.name && r.node.code === null
      ? {
          ...r,
          node: {
            ...r.node,
            leaf: null,
            why: null,
            formula: pair && formulaOut(pair),
          },
        }
      : r;
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
    ).map(proven),
  };
}
