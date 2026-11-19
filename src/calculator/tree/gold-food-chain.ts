// A golden food computed as a chain of steps (spec 009, FR-007, FR-008, FR-017; 009 r2): two terms of its steps that the
// rules of names leave with no name of their own get one by their role in GoldFoodBonuses (tree/gold-food.ts), the
// names the Vinicius chose, in English as every tree. The worn food's quantity factor, 1 + log₁₀(1 + quantity) ÷ 2.14,
// is the "Quantity multiplier", alone or inside its product. A product Amount × the shared multiplier × 0.05 × log₁₀ …
// is the worn food's row when one of its logs measures the worn food's quantity, and the emporium's row otherwise, its
// logs of the emporium's level, with or without the factor N.js gives it too (009 T023 r3, r4): each with its parts,
// the shared multiplier among them, so they multiply to it. The worn food's step of a chain, whose running total is the
// shared multiplier, is the same row with no multiplier among its parts (`wornStep`, the rule of 19/11).
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
  sourceTerm,
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
  // bonus = Amount × multi × 0.05 × …: the block's one literal 0.05 (the Vinicius's name of 19/11)
  rate: { name: "Base rate (× 0.05)", proof: "N.js GoldFoodBonuses" },
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

/** How a golden food's block names its terms: its one 0.05, its logs, and what they measure. */
function helpersOf({ nodes, reads, term }: GoldFoodBlock) {
  const rateRow = (t: Expr, o: "*" | "+"): Row | null => {
    const r = isNum(t, 0.05) ? term(t, o) : null;
    return r && withName(r, GOLD_FOOD_TERMS.rate.name);
  };
  // the argument of a log call that measures the worn food, 1 + its quantity; null for any other expression
  const wornArg = (y: Expr): number | null => {
    const arg =
      y.t === "call" && nodes[y.id]?.b === "getLOG" && nodes[y.id]?.a[0];
    return measuresWorn(arg, reads) ? Number(arg) : null;
  };
  // a log₁₀ call, or the factor 1 + log₁₀(…) ÷ 2.14, with the argument of its log; null for any other term
  const logArg = (t: Expr): number | null => {
    const y = strip(t);
    return y.t === "call" && nodes[y.id]?.b === "getLOG"
      ? Number(nodes[y.id]?.a[0])
      : null;
  };
  const mathOf = (t: Expr): { kind: "log" | "factor"; arg: number } | null => {
    const log = logArg(t);
    if (log !== null) return { kind: "log", arg: log };
    const y = strip(t);
    const q = y.t === "op" && y.o === "+" && isNum(y.l, 1) ? strip(y.r) : null;
    const inner =
      q?.t === "op" && q.o === "/" && isNum(q.r, 2.14) ? logArg(q.l) : null;
    return inner === null ? null : { kind: "factor", arg: inner };
  };
  // the calls and reads of a term, through its ops and variables
  const logs = (y: Expr): Expr[] =>
    y.t === "op"
      ? [...logs(y.l), ...logs(y.r)]
      : y.t === "def"
        ? logs(y.e)
        : [y];
  return { rateRow, wornArg, mathOf, logs };
}
type Helpers = ReturnType<typeof helpersOf>;

