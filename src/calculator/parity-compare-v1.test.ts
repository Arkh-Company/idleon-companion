// The parity against the bench's V1 (spec 009, SC-002, T023): the bench's Drop Rate is its V1 mould, hand-made pools
// with a group per system ("⚗️ Alchemy", its sources inside), while the app's pools follow the game's chain (rule Y), a
// named system's lone source is its group and a source of no system stands alone (fix tree-shape-091). The parity goes through the bench's system groups as it goes through the app's,
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
  // spec 009 T029: each bench source has its place in the list of sources
  expect(compareTrees(moulded, BENCH, new Set())).toEqual([
    { at: "0/2", field: "name" },
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

test("the sources pair by name and value first, all of them, and only then by value", () => {
  // two sources at 0: a greedy pairing by value would take the named one for the first bench row
  const bench: BenchRow = {
    name: "Invented total",
    v: 0,
    kids: [
      {
        name: "🃏 Cards",
        v: 0,
        kids: [benchSource("Card C", 0), benchSource("Card D", 0)],
      },
    ],
  };
  const moulded = app({
    value: 0,
    kids: [
      pool([group("🃏 Cards", [source("Card D", 0), source("Card E", 0)], 0)]),
    ],
  });
  expect(compareTrees(moulded, bench, new Set())).toEqual([
    { at: "0/0", field: "name" },
  ]);
});

test("a source the app keeps whole, which the V1 opened into its rows, pairs through its rows", () => {
  // the app's one cache read of the signs; the bench's group has the signs themselves
  const signs = app({
    id: "root/Signs total",
    name: "Signs total",
    value: 17,
    role: "piece",
    code: "DNSM.InventedSigns",
    kids: [source("Sign A", 5), source("Sign B", 12)],
  });
  const bench: BenchRow = {
    name: "Invented total",
    v: 17,
    kids: [
      {
        name: "⭐ Star Signs",
        v: 17,
        kids: [benchSource("Sign A", 5), benchSource("Sign B", 12)],
      },
    ],
  };
  expect(
    compareTrees(app({ value: 17, kids: [pool([signs])] }), bench, new Set()),
  ).toEqual([]);
  // a sign of another value is still a difference
  const off: BenchRow = {
    ...bench,
    kids: [
      {
        name: "⭐ Star Signs",
        v: 17,
        kids: [benchSource("Sign A", 6), benchSource("Sign B", 12)],
      },
    ],
  };
  expect(
    compareTrees(app({ value: 17, kids: [pool([signs])] }), off, new Set())
      .length,
  ).toBeGreaterThan(0);
});
