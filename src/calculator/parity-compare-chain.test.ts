// The 008 parity of `just parity` through the pools of a chain of steps (spec 009, FR-005 rule Y, FR-010, task T011):
// the bench's first level is the last step's terms, each earlier step a branch inside the next one; the app's pools
// take the chain apart. The parity goes through a bench branch no app row has, and pairs its rows. Every name and
// number here is invented.
import { expect, test } from "vitest";
import type { BenchRow } from "./parity-compare.ts";
import { compareTrees } from "./parity-compare.ts";
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
const leaf = (name: string, value: number) =>
  node({ id: name, name, value, leaf: "level" });
const constant = (value: number) =>
  node({
    name: "Game value",
    value,
    leaf: "fixedValue",
    flags: { unnamed: true },
  });
const pool = (
  name: string,
  kind: "additive" | "multi",
  value: number,
  kids: CalcTreeNode[],
) =>
  node({
    name,
    value,
    role: "pool",
    poolKind: kind,
    combine: kind === "additive" ? "sum" : "product",
    kids,
  });

// 37 (a + b) → + 2 → × m → + 0.5 → × p × q
const APP = node({
  name: "Total",
  value: 1407,
  role: "root",
  kids: [
    pool("Additive pool 1", "additive", 39, [
      leaf("Alpha", 30),
      leaf("Beta", 7),
      constant(2),
    ]),
    pool("Multi pool 1", "multi", 6, [leaf("Mu", 6)]),
    pool("Additive pool 2", "additive", 0.5, [constant(0.5)]),
    pool("Multi pool 2", "multi", 6, [leaf("Pi", 2), leaf("Kappa", 3)]),
  ],
});
const lv = (name: string, v: number): BenchRow => ({ name, v, kind: "Level" });
const benchOf = (alpha: number): BenchRow => ({
  name: "Invented total",
  v: 1407,
  kids: [
    {
      name: "Game value",
      v: 234.5,
      kids: [
        {
          name: "Game value",
          v: 234,
          kids: [
            {
              name: "Game value",
              v: 39,
              kids: [
                {
                  name: "Working value of the game",
                  v: 37,
                  kids: [lv("Alpha", alpha), lv("Beta", 7)],
                },
                { name: "Fixed +2", v: 2, kind: "Valor fixo" },
              ],
            },
            lv("Mu", 6),
          ],
        },
        { name: "Fixed +0.5", v: 0.5, kind: "Valor fixo" },
      ],
    },
    lv("Pi", 2),
    lv("Kappa", 3),
  ],
});

test("the bench's steps nested in each other pair with the app's chain of pools, row by row", () => {
  expect(compareTrees(APP, benchOf(30), new Set())).toEqual([]);
});

test("a leaf of another value inside the chain is still a difference", () => {
  expect(compareTrees(APP, benchOf(31), new Set())).not.toEqual([]);
});

test("a 1 + percent pool that is a Multi pool pairs whole with the bench's factor, as an Additive one did", () => {
  const pct = node({
    name: "Total",
    value: 3.6,
    role: "root",
    kids: [
      node({
        name: "Multi pool 1",
        value: 1.8,
        role: "pool",
        poolKind: "multi",
        combine: "onePlusPercent",
        kids: [leaf("A", 30), leaf("B", 50)],
      }),
      pool("Multi pool 2", "multi", 2, [leaf("M", 2)]),
    ],
  });
  const bench: BenchRow = {
    name: "Invented speed",
    v: 3.6,
    kids: [
      {
        name: "Multiplier from 2 sources",
        v: 1.8,
        kids: [
          { name: "Base 1", v: 1, kind: "Valor fixo" },
          lv("A", 30),
          lv("B", 50),
          { name: "Percent to number (÷ 100)", v: 100, kind: "Valor fixo" },
        ],
      },
      lv("M", 2),
    ],
  };
  expect(compareTrees(pct, bench, new Set())).toEqual([]);
});
