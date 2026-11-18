// The parity against the bench's V1, source by source (spec 009 T029 and T030, decision of 18/11): the bench is the
// reference of the sources and their names, the format the 009's. Every name and number here is invented, apart from
// the V1 systems' names. (In a file of its own: parity-compare-v1.test.ts is at the 400-line limit.)
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

test("below a source, the rows pair by name and value, in any order; a row missing is still a difference", () => {
  const bench: BenchRow = {
    ...V1,
    kids: [
      {
        name: "Additive Pool",
        v: 30,
        kids: [
          {
            name: "🃏 Cards",
            v: 30,
            kids: [
              {
                name: "Card A",
                v: 30,
                kids: [benchSource("Stars", 3), benchSource("Per star", 10)],
              },
            ],
          },
        ],
      },
    ],
  };
  const card = (kids: CalcTreeNode[]) =>
    app({ id: "root/Card A", name: "Card A", value: 30, role: "piece", kids });
  const flipped = app({
    value: 33.6,
    kids: [pool([card([source("Per star", 10), source("Stars", 3)])])],
  });
  expect(compareTrees(flipped, bench, new Set())).toEqual([]);
  const short = app({
    value: 33.6,
    kids: [pool([card([source("Stars", 3)])])],
  });
  expect(compareTrees(short, bench, new Set()).map((d) => d.field)).toEqual([
    "shape",
  ]);
});

test('the bench\'s group of its parts at ×1, written "N more parts at ×1", goes through: the app has each part in its place', () => {
  const bench: BenchRow = {
    ...V1,
    kids: [
      {
        name: "Additive Pool",
        v: 30,
        kids: [
          {
            name: "🃏 Cards",
            v: 30,
            kids: [
              {
                name: "Card A",
                v: 30,
                kids: [
                  benchSource("Stars", 30),
                  {
                    name: "2 more parts at ×1",
                    v: 1,
                    kids: [benchSource("One", 1), benchSource("Also one", 1)],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const card = app({
    id: "root/Card A",
    name: "Card A",
    value: 30,
    role: "piece",
    kids: [source("Also one", 1), source("Stars", 30), source("One", 1)],
  });
  expect(
    compareTrees(app({ value: 33.6, kids: [pool([card])] }), bench, new Set()),
  ).toEqual([]);
});

test("a reviewed name is said by its whole bench path, from the root through the V1's pools and groups (009 T030)", () => {
  const renamed = app({
    value: 33.6,
    kids: [
      pool([
        luk(),
        group(
          "🃏 Cards",
          [source("Card A", 10), source("Cards: Card B", 20)],
          30,
        ),
      ]),
    ],
  });
  expect(compareTrees(renamed, V1, new Set())).toEqual([
    { at: "0/2", field: "name" },
  ]);
  expect(
    compareTrees(
      renamed,
      V1,
      new Set(["Invented total › Additive Pool › 🃏 Cards › Card B"]),
    ),
  ).toEqual([]);
  // the bare name is no path: another source of that name still counts
  expect(compareTrees(renamed, V1, new Set(["Card B"]))).toEqual([
    { at: "0/2", field: "name" },
  ]);
});
