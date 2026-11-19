// The parity against the bench where the app shows bonuses in % the game sums and divides by 100 (spec 009, FR-017): the
// app's pool has groups of `combine: "percent"` and no row of the sum ÷ 100, while the bench (008) keeps that row, its
// leaves and its constant "Percent to number (÷ 100)". Every name and number here is invented. (In a file of its own:
// parity-compare-mould.test.ts is at the 400-line limit.)
import { expect, test } from "vitest";
import type { BenchRow } from "./parity-compare.ts";
import { compareTrees } from "./parity-compare.ts";
import type { CalcTreeNode } from "./tree-contract.ts";

const app = (over: Partial<CalcTreeNode> = {}): CalcTreeNode => ({
  id: "root",
  pieceKey: null,
  name: "Total",
  value: 6.9,
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
const leaf = (name: string, value: number): CalcTreeNode =>
  app({ id: `root/${name}`, name, value, leaf: "fixedValue" });
const percent = (name: string, kids: CalcTreeNode[]): CalcTreeNode =>
  app({
    id: `root/Additive pool/${name}`,
    name,
    value: kids.reduce((s, k) => s + Number(k.value), 0) / 100,
    fmt: "%",
    role: "system",
    combine: "percent",
    poolKind: null,
    kids,
  });

/** (2 + (A 20 + B 4 + T 6) ÷ 100) × M 3: the app's Additive pool, its two % groups and its Multi pool. */
const APP = app({
  kids: [
    app({
      id: "root/Additive pool",
      name: "Additive pool",
      value: 2.3,
      role: "pool",
      combine: "sum",
      poolKind: "additive",
      kids: [
        leaf("Base part", 2),
        percent("🃏 Cards", [leaf("A", 20), leaf("B", 4)]),
        percent("🎯 Talents", [leaf("T", 6)]),
      ],
    }),
    app({
      id: "root/Multi pool",
      name: "Multi pool",
      value: 3,
      role: "pool",
      combine: "product",
      poolKind: "multi",
      kids: [leaf("M", 3)],
    }),
  ],
});
const fixed = (name: string, v: number): BenchRow => ({
  name,
  v,
  kind: "Valor fixo",
});
/** The bench's sum ÷ 100, the branch of its expression's parts, with B worth `b`. */
const sumOf = (b: number): BenchRow => ({
  name: "Multiplier from 3 sources",
  v: (20 + b + 6) / 100,
  kids: [
    fixed("A", 20),
    fixed("B", b),
    fixed("T", 6),
    fixed("Percent to number (÷ 100)", 100),
  ],
});

test("the bench's sum ÷ 100 pairs through its rows with the app's % groups, its ÷ 100 being the bench's constant", () => {
  const bench = (b: number): BenchRow => ({
    name: "Invented drop",
    v: 6.9,
    kids: [fixed("Base part", 2), sumOf(b), fixed("M", 3)],
  });
  expect(compareTrees(APP, bench(4), new Set())).toEqual([]);
  // a source of another value is still a difference
  expect(compareTrees(APP, bench(5), new Set())).toContainEqual({
    at: "0/1/1",
    field: "shape",
  });
});

test("an Additive pool with % groups that pairs whole with the bench's factor leaves the factor's ÷ 100 aside", () => {
  const bench = (b: number): BenchRow => ({
    name: "Invented drop",
    v: 6.9,
    kids: [
      {
        name: "Sum of 4 sources",
        v: 2 + (20 + b + 6) / 100,
        kids: [fixed("Base part", 2), ...(sumOf(b).kids ?? [])],
      },
      fixed("M", 3),
    ],
  });
  expect(compareTrees(APP, bench(4), new Set())).toEqual([]);
  // a source of another value: the factor no longer has the pool's value, and its row of that source has no pair
  expect(compareTrees(APP, bench(5), new Set())).toContainEqual({
    at: "0/0/2",
    field: "shape",
  });
});

// A source that is itself a chain (the golden food inside the Drop Rate, spec 009, FR-017) opens into pools below the
// root: the parity goes through them as through the root's, and pairs the bench's 008 rows with the sources inside.
const food = app({
  id: "root/Additive pool/Food",
  name: "Food",
  value: 7,
  code: "Food()",
  kids: [
    app({
      id: "root/Additive pool/Food/Multi pool",
      name: "Multi pool",
      value: 6,
      role: "pool",
      combine: "product",
      poolKind: "multi",
      kids: [leaf("A", 2), leaf("B", 3)],
    }),
    app({
      id: "root/Additive pool/Food/Additive pool",
      name: "Additive pool",
      value: 1,
      role: "pool",
      combine: "sum",
      poolKind: "additive",
      kids: [leaf("C", 1)],
    }),
  ],
});
const CHAIN = app({
  value: 7,
  kids: [
    app({
      id: "root/Additive pool",
      name: "Additive pool",
      value: 7,
      role: "pool",
      combine: "sum",
      poolKind: "additive",
      kids: [food],
    }),
  ],
});

test("a source whose rows are pools, below the root, pairs through them with the bench's rows", () => {
  const bench = (c: number): BenchRow => ({
    name: "Invented drop",
    v: 6 + c,
    kids: [
      {
        name: "Food",
        v: 6 + c,
        kids: [
          { name: "Game value", v: 6, kids: [fixed("A", 2), fixed("B", 3)] },
          fixed("C", c),
        ],
      },
    ],
  });
  expect(compareTrees(CHAIN, bench(1), new Set())).toEqual([]);
  // a source of another value is still a difference
  expect(compareTrees(CHAIN, bench(2), new Set())).toContainEqual({
    at: "0/0/1",
    field: "shape",
  });
});
