// The first level of a tree (spec 008, FR-006; T017 "a step never named fixed"): the game's steps in its order, each
// with its bonus's name; a step the assembly would name by its shape has no proven name: `no name yet`.
import { expect, test } from "vitest";
import { bySystem, mould, poolRows } from "./mould.ts";
import type { Pool } from "./pools.ts";
import { GENERIC_NAME, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { branch, fixed, placed, read } from "./tree-fixture.ts";
import type { CalcTreeNode } from "../tree-contract.ts";

/** A placed row's own rows, the pools and groups among them (tree-fixture.ts `kidsOf` goes through them). */
const ownKids = (n: CalcTreeNode | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];

const brief = (r: Row) => [r.node.name, r.node.value, r.node.flags];

test.each([
  "Fixed value 2",
  "Fixed +2",
  "Fixed ×1.5",
  "Base 10",
  "× 1.5",
  "Minus 3",
  "Divided by 4",
  "Percent to number (÷ 100)",
])("a step never named %s: no name yet", (name) => {
  expect(mould([fixed(name, 2)]).map(brief)).toEqual([
    [GENERIC_NAME, 2, { unnamed: true }],
  ]);
});

test.each<[string, Row]>([
  // a word that starts like a shape is not one
  ["Captain Boat Speed bonus", fixed("Captain Boat Speed bonus", 2)],
  // a proven name, on a read or on a fixed value of the game's tables
  [
    "Base damage",
    {
      node: row({
        pieceKey: "k",
        value: 2,
        code: "Stats.d",
        name: "Base damage",
      }),
      open: null,
    },
  ],
  [
    "Base damage",
    {
      node: row({
        pieceKey: "k",
        value: 2,
        code: "Table[1]",
        name: "Base damage",
        leaf: "fixedValue",
      }),
      open: null,
    },
  ],
])("a step named %s by its bonus keeps that name", (name, step) => {
  expect(mould([step]).map(brief)).toEqual([[name, 2, {}]]);
});

test("a step at 0 is a step in its place (spec 009, FR-016: no group at 0)", () => {
  expect(mould([fixed("Fixed +2", 0)]).map(brief)).toEqual([
    [GENERIC_NAME, 0, { unnamed: true }],
  ]);
});

test("a step keeps its bonus's name, and the game's order", () => {
  const rows = [read("DNSM.Invented", 3), fixed("Fixed +2", 2)];
  expect(mould(rows).map((r) => r.node.name)).toEqual([
    "Working value of the game (Invented)",
    GENERIC_NAME,
  ]);
});

test("a branch of the first level keeps its parts' names by shape, for its ⓘ", () => {
  const [step] = mould([branch(3, [fixed("Base 1", 1), read("Stats.x", 2)])]);
  expect(step?.group?.map((r) => r.node.name)).toEqual([
    "Base 1",
    GENERIC_NAME,
  ]);
});

test("the steps at ×1 of the first level are steps in their places (spec 009, FR-016: no group at ×1)", () => {
  expect(mould([fixed("× 1", 1), read("Stats.x", 1)]).map(brief)).toEqual([
    [GENERIC_NAME, 1, { unnamed: true }],
    [GENERIC_NAME, 1, { unnamed: true }],
  ]);
});

// Spec 009 (FR-002, FR-004, FR-006, FR-008, FR-013): inside a pool, the sources grouped by system, in the V1 order with
// "🔹 Other" last; a group's value is its sources' sum or product; a lone source stands alone. The game's own block
// names the system rules read; invented arguments, paths and values.
const src = (
  code: string,
  value: number | null,
  fmt: Row["node"]["fmt"] = null,
): Row => ({
  node: row({ pieceKey: code, value, code, fmt }),
  open: null,
});
const talent = (v: number, n = 207) =>
  src(`GetTalentNumber(1, ${String(n)})`, v);
const card = (v: number | null, n = 10) =>
  src(`CardBonusREAL(${String(n)}, 0)`, v);
const other = (v: number, n = 1) => src(`InventedBlock(${String(n)})`, v);
const cache = (v: number) => src("DNSM.InventedCache", v);
const writerOf = (r: Row) =>
  r.node.code === "DNSM.InventedCache"
    ? 'CauldronStats("InventedMode", 0)'
    : undefined;
/** A level as [the group's name, or the source's code; its value]. */
const level = (rows: readonly Row[]) =>
  rows.map((r) => [
    r.node.role === "system" ? r.node.name : r.node.code,
    r.node.value,
  ]);
const sum = (rows: readonly Row[]) =>
  rows.reduce((s, r) => s + Number(r.node.value), 0);

test("the sources go by system in the V1 order, Other last; a lone source stands alone", () => {
  const rows = [
    other(7),
    card(20),
    talent(10),
    cache(3),
    talent(5, 208),
    other(1, 2),
    card(4, 11),
  ];
  const out = bySystem(rows, "sum", writerOf);
  expect(level(out)).toEqual([
    ["🎯 Talents", 15],
    ["🃏 Cards", 24],
    ["DNSM.InventedCache", 3],
    ["🔹 Other", 8],
  ]);
  // every level adds up to its parent, and nothing leaves
  expect(sum(out)).toBe(sum(rows));
  expect(out.map((r) => r.group?.map((k) => k.node.code))).toEqual([
    ["GetTalentNumber(1, 207)", "GetTalentNumber(1, 208)"],
    ["CardBonusREAL(10, 0)", "CardBonusREAL(11, 0)"],
    undefined,
    ["InventedBlock(1)", "InventedBlock(2)"],
  ]);
});

test("a group multiplies its sources in a product, and a group at ×1 or at 0 keeps its place", () => {
  const times = bySystem(
    [card(1), talent(2), card(1, 11), talent(3, 208)],
    "product",
    writerOf,
  );
  expect(level(times)).toEqual([
    ["🎯 Talents", 6],
    ["🃏 Cards", 1],
  ]);
  expect(
    times.map((r) => [r.node.fmt, r.node.combine, r.node.poolKind]),
  ).toEqual([
    ["x", "product", null],
    ["x", "product", null],
  ]);
  const zero = bySystem(
    [card(0), talent(5), card(0, 11), talent(1, 208)],
    "sum",
    writerOf,
  );
  expect(level(zero)).toEqual([
    ["🎯 Talents", 6],
    ["🃏 Cards", 0],
  ]);
  // its sources at 0 in their places, with no group "At 0" (FR-016)
  expect(zero[1]?.group?.map((k) => [k.node.code, k.node.role])).toEqual([
    ["CardBonusREAL(10, 0)", "piece"],
    ["CardBonusREAL(11, 0)", "piece"],
  ]);
});

test("a group mixing + and × sources is in the pool's format, its sources in theirs; in 1 + (bonuses) ÷ 100, in percents", () => {
  const [g] = bySystem(
    [card(30, 10), src("CardBonusREAL(12, 0)", 50, "x")],
    "onePlusPercent",
    writerOf,
  );
  expect([g?.node.value, g?.node.fmt, g?.node.combine]).toEqual([
    80,
    "%",
    "sum",
  ]);
  expect(g?.group?.map((k) => k.node.fmt)).toEqual([null, "x"]);
  const [s] = bySystem(
    [
      src("CardBonusREAL(10, 0)", 30, "%"),
      src("CardBonusREAL(11, 0)", 50, "x"),
    ],
    "sum",
    writerOf,
  );
  expect(s?.node.fmt).toBe("+");
});

test("a cache read goes to its writer's system; a branch to its sources' one system", () => {
  const out = bySystem(
    [
      cache(3),
      src("DNSM.AlchVials.Invented", 2),
      {
        node: row({ pieceKey: null, value: 10, code: null }),
        open: null,
        group: [talent(5), fixed("× 2", 2)],
      },
      talent(1, 208),
    ],
    "sum",
    writerOf,
  );
  expect(level(out)).toEqual([
    ["🎯 Talents", 11],
    ["⚗️ Alchemy", 5],
  ]);
});

test("all sources in Other: the sources stand as they are, with no group", () => {
  const rows = [other(1), other(2, 2), other(1, 3), other(1, 4)];
  expect(bySystem(rows, "product", writerOf)).toBe(rows);
});

test("a group with a source the game could not calculate is unavailable", () => {
  const [g] = bySystem([card(null), card(4, 11)], "sum", writerOf);
  expect([g?.node.value, g?.node.flags.unavailable]).toEqual([null, true]);
});

test("pools and groups have no piece, and their ids are the path of their names", () => {
  const pools: Pool[] = [
    {
      name: "Additive pool",
      kind: "additive",
      combine: "onePlusPercent",
      value: 1.8,
      rows: [card(30), card(50, 11)],
    },
    {
      name: "Multi pool 1",
      kind: "multi",
      combine: "product",
      value: 2,
      rows: [talent(2, 209)],
    },
    {
      name: "Multi pool 2",
      kind: "multi",
      combine: "product",
      value: 3,
      rows: [card(3, 12)],
    },
  ];
  const { rows, formula } = poolRows(
    pools,
    { name: "Total", value: 10.8 },
    writerOf,
  );
  expect(formula).toEqual([
    ["Additive pool", "×", "Multi pool 1", "×", "Multi pool 2"],
    [1.8, 2, 3, 10.8],
  ]);
  const placedRows = placed({}, rows).rows;
  expect(
    placedRows.map((n) => [
      n.id,
      n.role,
      n.pieceKey,
      n.poolKind,
      n.combine,
      n.value,
    ]),
  ).toEqual([
    ["root/Additive pool", "pool", null, "additive", "onePlusPercent", 1.8],
    ["root/Multi pool 1", "pool", null, "multi", "product", 2],
    ["root/Multi pool 2", "pool", null, "multi", "product", 3],
  ]);
  const [alchemy] = ownKids(placedRows[0]);
  expect([
    alchemy?.id,
    alchemy?.role,
    alchemy?.pieceKey,
    alchemy?.value,
  ]).toEqual(["root/Additive pool/🃏 Cards", "system", null, 80]);
  // the pools multiply to the root; a Multi pool of one source shows it alone
  expect(placedRows.reduce((p, n) => p * Number(n.value), 1)).toBeCloseTo(10.8);
  expect(ownKids(placedRows[1]).map((n) => n.code)).toEqual([
    "GetTalentNumber(1, 209)",
  ]);
});

test("under a root with a max at the top, each group is the max of its sources, with its ⓘ, and the root their max", () => {
  const rows = [card(8), talent(3), card(5, 11), other(2), talent(7, 208)];
  const out = bySystem(rows, "max", writerOf);
  expect(level(out)).toEqual([
    ["🎯 Talents", 7],
    ["🃏 Cards", 8],
    ["InventedBlock(1)", 2],
  ]);
  expect(Math.max(...out.map((r) => Number(r.node.value)))).toBe(8);
  const [talents] = out;
  expect([talents?.node.combine, talents?.node.fmt]).toEqual(["max", null]);
  expect(talents?.node.formula).toEqual([
    [
      "max",
      "(",
      "GetTalentNumber(1, 207)",
      ",",
      "GetTalentNumber(1, 208)",
      ")",
    ],
    [3, 7, 7],
  ]);
  const [low] = bySystem([card(8), card(5, 11)], "min", writerOf);
  expect([low?.node.value, low?.node.combine]).toEqual([5, "min"]);
});

test("a pool or group has its own ⓘ, the sum or product of its rows, and none for one row: never a guess", () => {
  const pools: Pool[] = [
    {
      name: "Multi pool 1",
      kind: "multi",
      combine: "product",
      value: 0,
      rows: [card(0)],
    },
    {
      name: "Multi pool 2",
      kind: "multi",
      combine: "product",
      value: 6,
      rows: [talent(2), talent(3, 208)],
    },
  ];
  const { rows } = poolRows(pools, { name: "Total", value: 0 }, writerOf);
  const [lone, two] = placed({}, rows).rows;
  expect(lone?.formula).toBeNull();
  expect(two?.formula).toBeNull();
  const [talents] = ownKids(two);
  expect(talents?.formula).toEqual([
    ["GetTalentNumber(1, 207)", "×", "GetTalentNumber(1, 208)"],
    [2, 3, 6],
  ]);
});
