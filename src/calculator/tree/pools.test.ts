// The game's pools of a tree's first level (spec 009, FR-005, FR-008, research R1, revised on 17/11): the root's sum
// is one Additive pool; in its product, a factor that sums two sources or more is an Additive pool, one that sums
// bonuses inside 1 + (…) ÷ 100 its own Multi pool, and the single multipliers in a row share one Multi pool; a root no
// sum and no product gives (a max at the top) has no pool. Invented paths and values, apart from the game's own block
// names the system rules read.
import { expect, test } from "vitest";
import {
  chainPools,
  poolsFormula,
  poolsOf,
  poolsPair,
  rootExtreme,
} from "./pools.ts";
import type { Pool } from "./pools.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr, Step } from "./steps.ts";
import { branch, fixed, read } from "./tree-fixture.ts";

const src = (code: string, value: number): Row => ({
  node: row({ pieceKey: code, value, code, name: `Bonus ${code}` }),
  open: null,
});
// the expression of the root's step, written by hand
const num = (v: number): Expr => ({ t: "num", v });
const at = (p: string, v: number): Expr => ({ t: "read", p, v });
const op = (o: string, l: Expr, r: Expr, v: number): Expr => ({
  t: "op",
  o,
  l,
  r,
  v,
});
/** A term of the step as a row: a read is its source, a product its branch, a number its constant. */
function term(e: Expr): Row | null {
  if (e.t === "read") return src(e.p, Number(e.v));
  if (e.t === "num") return fixed(`Fixed +${String(e.v)}`, Number(e.v));
  if (e.t === "op")
    return branch(
      Number(e.v),
      [term(e.l), term(e.r)].flatMap((r) => (r ? [r] : [])),
    );
  return null;
}

const brief = (p: Pool) => [
  p.name,
  p.kind,
  p.combine,
  p.value,
  p.rows.map((r) => r.node.value),
];

test("a root that sums is one Additive pool of its rows", () => {
  const rows = [src("Stats.a", 1), src("Stats.b", 2), src("Stats.c", 4)];
  expect(poolsOf(rows, { value: 7 })?.map(brief)).toEqual([
    ["Additive pool", "additive", "sum", 7, [1, 2, 4]],
  ]);
});

test("rows that both add up and multiply to the root follow the step's top: a sum is one pool", () => {
  // 1 + 2 + 3 = 1 × 2 × 3
  const rows = [src("Stats.a", 1), src("Stats.b", 2), src("Stats.c", 3)];
  const sum = op(
    "+",
    op("+", at("Stats.a", 1), at("Stats.b", 2), 3),
    at("Stats.c", 3),
    6,
  );
  expect(poolsOf(rows, { value: 6, expr: sum })?.map(brief)).toEqual([
    ["Additive pool", "additive", "sum", 6, [1, 2, 3]],
  ]);
  expect(poolsOf(rows, { value: 6 })?.map((p) => p.name)).toEqual([
    "Multi pool",
  ]);
  // with no step, the level's own rule decides: its rows' share in a sum
  const summed = rows.map((r) => ({
    ...r,
    node: { ...r.node, shareMode: "sum" as const },
  }));
  expect(poolsOf(summed, { value: 6 })?.map((p) => p.name)).toEqual([
    "Additive pool",
  ]);
});

test("a root that multiplies single multipliers has one Multi pool of its factors, in the game's order", () => {
  const rows = [src("Stats.a", 2), src("Stats.b", 3), src("Stats.c", 4)];
  expect(poolsOf(rows, { value: 24 })?.map(brief)).toEqual([
    ["Multi pool", "multi", "product", 24, [2, 3, 4]],
  ]);
});

