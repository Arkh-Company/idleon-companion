// The parity against the bench's V1 (spec 009, SC-002, T023): the bench's Drop Rate is its V1 mould, hand-made pools
// with a group per system ("⚗️ Alchemy", its sources inside), while the app's pools follow the game's chain (rule Y) and
// a lone source stands alone (FR-006). The parity goes through the bench's system groups as it goes through the app's,
// and pairs the sources; a source the app files under another system is still a difference. Every name and number here
// is invented, apart from the V1 systems' names.
import { expect, test } from "vitest";
import type { BenchRow } from "./parity-compare.ts";
import { compareTrees } from "./parity-compare.ts";
import type { CalcTreeNode } from "./tree-contract.ts";

const app = (over: Partial<CalcTreeNode> = {}): CalcTreeNode => ({
  id: "root",
  pieceKey: null,
  name: "Total",
  value: 33,
  fmt: null,
  leaf: null,
  condition: null,
  why: null,
  formula: null,
  code: null,
  role: "root",
  share: null,
  shareMode: null,
  flags: {},
  kids: [],
  ...over,
});
const source = (name: string, value: number): CalcTreeNode =>
  app({ id: `root/${name}`, name, value, role: "piece", leaf: "level" });
const group = (name: string, kids: CalcTreeNode[], value: number) =>
  app({
    id: `root/x/${name}`,
    name,
    value,
    role: "system",
    combine: "sum",
    poolKind: null,
    kids,
  });
const pool = (kids: CalcTreeNode[]): CalcTreeNode =>
  app({
    id: "root/Additive pool",
    name: "Additive pool",
    role: "pool",
    combine: "sum",
    poolKind: "additive",
    kids,
  });
const benchSource = (name: string, v: number): BenchRow => ({
  name,
  v,
  kind: "Level",
});
/** The bench's V1: a hand-made pool, a group per system, each with its sources. */
const BENCH: BenchRow = {
  name: "Invented total",
  v: 33,
  kids: [
    {
      name: "Additive Pool",
      v: 33,
      kids: [
        {
          name: "⚗️ Alchemy",
          v: 3,
          kids: [benchSource("Invented bubble", 3)],
        },
        {
          name: "🃏 Cards",
          v: 30,
          kids: [benchSource("Card A", 10), benchSource("Card B", 20)],
        },
      ],
    },
  ],
};

test("the bench's system groups go through, and a lone source of the app pairs with the one in the bench's group", () => {
  const moulded = app({
    kids: [
      pool([
        source("Invented bubble", 3),
        group("🃏 Cards", [source("Card A", 10), source("Card B", 20)], 30),
      ]),
    ],
  });
  expect(compareTrees(moulded, BENCH, new Set())).toEqual([]);
});

test("a source the app files under another system than the bench's is a difference of name", () => {
  const moulded = app({
    kids: [
      pool([
        source("Invented bubble", 3),
        group("🃏 Cards", [source("Card A", 10)], 10),
        group("🔹 Other", [source("Card B", 20)], 20),
      ]),
    ],
  });
  expect(compareTrees(moulded, BENCH, new Set())).toEqual([
    { at: "0/0/2", field: "name" },
  ]);
});

test("through the bench's groups, a source of another value is still a difference", () => {
  const moulded = app({
    kids: [
      pool([
        source("Invented bubble", 4),
        group("🃏 Cards", [source("Card A", 10), source("Card B", 20)], 30),
      ]),
    ],
  });
  expect(compareTrees(moulded, BENCH, new Set()).length).toBeGreaterThan(0);
});
