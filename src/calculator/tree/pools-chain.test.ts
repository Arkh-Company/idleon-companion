// The pools of a chain of the game's steps (spec 009, FR-005, rule Y of 17/11), apart from the pools of one step in
// pools.test.ts. Invented paths and values, apart from the game's own block names the system rules read.
import { expect, test } from "vitest";
import { chainPools, poolsFormula, poolsPair, through } from "./pools.ts";
import type { Pool } from "./pools.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr, Step } from "./steps.ts";
import { fixed } from "./tree-fixture.ts";
import { poolRows } from "./mould.ts";

const noWriter = () => undefined;

const src = (code: string, value: number): Row => ({
  node: row({ pieceKey: code, value, code, name: `Bonus ${code}` }),
  open: null,
});
// the expression of a step, written by hand
const num = (v: number): Expr => ({ t: "num", v });
const at = (p: string, v: number): Expr => ({ t: "read", p, v });
const op = (o: string, l: Expr, r: Expr, v: number): Expr => ({
  t: "op",
  o,
  l,
  r,
  v,
});
const brief = (p: Pool) => [
  p.name,
  p.kind,
  p.combine,
  p.value,
  p.rows.map((r) => r.node.value),
];

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
  // decision of 19/11 (audit family 25): a lone part added between multiplications is its own "+ N" row, no pool
  expect(pools?.map(brief)).toEqual([
    ["Additive pool", "additive", "sum", 39, [30, 7, 2]],
    ["Multi pool 1", "multi", "product", 6, [6]],
    ["Fixed +0.5", "additive", "sum", 0.5, [0.5]],
    ["Multi pool 2", "multi", "product", 6, [2, 3]],
  ]);
  expect(pools && poolsPair(pools, 1407)).toEqual([
    "(Additive pool × Multi pool 1 + Fixed +0.5) × Multi pool 2",
    "(39 × 6 + 0.5) × 6 = 1407",
  ]);
  const first =
    pools && poolRows(pools, { name: "Total", value: 1407 }, noWriter);
  expect(
    first?.rows.map((r) => [
      r.node.name,
      r.node.role,
      r.node.fmt,
      r.node.value,
    ]),
  ).toEqual([
    ["Additive pool", "pool", null, 39],
    ["Multi pool 1", "pool", "x", 6],
    ["Fixed +0.5", "piece", "+", 0.5],
    ["Multi pool 2", "pool", "x", 6],
  ]);
  // the ⓘ closes with the numbers, and the main takes it
  expect(pools && poolsFormula(pools, 1407)).toEqual([
    [
      "(",
      "Additive pool",
      "×",
      "Multi pool 1",
      "+",
      "Fixed +0.5",
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
    ["Additive pool", "additive", "sum", 39, [30, 7, 2]],
    ["Multi pool 1", "multi", "product", 6, [6]],
    ["Fixed +0.5", "additive", "sum", 0.5, [0.5]],
    ["Multi pool 2", "multi", "product", 6, [2, 3]],
  ]);
  expect(listOf(pools(false))?.map(brief)).toEqual([
    ["Additive pool", "additive", "sum", 39, [37, 2]],
    ["Multi pool 1", "multi", "product", 6, [6]],
    ["Fixed +0.5", "additive", "sum", 0.5, [0.5]],
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
  // a step that takes the total but neither adds nor multiplies (a floor that changes it)
  const floor: Step[] = [
    ...CHAIN.slice(0, 1),
    { v: 39.5, e: op("+", val(37), num(2.5), 39.5) },
    { v: 39, e: { t: "fn", name: "floor", args: [val(39.5)], v: 39 } },
    { v: 41, e: op("+", val(39), num(2), 41) },
  ];
  expect(chainPools(floor, { value: 41 }, termAt)).toBe("open");
  // T025: a floor that changes nothing is read through, to the step it takes
  const same: Step[] = [
    ...CHAIN.slice(0, 2),
    { v: 39, e: { t: "fn", name: "floor", args: [val(39)], v: 39 } },
    { v: 41, e: op("+", val(39), num(2), 41) },
  ];
  expect(listOf(chainPools(same, { value: 41 }, termAt))?.map(brief)).toEqual([
    ["Additive pool", "additive", "sum", 41, [30, 7, 2, 2]],
  ]);
  // with `single`, a root of one step is its step's terms
  expect(
    listOf(
      chainPools(CHAIN.slice(0, 1), { value: 37 }, termAt, undefined, true),
    )?.map(brief),
  ).toEqual([["Additive pool", "additive", "sum", 37, [30, 7]]]);
});

test("a round, a floor or a clamp is read through only when it changes nothing at all, in a big number too (009 r1)", () => {
  // floor(1234567.9) = 1234567: within a millionth, yet the floor cuts 0.9
  const big = op("+", at("Stats.a", 1234567.4), at("Stats.b", 0.5), 1234567.9);
  const floor: Expr = { t: "fn", name: "floor", args: [big], v: 1234567 };
  expect(through(floor, 1234567)).toBe(floor);
  const steps: Step[] = [
    { v: 1234567.9, e: big },
    {
      v: 1234567,
      e: { t: "fn", name: "floor", args: [val(1234567.9)], v: 1234567 },
    },
    { v: 1234569, e: op("+", val(1234567), num(2), 1234569) },
  ];
  expect(chainPools(steps, { value: 1234569 }, termAt)).toBe("open");
  // a clamp that cuts a little is no clamp read through either
  const max: Expr = {
    t: "fn",
    name: "max",
    args: [num(1234567.5), big],
    v: 1234567.9,
  };
  expect(through(max, 1234567.5)).toBe(max);
  // one that changes nothing is
  const whole = op("+", at("Stats.a", 1234567), at("Stats.b", 2), 1234569);
  expect(
    through({ t: "fn", name: "floor", args: [whole], v: 1234569 }, 1234569),
  ).toBe(whole);
});

test("a running total links the chain before a multiplier kept in a variable, whatever the order of the factors", () => {
  const set = op("*", at("Stats.x", 2), at("Stats.y", 2.5), 5);
  const def: Expr = { t: "def", e: set, v: 5 };
  const steps = (e: Expr): Step[] => [
    { v: 5, e: set },
    { v: 20, e: op("+", at("Stats.a", 10), at("Stats.b", 10), 20) },
    { v: 100, e },
  ];
  // the variable is a factor of its own: its row as the assembly makes it
  const terms = (e: Expr) =>
    e.t === "def" ? src("Stats.m", Number(e.v)) : termAt(e);
  const both = [op("*", def, val(20), 100), op("*", val(20), def, 100)].map(
    (e) => listOf(chainPools(steps(e), { value: 100 }, terms))?.map(brief),
  );
  expect(both).toEqual([
    [
      ["Additive pool", "additive", "sum", 20, [10, 10]],
      ["Multi pool", "multi", "product", 5, [5]],
    ],
    [
      ["Additive pool", "additive", "sum", 20, [10, 10]],
      ["Multi pool", "multi", "product", 5, [5]],
    ],
  ]);
});