test("the parts at ×1 and at 0 are factors and terms like the others, in their places (FR-016)", () => {
  const ones = [src("Stats.a", 2), src("Stats.b", 1), src("Stats.c", 1)];
  expect(poolsOf(ones, { value: 2 })?.map(brief)).toEqual([
    ["Multi pool", "multi", "product", 2, [2, 1, 1]],
  ]);
  const zero = [src("Stats.a", 5), src("Stats.c", 0)];
  expect(poolsOf(zero, { value: 5 })?.map(brief)).toEqual([
    ["Additive pool", "additive", "sum", 5, [5, 0]],
  ]);
});

// Forge stats 2: (5 × x + 30 × y + 100) × (1 + m ÷ 100)
const forge = op(
  "*",
  op(
    "+",
    op(
      "+",
      op("*", num(5), at("Stats.x", 96), 480),
      op("*", num(30), at("Stats.y", 6), 180),
      660,
    ),
    num(100),
    760,
  ),
  op("+", num(1), op("/", at("Stats.m", 1500), num(100), 15), 16),
  12160,
);

test("a factor that sums two sources is an Additive pool of its terms; one of a single source, a Multi pool", () => {
  // the assembly's rows: each factor a branch of its parts (tree/terms.ts exprRow)
  const rows = [
    branch(760, [read("Stats.x", 96), read("Stats.y", 6)]),
    branch(16, [read("Stats.m", 1500)]),
  ];
  const pools = poolsOf(rows, { value: 12160, expr: forge }, term);
  expect(pools?.map(brief)).toEqual([
    ["Additive pool", "additive", "sum", 760, [480, 180, 100]],
    ["Multi pool", "multi", "product", 16, [16]],
  ]);
  expect(pools && poolsFormula(pools, 12160)).toEqual([
    ["Additive pool", "×", "Multi pool"],
    [760, 16, 12160],
  ]);
});

test("a factor 1 + (bonuses) ÷ 100 is its own Multi pool of its percents; the single multipliers share the next", () => {
  // Prod Spd Bonus: (1 + (s + 2 × a) ÷ 100) × b × p × g
  const pct = op(
    "+",
    num(1),
    op(
      "/",
      op(
        "+",
        at("CardBonusREAL(10, 0)", 30),
        op("*", num(2), at("GetTalentNumber(1, 207)", 25), 50),
        80,
      ),
      num(100),
      0.8,
    ),
    1.8,
  );
  const expr = op(
    "*",
    op("*", op("*", pct, at("Stats.b", 2), 3.6), at("Stats.p", 1.5), 5.4),
    at("Stats.g", 1.2),
    6.48,
  );
  const rows = [
    branch(1.8, [
      read("CardBonusREAL(10, 0)", 30),
      read("GetTalentNumber(1, 207)", 25),
    ]),
    src("Stats.b", 2),
    src("Stats.p", 1.5),
    src("Stats.g", 1.2),
  ];
  const pools = poolsOf(rows, { value: 6.48, expr }, term);
  expect(pools?.map(brief)).toEqual([
    ["Multi pool 1", "multi", "onePlusPercent", 1.8, [30, 50]],
    ["Multi pool 2", "multi", "product", expect.closeTo(3.6, 9), [2, 1.5, 1.2]],
  ]);
  expect(pools && poolsFormula(pools, 6.48)).toEqual([
    ["Multi pool 1", "×", "Multi pool 2"],
    [1.8, 3.6, 6.48],
  ]);
});

test("a factor the step's expression does not give stays a single multiplier of its row", () => {
  // the step's first factor is 760 (480 + 180 + 100), never this row's 700
  const rows = [
    branch(700, [read("Stats.x", 96)]),
    branch(16, [read("Stats.m", 1500)]),
  ];
  const pools = poolsOf(rows, { value: 11200, expr: forge }, term);
  expect(pools?.map(brief)).toEqual([
    ["Multi pool", "multi", "product", 11200, [700, 16]],
  ]);
});

test("a root with max() at the top keeps its sources: no pool", () => {
  const rows = [src("Stats.a", 8), src("Stats.b", 6), src("Stats.c", 4)];
  expect(poolsOf(rows, { value: 8 })).toBeNull();
});

