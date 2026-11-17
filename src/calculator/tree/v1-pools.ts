// The Drop Rate's first level as the V1 of the bench (spec 009, FR-005, FR-010, research R1): the four pools that
// build-v1mold.cjs builds by hand from the steps of TotalStats("Drop_Rarity") (its `tree`), keyed by the catalog id.
// The steps are read by their shape, never by their place alone: a recording whose steps lack that shape, or whose
// numbers do not close, gets the general pools (tree/pools.ts), never a wrong tree.
import { fx3 } from "./curves.ts";
import { flat, topOp } from "./expr.ts";
import { near, vOf } from "./formulas.ts";
import { formulaOut } from "./math.ts";
import { bySystem, mould, poolRow } from "./mould.ts";
import type { WriterOf } from "./mould.ts";
import { finish, row, withShares } from "./rows.ts";
import type { Node, Row } from "./rows.ts";
import type { Expr, Step } from "./steps.ts";

/** What the V1 reads of the root's call: all its steps, a term of one of them as a row, a cache's writer. */
export interface V1Context {
  steps: readonly Step[];
  /** A term of step `at` as the assembly makes it (tree/terms.ts `term`, in that step's turn). */
  termAt: (e: Expr, op: "*" | "+", at: number) => Row | null;
  writerOf: WriterOf;
  root: { name: string; value: Node["value"] };
}
interface Level {
  rows: Row[];
  formula: Node["formula"];
}
interface V1Mould {
  /** The V1's pools, in its order, each with the proof of its rule. */
  pools: readonly { name: string; proof: string }[];
  level(ctx: V1Context): Level | null;
}

/** The chain's own numbers after the Total Sum, as the V1 names them (`post`), by how the step takes them. */
const V1_FIXED: readonly { op: "*" | "+"; v: number; name: string }[] = [
  // H1-BUNDLE: CM.GemPopupBundleMessages.bun_v, the pack of the Death Bringer masterclass
  { op: "+", v: 2, name: "Death Bringer Pack" },
  // N.js TotalStats: 1 <= OptionsListAccount[232]
  { op: "+", v: 0.3, name: "Sneaking Mastery" },
  // H1-BUNDLE: CM.GemPopupBundleMessages.bun_p (no display name in the game's tables)
  { op: "*", v: 1.2, name: "Gem shop bundle" },
];
/** The cache that holds the second LUK part, which the V1 opens into the terms of the step that wrote it. */
const LUK2 = "DNSM.DropRateLUK2";

const isNum = (e: Expr | undefined, v: number) =>
  e?.t === "num" && Number(e.v) === v;
/** The Total Sum step's terms: 1, the LUK Scaling (a product) and the bonuses ÷ 100. */
function totalSum(e: Expr): { luk: Expr; bonuses: Expr } | null {
  const ts = flat(e, "+");
  const div = ts.find((x) => x.t === "op" && x.o === "/" && isNum(x.r, 100));
  const luk = ts.find((x) => x.t === "op" && x.o === "*");
  if (ts.length !== 3 || !ts.some((x) => isNum(x, 1))) return null;
  return div?.t === "op" && luk ? { luk, bonuses: div.l } : null;
}

/** A pool whose value its rows do not give (the V1's Total Sum and Post-Processing): its own ⓘ, no rule to redo it. */
function ownPool(
  name: string,
  kind: "additive" | "multi",
  value: number,
  rows: Row[],
  pair: [string, string] | null,
  known: string[] = [],
): Row {
  const node = row({
    pieceKey: null,
    value,
    code: null,
    name,
    role: "pool",
    combine: null,
    poolKind: kind,
    fmt: kind === "multi" ? "x" : null,
    flags: { closed: true },
    formula: pair && formulaOut(pair, known),
  });
  return { node, open: null, group: withShares(node, pair, rows).rows };
}

