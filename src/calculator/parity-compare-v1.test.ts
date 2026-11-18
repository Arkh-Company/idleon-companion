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

// spec 009 T029 (decision of 18/11): the bench is the reference of the sources and their names, the format the 009's;
// the parity compares source by source and no longer the V1's own structure (its pools, LUK Scaling, Total Sum, the
// order of the factors)
const V1: BenchRow = {
  name: "Invented total",
  v: 33.6,
  kids: [
    {
      name: "LUK Scaling",
      v: 1.12,
      kids: [
        { name: "LUK curve", v: 0.8, kids: [benchSource("LUK", 4)] },
        { name: "× 1.4", v: 1.12, kind: "Valor fixo" },
      ],
    },
    {
      name: "Additive Pool",
      v: 30,
      kids: [
        {
          name: "🃏 Cards",
          v: 30,
          kids: [benchSource("Card A", 10), benchSource("Card B", 20)],
        },
      ],
    },
    {
      name: "Total Sum",
      v: 33.6,
      kids: [{ name: "Fixed 1", v: 1, kind: "Valor fixo" }],
    },
  ],
};
const luk = (curve = 0.8) =>
  app({
    id: "root/x/Game value",
    name: "Game value",
    value: 1.4 * curve,
    role: "piece",
    kids: [
      app({
        id: "root/x/1.4",
        name: "× 1.4",
        value: 1.4,
        role: "piece",
        leaf: "fixedValue",
      }),
      app({
        id: "root/x/LUK curve",
        name: "LUK curve",
        value: curve,
        role: "piece",
        kids: [source("LUK", 4)],
      }),
    ],
  });
const cards = (b = 20) =>
  group("🃏 Cards", [source("Card A", 10), source("Card B", b)], 10 + b);

test("the V1's pools, its constants and the order of its factors are not compared: the sources pair, whatever holds them", () => {
  const moulded = app({
    value: 33.6,
    kids: [pool([luk(), cards()])],
  });
  expect(compareTrees(moulded, V1, new Set())).toEqual([]);
});

test("a source missing, extra, or of another value or type is a difference", () => {
  const missing = app({
    value: 33.6,
    kids: [pool([luk(), group("🃏 Cards", [source("Card A", 10)], 10)])],
  });
  expect(compareTrees(missing, V1, new Set())).toEqual([
    { at: "0/2", field: "shape" },
  ]);
  const extra = app({
    value: 33.6,
    kids: [pool([luk(), cards(), source("Invented extra", 7)])],
  });
  expect(compareTrees(extra, V1, new Set())).toEqual([
    { at: "0", field: "shape" },
  ]);
  const other = app({ value: 33.6, kids: [pool([luk(), cards(21)])] });
  expect(compareTrees(other, V1, new Set()).map((d) => d.field)).toContain(
    "value",
  );
  const typed = app({
    value: 33.6,
    kids: [
      pool([
        luk(),
        group(
          "🃏 Cards",
          [
            source("Card A", 10),
            app({ ...source("Card B", 20), leaf: "quantity" }),
          ],
          30,
        ),
      ]),
    ],
  });
  expect(compareTrees(typed, V1, new Set())).toEqual([
    { at: "0/2", field: "type" },
  ]);
  // below a source, a row of another value still counts
  expect(
    compareTrees(
      app({ value: 33.6, kids: [pool([luk(0.9), cards()])] }),
      V1,
      new Set(),
    ).length,
  ).toBeGreaterThan(0);
});

test("a V1 group of one source, written with the source's code, is that source: its label is no name", () => {
  const bench: BenchRow = {
    name: "Invented total",
    v: 17,
    kids: [
      {
        name: "Additive Pool",
        v: 17,
        kids: [
          {
            name: "⭐ Star Signs",
            v: 17,
            code: "DNSM.InventedSigns",
            kids: [benchSource("Sign A", 5), benchSource("Sign B", 12)],
          },
        ],
      },
    ],
  };
  const signs = app({
    id: "root/Signs total",
    name: "Signs total",
    value: 17,
    role: "piece",
    code: "DNSM.InventedSigns",
    kids: [source("Sign A", 5), source("Sign B", 12)],
  });
  expect(
    compareTrees(app({ value: 17, kids: [pool([signs])] }), bench, new Set()),
  ).toEqual([]);
});

test("the checks and reads the app shows after its pools are the format's, no extra sources", () => {
  const check = app({
    id: "root/check",
    name: "Invented check = 1",
    value: 1,
    role: "piece",
    leaf: "condition",
  });
  const moulded = app({ value: 33.6, kids: [pool([luk(), cards()]), check] });
  expect(compareTrees(moulded, V1, new Set())).toEqual([]);
});
