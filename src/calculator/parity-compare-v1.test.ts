// The V1 parity of `just parity` (spec 009, FR-010, research R4, task T011): the app's Drop Rate against the bench's V1
// (build-v1mold.cjs), two levels deep: the pools, their groups, the order, the values and each group's sources by their
// piece. Every name, code and number here is invented, apart from the V1's pool names.
import { expect, test } from "vitest";
import type { BenchRow } from "./parity-compare.ts";
import { compareMould } from "./parity-compare.ts";
import type { CalcTreeNode } from "./tree-contract.ts";

const node = (over: Partial<CalcTreeNode>): CalcTreeNode => ({
  id: "x",
  pieceKey: null,
  name: "x",
  value: 0,
  fmt: null,
  leaf: null,
  condition: null,
  why: null,
  formula: null,
  code: null,
  role: "piece",
  share: null,
  shareMode: null,
  flags: {},
  kids: [],
  ...over,
});
const pool = (name: string, value: number, kids: CalcTreeNode[] = []) =>
  node({ name, value, role: "pool", combine: null, poolKind: "multi", kids });
const group = (name: string, value: number, kids: CalcTreeNode[]) =>
  node({ name, value, role: "system", combine: "sum", poolKind: null, kids });
const source = (code: string | null, value: number, name = "Source") =>
  node({ name, value, code, pieceKey: code });

const APP = node({
  name: "Total",
  value: 12,
  role: "root",
  kids: [
    pool("LUK Scaling", 0.5, [source(null, 0.4, "Curve"), source(null, 1.25)]),
    pool("Additive Pool", 30, [
      source("InventedTalent(1)", 5),
      group("🃏 Cards", 25, [
        source("InventedCard(1)", 20),
        source("InventedCard(2)", 5),
      ]),
    ]),
    pool("Total Sum", 1.8),
    pool("Post-Processing", 6.66, [
      source(null, 2, "Invented pack"),
      source("InventedFriend(1)", 3),
    ]),
  ],
});
const BENCH: BenchRow = {
  name: "Drop Rate",
  v: 12,
  kids: [
    {
      name: "LUK Scaling",
      v: 0.5,
      pool: true,
      kids: [
        { name: "Curve", v: 0.4 },
        { name: "× 1.25", v: 0.5 },
      ],
    },
    {
      name: "Additive Pool",
      v: 30,
      pool: true,
      kids: [
        {
          name: "🎯 Talents",
          v: 5,
          bucket: true,
          kids: [{ name: "Talent", code: "InventedTalent(1)", v: 5 }],
        },
        {
          name: "🃏 Cards",
          v: 25,
          bucket: true,
          kids: [
            { name: "Card B", code: "InventedCard(2)", v: 5 },
            { name: "Card A", code: "InventedCard(1)", v: 20 },
          ],
        },
      ],
    },
    { name: "Total Sum", v: { $n: "1.8" }, pool: true, kids: [{ v: 1 }] },
    {
      name: "Post-Processing",
      v: 6.66,
      pool: true,
      kids: [
        {
          name: "🎁 Invented pack",
          v: 2,
          bucket: true,
          kids: [{ name: "Fixed +2", code: "Invented + 2", v: 2 }],
        },
        // a group the bench merged into its one source (its Friends rule) carries that source's code
        { name: "🤝 Friends", v: 3, bucket: true, code: "InventedFriend(1)" },
      ],
    },
  ],
};

test("the V1 and the app's Drop Rate match: a lone source stands for the bench's group of one, a group's sources in any order", () => {
  expect(compareMould(APP, BENCH)).toEqual([]);
});

test("a pool of another name, value or order is a difference at its place", () => {
  const [luk, add, total, post] = BENCH.kids ?? [];
  const swapped = {
    ...BENCH,
    kids: [luk ?? {}, total ?? {}, add ?? {}, post ?? {}],
  };
  expect(compareMould(APP, swapped)).toEqual([
    { at: "0/1", field: "name" },
    { at: "0/1", field: "value" },
    { at: "0/2", field: "name" },
    { at: "0/2", field: "value" },
  ]);
  expect(compareMould(APP, { ...BENCH, kids: [luk ?? {}] })).toEqual([
    { at: "0", field: "shape" },
  ]);
});

test("a group of another name or value, or a source of another piece, is a difference at the group", () => {
  const [luk, add, total, post] = BENCH.kids ?? [];
  const [talents, cards] = add?.kids ?? [];
  const other: BenchRow = {
    ...cards,
    name: "🃏 Other cards",
    v: 26,
    kids: [
      { name: "Card A", code: "InventedCard(1)", v: 20 },
      { name: "Card C", code: "InventedCard(3)", v: 6 },
    ],
  };
  const bench = {
    ...BENCH,
    kids: [
      luk ?? {},
      { ...add, kids: [talents ?? {}, other] },
      total ?? {},
      post ?? {},
    ],
  };
  expect(compareMould(APP, bench)).toEqual([
    { at: "0/1/1", field: "name" },
    { at: "0/1/1", field: "value" },
    { at: "0/1/1", field: "shape" },
  ]);
});

test("a group where the bench has a lone source, or the groups in another order, is a difference of shape", () => {
  const [luk, add, total, post] = BENCH.kids ?? [];
  const [talents, cards] = add?.kids ?? [];
  const bench = {
    ...BENCH,
    kids: [
      luk ?? {},
      { ...add, kids: [cards ?? {}, talents ?? {}] },
      total ?? {},
      post ?? {},
    ],
  };
  expect(compareMould(APP, bench)).toEqual([
    { at: "0/1/0", field: "shape" },
    { at: "0/1/1", field: "shape" },
  ]);
});