function dropRate({ steps, termAt, writerOf, root }: V1Context): Level | null {
  const v = root.value;
  const at = steps.findIndex((s) => totalSum(s.e) !== null);
  const total = steps[at];
  const parts = total && totalSum(total.e);
  if (!total || !parts || typeof v !== "number") return null;
  const rowsOf = (es: Expr[], op: "*" | "+", i: number): Row[] | null => {
    const rs = es.map((e) => termAt(e, op, i));
    return rs.every((r) => r !== null) ? rs : null;
  };
  // LUK Scaling: 1.4 × the LUK curve
  const lukV = Number(parts.luk.v);
  const luk = rowsOf(flat(parts.luk, "*"), "*", at);
  // Additive Pool: the bonuses, the second LUK part's terms in its place (the step before that wrote its value)
  const bonusV = Number(parts.bonuses.v);
  const adds = flat(parts.bonuses, "+").flatMap((e) => {
    const j = steps.findLastIndex((s, k) => k < at && near(s.v, Number(e.v)));
    const w = steps[j];
    return e.t === "read" && e.p === LUK2 && w && topOp(w.e) === "+"
      ? (rowsOf(flat(w.e, "+"), "+", j) ?? [null])
      : [termAt(e, "+", at)];
  });
  const product = (rs: readonly Row[]) => rs.reduce((p, r) => p * vOf(r), 1);
  const sum = (rs: readonly Row[]) => rs.reduce((s, r) => s + vOf(r), 0);
  if (!luk || !near(product(luk), lukV)) return null;
  if (!adds.every((r) => r !== null) || !near(sum(adds), bonusV)) return null;
  // Post-Processing: the chain after the Total Sum, its steps of one term in place, then the multipliers by system
  const singles: Row[] = [];
  const mults: Row[] = [];
  let prev = total.v;
  for (const [k, s] of steps.entries()) {
    const op = topOp(s.e);
    if (k <= at) continue;
    if (!op) return null;
    const ts = flat(s.e, op);
    const run = ts.findIndex(
      (x) => ["val", "read", "def"].includes(x.t) && near(Number(x.v), prev),
    );
    const rest = ts.filter((_, i) => i !== run);
    if (run < 0 || (mults.length && op === "+")) return null;
    const one = rest.length === 1 && !mults.length ? rest[0] : undefined;
    const fixed =
      one?.t === "num" &&
      V1_FIXED.find((f) => f.op === op && near(Number(one.v), f.v));
    const rs = fixed
      ? [
          {
            node: row({
              pieceKey: null,
              value: fixed.v,
              code: null,
              name: fixed.name,
              leaf: "fixedValue",
              fmt: op === "*" ? "x" : "+",
              flags: {},
            }),
            open: null,
          },
        ]
      : mould(rowsOf(rest, op, k) ?? []);
    if (rs.length !== rest.length) return null;
    (one ? singles : mults).push(...rs);
    prev = s.v;
  }
  if (!near(prev, v)) return null;
  const totalV = total.v;
  const postV = v / totalV;
  const pools = [
    poolRow(
      {
        kind: "multi",
        name: "LUK Scaling",
        value: lukV,
        rows: finish(lukV, mould(luk), true),
        combine: "product",
      },
      writerOf,
    ),
    poolRow(
      {
        kind: "additive",
        name: "Additive Pool",
        value: bonusV,
        rows: finish(bonusV, mould(adds), false),
        combine: "sum",
      },
      writerOf,
    ),
    ownPool(
      "Total Sum",
      "additive",
      totalV,
      mould(rowsOf([{ t: "num", v: 1 }], "+", at) ?? []),
      [
        "1 + LUK Scaling + Additive Pool ÷ 100",
        `1 + ${fx3(lukV)} + ${fx3(bonusV)} ÷ 100 = ${fx3(totalV)}`,
      ],
      ["LUK Scaling", "Additive Pool"],
    ),
    ownPool(
      "Post-Processing",
      "multi",
      postV,
      [
        ...finish(postV, singles, false),
        ...bySystem(finish(product(mults), mults, true), "product", writerOf),
      ],
      null,
    ),
  ];
  const pair: [string, string] = [
    "Total Sum × Post-Processing",
    `${fx3(totalV)} × ${fx3(postV)} = ${fx3(v)}`,
  ];
  return {
    rows: withShares(root, pair, pools).rows,
    formula: formulaOut(pair, ["Total Sum", "Post-Processing"]),
  };
}

/** The V1 moulds of the bench, by catalog id: only the Drop Rate has one (spec Out of Scope, "Molde feito à mão"). */
export const V1_POOLS: Readonly<Partial<Record<string, V1Mould>>> = {
  dropRate: {
    pools: [
      {
        name: "LUK Scaling",
        proof:
          "bench build-v1mold.cjs tree, LUK Scaling: 1.4 × the LUK curve, the product term of the Total Sum step",
      },
      {
        name: "Additive Pool",
        proof:
          "bench build-v1mold.cjs adds: the bonuses ÷ 100 of the Total Sum step, the second LUK part by the step that wrote it",
      },
      {
        name: "Total Sum",
        proof:
          "bench build-v1mold.cjs tree, Total Sum: the step 1 + LUK Scaling + Additive Pool ÷ 100",
      },
      {
        name: "Post-Processing",
        proof:
          "bench build-v1mold.cjs post: the Drop Rate ÷ the Total Sum; the steps of one term of the chain in place, then the multipliers by system",
      },
    ],
    level: dropRate,
  },
};

/** The first level of catalog id `id` as its V1 mould, when it has one and its steps have the V1's shape; else null. */
export function v1Level(id: string, ctx: V1Context): Level | null {
  const m = Object.hasOwn(V1_POOLS, id) ? V1_POOLS[id] : undefined;
  return m ? m.level(ctx) : null;
}