test("one pool needs no ⓘ at the root", () => {
  const rows = [src("Stats.a", 1), src("Stats.b", 2)];
  const pools = poolsOf(rows, { value: 3 });
  expect(pools && poolsFormula(pools, 3)).toBeNull();
});

const fn = (name: string, args: Expr[], v: number): Expr => ({
  t: "fn",
  name,
  args,
  v,
});

test("a root with a max or a min at the top has no pool, and its groups take its max or its min", () => {
  const rows = [src("Stats.a", 8), src("Stats.b", 6), src("Stats.c", 4)];
  const args = [at("Stats.a", 8), at("Stats.b", 6), at("Stats.c", 4)];
  expect(rootExtreme(rows, { value: 8, expr: fn("max", args, 8) })).toBe("max");
  expect(rootExtreme(rows, { value: 4, expr: fn("min", args, 4) })).toBe("min");
  // the rows must give the root by that same rule
  expect(rootExtreme(rows, { value: 9, expr: fn("max", args, 9) })).toBeNull();
  // no step, or a step whose top is no max nor min
  expect(rootExtreme(rows, { value: 8 })).toBeNull();
  expect(
    rootExtreme(rows, { value: 8, expr: fn("floor", args, 8) }),
  ).toBeNull();
});

// The chain of the game's steps (FR-005, rule Y of 17/11): each step adds to or multiplies the total the step before it
// gave: a value with no source, or a working value the root's own call wrote and reads back (the recording tells the two
// apart, not the game); a cache another call wrote is a term. Sums in a row are an Additive pool, single
// multipliers in a row one Multi pool, a factor that sums bonuses inside 1 + (…) ÷ 100 its own; each change of + to ×
// opens a pool. A term of a step is its row as tree/terms.ts makes it: here a read is its source, a number its constant.
const val = (v: number): Expr => ({ t: "val", v });
/** The pools of a chain, or null for an open one or none. */
const listOf = (p: Pool[] | "open" | null) => (Array.isArray(p) ? p : null);
const termAt = (e: Expr): Row | null =>
  e.t === "read"
    ? src(e.p, Number(e.v))
    : e.t === "num"
      ? fixed(`Fixed +${String(e.v)}`, Number(e.v))
      : null;
const percent = (a: Expr, b: Expr, v: number): Expr =>
  op("+", num(1), op("/", op("+", a, b, (v - 1) * 100), num(100), v - 1), v);
// sum 37 → + 2 → × 6 → + 0.5 → × 2 × 3
const CHAIN: Step[] = [
  { v: 37, e: op("+", at("Stats.a", 30), at("Stats.b", 7), 37) },
  { v: 39, e: op("+", val(37), num(2), 39) },
  { v: 234, e: op("*", val(39), at("Stats.m", 6), 234) },
  { v: 234.5, e: op("+", val(234), num(0.5), 234.5) },
  {
    v: 1407,
    e: op(
      "*",
      op("*", val(234.5), at("Stats.p", 2), 469),
      at("Stats.q", 3),
      1407,
    ),
  },
];

test("a chain of steps gives a pool per run of sums or of multipliers, in the game's order, each closing", () => {
  const pools = listOf(chainPools(CHAIN, { value: 1407 }, termAt));
  expect(pools?.map(brief)).toEqual([
    ["Additive pool 1", "additive", "sum", 39, [30, 7, 2]],
    ["Multi pool 1", "multi", "product", 6, [6]],
    ["Additive pool 2", "additive", "sum", 0.5, [0.5]],
    ["Multi pool 2", "multi", "product", 6, [2, 3]],
  ]);
  expect(pools && poolsPair(pools, 1407)).toEqual([
    "(Additive pool 1 × Multi pool 1 + Additive pool 2) × Multi pool 2",
    "(39 × 6 + 0.5) × 6 = 1407",
  ]);
  // the ⓘ closes with the numbers, and the main takes it
  expect(pools && poolsFormula(pools, 1407)).toEqual([
    [
      "(",
      "Additive pool 1",
      "×",
      "Multi pool 1",
      "+",
      "Additive pool 2",
      ")",
      "×",
      "Multi pool 2",
    ],
    [39, 6, 0.5, 6, 1407],
  ]);
});

