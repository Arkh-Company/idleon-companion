// A part of a pool that is the running total times 1 + its bonuses ÷ 100 (audit families 11, 14 and 24, answer A of
// 19/11): the game adds the bases into one total, multiplies that total by 1 + the sum of its % ÷ 100, and adds the
// other parts after it. That part is the chain of pools of rule Y (FR-005): the bases are the Additive pool before it,
// the % its own Multi pool, the other parts the Additive pool after it, and each pool closes (FR-008). Invented paths
// and values.
import { expect, test } from "vitest";
import { chainPools, poolsOf, poolsPair } from "./pools.ts";
import type { Pool } from "./pools.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr, Step } from "../recorded/steps.ts";
import { branch } from "./tree-fixture.ts";

const src = (code: string, value: number): Row => ({
  node: row({ pieceKey: code, value, code, name: `Bonus ${code}` }),
  open: null,
});
const num = (v: number): Expr => ({ t: "num", v });
const at = (p: string, v: number): Expr => ({ t: "read", p, v });
const val = (v: number): Expr => ({ t: "val", v });
const op = (o: string, l: Expr, r: Expr, v: number): Expr => ({
  t: "op",
  o,
  l,
  r,
  v,
});
/** A term of the step as a row: a read is its source, anything else an unnamed branch of its value. */
const term = (e: Expr): Row | null =>
  e.t === "read" ? src(e.p, Number(e.v)) : branch(Number(e.v));
const brief = (p: Pool) => [
  p.name,
  p.kind,
  p.combine,
  p.value,
  p.rows.map((r) => r.node.value),
];

// the bases 10 + 20, times 1 + (30 + 20) ÷ 100, and the parts 5 and 3 added around it
const BASES = op("+", at("Stats.a", 10), at("Stats.b", 20), 30);
const PCT = op(
  "+",
  num(1),
  op("/", op("+", at("Stats.p", 30), at("Stats.q", 20), 50), num(100), 0.5),
  1.5,
);
const scaled = (total: Expr) => op("*", total, PCT, 45);
const sumOf = (part: Expr) =>
  op("+", op("+", at("Stats.c", 5), part, 50), at("Stats.d", 3), 53);
const ROWS = [src("Stats.c", 5), branch(45), src("Stats.d", 3)];

test("a running total times 1 + its % ÷ 100 in a pool is the chain: the bases, the % pool, then the other parts", () => {
  const pools = poolsOf(ROWS, { value: 53, expr: sumOf(scaled(BASES)) }, term);
  expect(pools?.map(brief)).toEqual([
    ["Additive pool 1", "additive", "sum", 30, [10, 20]],
    ["Multi pool", "multi", "onePlusPercent", 1.5, [30, 20]],
    ["Additive pool 2", "additive", "sum", 8, [5, 3]],
  ]);
  expect(pools && poolsPair(pools, 53)).toEqual([
    "Additive pool 1 × Multi pool + Additive pool 2",
    "30 × 1.5 + 8 = 53",
  ]);
});

test("the running total may be a working value of the game: its one row is the Additive pool before the % pool", () => {
  const pools = poolsOf(
    ROWS,
    { value: 53, expr: sumOf(scaled(at("DNSM.Stats.total", 30))) },
    term,
  );
  expect(pools?.map(brief)).toEqual([
    ["Additive pool 1", "additive", "sum", 30, [30]],
    ["Multi pool", "multi", "onePlusPercent", 1.5, [30, 20]],
    ["Additive pool 2", "additive", "sum", 8, [5, 3]],
  ]);
});

test("a source of the player's state times 1 + its % ÷ 100 is no running total: the pool stays one sum", () => {
  const pools = poolsOf(
    ROWS,
    { value: 53, expr: sumOf(scaled(at("Stats.x", 30))) },
    term,
  );
  expect(pools?.map(brief)).toEqual([
    ["Additive pool", "additive", "sum", 53, [5, 45, 3]],
  ]);
});

test("the same part in the first step of a chain opens the same pools, and the chain goes on after them", () => {
  const steps: Step[] = [
    { v: 53, e: sumOf(scaled(BASES)) },
    { v: 106, e: op("*", val(53), at("Stats.m", 2), 106) },
  ];
  const pools = chainPools(steps, { value: 106 }, (e) => term(e));
  expect(Array.isArray(pools) ? pools.map(brief) : pools).toEqual([
    ["Additive pool 1", "additive", "sum", 30, [10, 20]],
    ["Multi pool", "multi", "onePlusPercent", 1.5, [30, 20]],
    ["Additive pool 2", "additive", "sum", 8, [5, 3]],
    ["Bonus Stats.m", "multi", "product", 2, [2]],
  ]);
  expect(Array.isArray(pools) && poolsPair(pools, 106)).toEqual([
    "(Additive pool 1 × Multi pool + Additive pool 2) × Bonus Stats.m",
    "(30 × 1.5 + 8) × 2 = 106",
  ]);
});
