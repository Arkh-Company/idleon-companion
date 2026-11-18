// Inside a pool, at any level, the sources go by system (spec 009, FR-017): an unnamed sum and a working value the root
// itself wrote that only joins sources dissolve, their sources move up into the pool and go by system; every level still
// closes and no source leaves (FR-008).
import { expect, test } from "vitest";
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
const poolOf = (
  rows: Row[],
  value: number,
  joins = (_r: Row) => null as Row[] | null,
) =>
  poolRows([pool(rows, value)], { name: "Total", value }, noWriter, joins)
    .rows[0]?.group ?? [];

test("an unnamed sum and a working value of the root that only joins sources dissolve into the pool, by system", () => {
  const joins = (r: Row) => (r === own ? [talent(5, 208), other(4, 1)] : null);
  const rows = poolOf([other(2, 2), unnamedSum(), own], 41, joins);
  expect(brief(rows)).toEqual([
    ["🎯 Talents", 11, ["GetTalentNumber(1, 207)", "GetTalentNumber(1, 208)"]],
    ["🃏 Cards", 24, ["CardBonusREAL(10, 0)", "CardBonusREAL(11, 0)"]],
    ["🔹 Other", 6, ["InventedBlock(2)", "InventedBlock(1)"]],
  ]);
  // no source leaves, and the groups sum to the pool
  expect(rows.reduce((s, r) => s + Number(r.node.value), 0)).toBe(41);
});

test("a working value whose rows do not give it, or that the root did not write, stays a source", () => {
  const off = (r: Row) => (r === own ? [talent(5, 208)] : null);
  for (const joins of [off, () => null]) {
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
  const joins = (r: Row) => (r === own ? [talent(9, 208)] : null);
  const rows = poolOf([nested], 39, joins);
  expect(brief(rows)).toEqual([
    ["🎯 Talents", 15, ["GetTalentNumber(1, 207)", "GetTalentNumber(1, 208)"]],
    ["🃏 Cards", 24, ["CardBonusREAL(10, 0)", "CardBonusREAL(11, 0)"]],
  ]);
});