test("single multipliers of steps in a row share one Multi pool; a factor that sums bonuses inside is its own", () => {
  const steps: Step[] = [
    { v: 20, e: op("+", at("Stats.a", 10), at("Stats.b", 10), 20) },
    { v: 40, e: op("*", val(20), at("Stats.m", 2), 40) },
    {
      v: 180,
      e: op(
        "*",
        op("*", val(40), at("Stats.n", 3), 120),
        percent(
          at("CardBonusREAL(10, 0)", 30),
          at("GetTalentNumber(1, 207)", 20),
          1.5,
        ),
        180,
      ),
    },
    { v: 720, e: op("*", val(180), at("Stats.g", 4), 720) },
  ];
  expect(listOf(chainPools(steps, { value: 720 }, termAt))?.map(brief)).toEqual(
    [
      ["Additive pool", "additive", "sum", 20, [10, 10]],
      ["Multi pool 1", "multi", "product", 6, [2, 3]],
      ["Multi pool 2", "multi", "onePlusPercent", 1.5, [30, 20]],
      ["Multi pool 3", "multi", "product", 4, [4]],
    ],
  );
});

test("a working value the root's call wrote and reads back links the chain; one another call wrote stays a term", () => {
  const steps: Step[] = [
    CHAIN[0] ?? { v: 0, e: num(0) },
    { v: 39, e: op("+", at("DNSM.Run.v", 37), num(2), 39) },
    ...CHAIN.slice(2),
  ];
  const pools = (own: boolean) =>
    chainPools(steps, { value: 1407 }, termAt, () => own);
  expect(listOf(pools(true))?.map(brief)).toEqual([
    ["Additive pool 1", "additive", "sum", 39, [30, 7, 2]],
    ["Multi pool 1", "multi", "product", 6, [6]],
    ["Additive pool 2", "additive", "sum", 0.5, [0.5]],
    ["Multi pool 2", "multi", "product", 6, [2, 3]],
  ]);
  expect(listOf(pools(false))?.map(brief)).toEqual([
    ["Additive pool 1", "additive", "sum", 39, [37, 2]],
    ["Multi pool 1", "multi", "product", 6, [6]],
    ["Additive pool 2", "additive", "sum", 0.5, [0.5]],
    ["Multi pool 2", "multi", "product", 6, [2, 3]],
  ]);
});

test("a root of one step is no chain; a chain whose pools do not give the root is open, which the caller logs", () => {
  expect(chainPools(CHAIN.slice(0, 1), { value: 37 }, termAt)).toBeNull();
  // no step gives the root: no chain
  expect(chainPools(CHAIN, { value: 1400 }, termAt)).toBeNull();
  // the pools of the steps do not give the root
  const off = (e: Expr) =>
    e.t === "num" && e.v === 2 ? fixed("Fixed +2", 3) : termAt(e);
  expect(chainPools(CHAIN, { value: 1407 }, off)).toBe("open");
  // a term the assembly cannot make a row of
  expect(chainPools(CHAIN, { value: 1407 }, () => null)).toBe("open");
  // a step that takes the total but neither adds nor multiplies (a floor)
  const floor: Step[] = [
    ...CHAIN.slice(0, 2),
    { v: 39, e: { t: "fn", name: "floor", args: [val(39)], v: 39 } },
    { v: 41, e: op("+", val(39), num(2), 41) },
  ];
  expect(chainPools(floor, { value: 41 }, termAt)).toBe("open");
});
