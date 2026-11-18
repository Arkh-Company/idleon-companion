// Inside a pool, at any level, the sources go by system (spec 009, FR-017): an unnamed sum and a working value the root
// itself wrote that only joins sources dissolve, their sources move up into the pool and go by system; every level still
// closes and no source leaves (FR-008).
import { expect, test } from "vitest";
import type { Joins } from "./flatten.ts";
import { poolRows } from "./mould.ts";
import type { Pool } from "./pools.ts";
import { row, withShares } from "./rows.ts";
import type { Row } from "./rows.ts";

const src = (code: string, value: number): Row => ({
  node: row({ pieceKey: code, value, code }),
  open: null,
});
const level = (v: number, rows: Row[]): Row[] =>
  withShares({ name: "", value: v }, null, rows).rows;
const talent = (v: number, n = 207) =>
  src(`GetTalentNumber(1, ${String(n)})`, v);
const card = (v: number, n = 10) => src(`CardBonusREAL(${String(n)}, 0)`, v);
const other = (v: number, n: number) => src(`InventedBlock(${String(n)})`, v);
/** A sum of sources of two systems with no name but its count. */
const unnamedSum = (): Row => ({
  node: row({
    pieceKey: null,
    value: 30,
    code: null,
    name: "Multiplier from 3 sources",
  }),
  open: null,
  group: level(30, [card(20), talent(6), card(4, 11)]),
  op: "+",
});
/** A working value the root wrote, read back in its sum. */
const own: Row = {
  node: row({
    pieceKey: "DNSM.InventedPart",
    value: 9,
    code: "DNSM.InventedPart",
    kids: "lazy",
  }),
  open: {
    path: "DNSM.InventedPart",
    value: 9,
    writer: 0,
    entry: null,
    opening: [],
  },
};
/** The rows of a step of the root that adds them (tree/flatten.ts `Joins`). */
const sum = (rows: Row[]) => ({ op: "+" as const, rows });
/** The working value, wherever its level placed it (a level's rows are new objects). */
const isOwn = (r: Row) => r.node.code === own.node.code;
const pool = (rows: Row[], value: number): Pool => ({
  kind: "additive",
  name: "Additive pool",
  value,
  combine: "sum",
  rows: level(value, rows),
});
const noWriter = () => undefined;
/** A pool's rows as [the group's name, or the source's code; its value; its sources' codes]. */
const brief = (rows: readonly Row[]) =>
  rows.map((r) => [
    r.node.role === "system" ? r.node.name : r.node.code,
    r.node.value,
    (r.group ?? []).map((k) => k.node.code),
  ]);
const poolOf = (rows: Row[], value: number, joins: Joins = () => null) =>
  poolRows([pool(rows, value)], { name: "Total", value }, noWriter, joins)
    .rows[0]?.group ?? [];

test("an unnamed sum and a working value of the root that only joins sources dissolve into the pool, by system", () => {
  const joins = (r: Row) =>
    isOwn(r) ? sum([talent(5, 208), other(4, 1)]) : null;
  const rows = poolOf([other(2, 2), unnamedSum(), own], 41, joins);
  expect(brief(rows)).toEqual([
    ["🎯 Talents", 11, ["GetTalentNumber(1, 207)", "GetTalentNumber(1, 208)"]],
    ["🃏 Cards", 24, ["CardBonusREAL(10, 0)", "CardBonusREAL(11, 0)"]],
    ["🔹 Other", 6, ["InventedBlock(2)", "InventedBlock(1)"]],
  ]);
  // no source leaves, and the groups sum to the pool
  expect(rows.reduce((s, r) => s + Number(r.node.value), 0)).toBe(41);
});

test("a working value whose rows do not give it, that a step of the root multiplied, or that the root did not write, stays a source", () => {
  const off = (r: Row) => (isOwn(r) ? sum([talent(5, 208)]) : null);
  const times = (r: Row) =>
    isOwn(r) ? { op: "*" as const, rows: [talent(9, 208)] } : null;
  for (const joins of [off, times, () => null]) {
    const rows = poolOf([other(2, 2), own], 11, joins);
    expect(rows.map((r) => [r.node.code, r.node.value])).toEqual([
      ["InventedBlock(2)", 2],
      ["DNSM.InventedPart", 9],
    ]);
  }
});

test("a sum the root wrote inside an unnamed sum dissolves too, all the way", () => {
  const nested: Row = {
    ...unnamedSum(),
    node: { ...unnamedSum().node, value: 39 },
    group: level(39, [card(20), talent(6), card(4, 11), own]),
  };
  const joins = (r: Row) => (isOwn(r) ? sum([talent(9, 208)]) : null);
  const rows = poolOf([nested], 39, joins);
  expect(brief(rows)).toEqual([
    ["🎯 Talents", 15, ["GetTalentNumber(1, 207)", "GetTalentNumber(1, 208)"]],
    ["🃏 Cards", 24, ["CardBonusREAL(10, 0)", "CardBonusREAL(11, 0)"]],
  ]);
});

/** A bonus in % the game sums with others and divides by 100 before the sum enters the pool. */
const pct = (r: Row): Row => ({ ...r, percent: true });

test("bonuses in % the game divides by 100 go by system in % groups, a lone one too, and the pool still closes (FR-017)", () => {
  const rows = poolOf(
    [other(2, 2), pct(card(20)), pct(talent(6)), pct(card(4, 11))],
    2.3,
  );
  expect(
    rows.map((r) => [
      r.node.role === "system" ? r.node.name : r.node.code,
      r.node.combine,
      r.node.fmt,
      r.node.value,
    ]),
  ).toEqual([
    ["🎯 Talents", "percent", "%", 0.06],
    ["🃏 Cards", "percent", "%", 0.24],
    ["InventedBlock(2)", undefined, null, 2],
  ]);
  expect(rows.reduce((s, r) => s + Number(r.node.value), 0)).toBeCloseTo(2.3);
  const [, cards] = rows;
  // the group's ⓘ: its bonuses' sum ÷ 100; each bonus's share of that sum
  expect(cards?.node.formula).toEqual([
    ["(", "CardBonusREAL(10, 0)", "+", "CardBonusREAL(11, 0)", ")", "÷", "100"],
    [20, 4, 100, 0.24],
  ]);
  expect((cards?.group ?? []).map((k) => k.node.share)).toEqual([
    expect.closeTo(20 / 24, 9),
    expect.closeTo(4 / 24, 9),
  ]);
});

test("an unnamed sum of bonuses in % dissolves, its bonuses still in % (FR-017)", () => {
  const rows = poolOf([other(2, 2), pct(unnamedSum())], 2.3);
  expect(brief(rows)).toEqual([
    ["🎯 Talents", 0.06, ["GetTalentNumber(1, 207)"]],
    ["🃏 Cards", 0.24, ["CardBonusREAL(10, 0)", "CardBonusREAL(11, 0)"]],
    ["InventedBlock(2)", 2, []],
  ]);
});