/** Term `e` of a golden food's step, named by its role; null for any other term or block (the assembly's row). */
export function goldFoodTerm(
  e: Expr,
  op: "*" | "+",
  ctx: GoldFoodBlock,
): Row | null {
  const { steps, term } = ctx;
  if (!GOLD_FOOD.test.test(ctx.block.b)) return null;
  const h = helpersOf(ctx);
  const x = strip(e);
  const rate = h.rateRow(e, op);
  if (rate) return rate;
  // the worn food's quantity factor, 1 + log₁₀(1 + quantity) ÷ 2.14, as its row; null for any other term (the
  // emporium's factor measures its level)
  const quantityRow = (t: Expr, o: "*" | "+"): Row | null => {
    const y = strip(t);
    const q = y.t === "op" && y.o === "+" && isNum(y.l, 1) ? strip(y.r) : null;
    const log =
      q?.t === "op" && q.o === "/" && isNum(q.r, 2.14) ? strip(q.l) : null;
    const arg = log ? h.wornArg(log) : null;
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
  return productRow(fs, Number(e.v), { t: multi, at }, h, ctx);
}

/**
 * The worn food's step of a golden food's chain (spec 009, FR-005, FR-008; the rule of 19/11): its factors `terms`, but
 * its running total (the shared multiplier the chain reads back, N.js GoldFoodBonuses), as one row, "Equipped: <the
 * food>", never a row per factor; null for any other step or block.
 */
export function wornStep(
  terms: readonly Expr[],
  ctx: GoldFoodBlock,
): Row | null {
  if (!GOLD_FOOD.test.test(ctx.block.b)) return null;
  const h = helpersOf(ctx);
  // a log of its own, or its quantity factor, measures the worn food's quantity
  const worn = (t: Expr) => {
    const m = h.mathOf(t);
    return !!m && measuresWorn(m.arg, ctx.reads);
  };
  if (!terms.some(worn)) return null;
  const v = terms.reduce((a, t) => a * Number(t.v), 1);
  return productRow([...terms], v, null, h, ctx);
}

/**
 * A golden food's product `fs` of value `v` as its row (009 T023 r3, r4): named by what its logs measure, the worn food's
 * quantity, else the emporium's level; its parts, with the shared multiplier `multi` among them when it is one of them.
 * 19/11: a log₁₀ and the factor 1 + log₁₀(…) ÷ 2.14 are math, no rows: they go to the product's ⓘ, and the product's
 * leaf is what goes into them (N.js GoldFoodBonuses: log₁₀(1 + q) of the worn food's quantity q, log₁₀(1 + 10³·10^L)
 * of the Beanstalk's level L): q = the log's argument − 1, the quantity of the slot whose step this is.
 */
function productRow(
  fs: Expr[],
  v: number,
  multi: { t: Expr; at: Step } | null,
  h: Helpers,
  { reads, term }: GoldFoodBlock,
): Row | null {
  const own = (t: Expr) => t !== multi?.t;
  const worn = fs.some(
    (t) => own(t) && h.logs(t).some((y) => h.wornArg(y) !== null),
  );
  const name = worn ? equippedName(reads) : emporiumName(reads);
  const maths = fs.flatMap((t) => {
    const m = own(t) ? h.mathOf(t) : null;
    return m ? [{ t, ...m }] : [];
  });
  const parts = fs
    .filter((t) => !maths.some((m) => m.t === t))
    .map((t) =>
      own(t) ? (h.rateRow(t, "*") ?? term(t, "*")) : shared(Number(t.v)),
    );
  if (parts.some((p) => !p)) return null;
  const arg = maths[0]?.arg;
  const leaf =
    arg === undefined
      ? null
      : worn
        ? part("Quantity", arg - 1)
        : part("Beanstalk level", Math.log10((arg - 1) / 1e3));
  // what goes into the log, in words and in numbers, the same shape
  const lv = fx3(Number(leaf?.node.value));
  const [what, whatV] = worn
    ? ["1 + Quantity", `1 + ${lv}`]
    : ["1 + 1000 × 10^Beanstalk level", `1 + 1000 × 10^${lv}`];
  const shown = (t: Expr, i: number) => {
    const m = maths.find((y) => y.t === t);
    const log = (s: string) => `log₁₀(${s})`;
    if (m)
      return m.kind === "log"
        ? [log(what), log(whatV)]
        : [`(1 + ${log(what)} ÷ 2.14)`, `(1 + ${log(whatV)} ÷ 2.14)`];
    const r = parts[fs.filter((y) => !maths.some((n) => n.t === y)).indexOf(t)];
    return [r ? sourceTerm(r) : String(i), fx3(Number(t.v))];
  };
  const f: Pair | null = maths.length
    ? [
        fs.map((t, i) => shown(t, i)[0]).join(" × "),
        `${fs.map((t, i) => shown(t, i)[1]).join(" × ")} = ${fx3(v)}`,
      ]
    : null;
  // the shared multiplier is a value its own steps prove (the chain's first pools), with the 008's ⓘ: never a "?"
  const pair =
    multi &&
    multiFormula(
      multi.t.t === "read"
        ? multi.at
        : { v: Number(multi.t.v), e: strip(multi.t) },
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
      value: valueOf(v),
      code: null,
      ...(name === null ? {} : { name }),
    }),
    open: null,
    ...(f ? { f } : {}),
    group: finish(
      v,
      [...parts.flatMap((p) => p ?? []), ...(leaf ? [leaf] : [])],
      !maths.length,
    ).map(proven),
  };
}

/** A leaf of the pass with a fixed name: what goes into a golden food's logs (19/11). */
const part = (name: string, v: number): Row => ({
  node: row({ pieceKey: null, value: valueOf(v), code: null, name }),
  open: null,
});
