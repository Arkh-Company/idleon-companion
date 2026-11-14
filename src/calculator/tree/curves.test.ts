// The game's curve block as a branch (spec 008, T017, FR-015a; pieces.cjs curve, curveFormula, F5-CURVE, F5-NUM):
// the curve's text and formula, its constants by role, the share of its maximum, and the read that holds its input.
import { expect, test } from "vitest";
import {
  curveConstants,
  curveFormula,
  curveOf,
  curveText,
  fx3,
  inputRead,
  maxReachedOf,
} from "./curves.ts";
import type { Curve } from "./curves.ts";

test.each<[number, string]>([
  [2.34567, "2.346"],
  [1035.9344, "1035.934"],
  [0.0006123, "0.000612"],
  [1e-45, "1e-45"],
  [0, "0"],
])("a number in the ⓘ: %d is %s (rule 160)", (v, text) => {
  expect(fx3(v)).toBe(text);
});

test.each<[Curve, string, string | null]>([
  [
    ["decay", 40, 100, 25],
    "40 × 25 ÷ (25 + 100)",
    "40 × Level ÷ (Level + 100)",
  ],
  [
    ["decayMulti", 2, 200, 802],
    "1 + 2 × 802 ÷ (802 + 200)",
    "1 + 2 × Level ÷ (Level + 200)",
  ],
  [["intervalAdd", 1, 10, 25], "1 + floor(25 ÷ 10)", "1 + floor(Level ÷ 10)"],
  [["add", 3, 0, 7], "3 × 7", "3 × Level"],
  [
    ["add", 3, 2, 4],
    "4 × (3 + 2 × (4 + 1) ÷ 2)",
    "Level × (3 + 2 × (Level + 1) ÷ 2)",
  ],
  [["bigBase", 5, 2, 3], "5 + 2 × 3", "5 + 2 × Level"],
  [["reduce", 50, 2, 3], "50 − 2 × 3", "50 − 2 × Level"],
  [["addDECAY", 2, 0, 10], "2 × 10", "2 × Level"],
  [["invented", 1, 2, 3], "invented", null],
])("%j is written out", (c, text, named) => {
  expect(curveText(c)).toBe(text);
  const values: Record<string, number> = {
    decay: 8,
    decayMulti: 1 + (2 * 802) / 1002,
    intervalAdd: 3,
    add: c[2] === 0 ? 21 : 4 * (3 + 5),
    bigBase: 11,
    reduce: 44,
    addDECAY: 20,
  };
  const formula = curveFormula(c, values[c[0]] ?? 0, "Level");
  expect(formula?.[0] ?? null).toBe(named);
  if (named) expect(formula?.[1]).toBe(`${text} = ${fx3(values[c[0]] ?? 0)}`);
});

test("a curve that does not give the row's value has no formula", () => {
  expect(curveFormula(["decay", 40, 100, 25], 9, "Level")).toBeNull();
});

test("the constants are named by their role, and an add that does not grow has one", () => {
  expect(curveConstants(["decay", 40, 100, 25])).toEqual([
    ["Max bonus of the curve", 40],
    ["Level at half of the max", 100],
  ]);
  expect(curveConstants(["add", 3, 0, 7])).toEqual([
    ["Per-level bonus of the curve", 3],
  ]);
  expect(curveConstants(["addDECAY", 2, 1, 10])).toEqual([
    ["Curve constant 1", 2],
    ["Curve constant 2", 1],
  ]);
});

test.each<[Curve, number, { share: number; max: number } | null]>([
  [
    ["decay", 40, 100, 162.5],
    24.761904761904763,
    { share: 0.6190476190476191, max: 40 },
  ],
  [["decayMulti", 2, 200, 200], 2, { share: 0.5, max: 3 }],
  [["add", 3, 0, 7], 21, null],
  [["intervalAdd", 1, 10, 25], 3, null],
  [["decay", -5, 100, 25], -1, null],
  [["decay", 40, 100, 25], 50, null],
])("the share of the maximum of %j (FR-015a)", (c, v, reached) => {
  expect(maxReachedOf(c, v)).toEqual(reached);
});

test("only the curve block with numbers is a curve", () => {
  expect(curveOf("ArbitraryCode5Inputs", ["decay", 40, 100, 25, 0])).toEqual([
    "decay",
    40,
    100,
    25,
  ]);
  expect(curveOf("ArbitraryCode5Inputs", ["decay", "40", 100, 25])).toBeNull();
  expect(curveOf("Invented", ["decay", 40, 100, 25])).toBeNull();
});

test("the input is the caller's one read with the curve's value, not its own working value", () => {
  const reads: [string, unknown][] = [
    ["Invented.level", 25],
    ["Invented.count", 3],
    ["List.length", 25],
  ];
  expect(inputRead(25, reads, new Set())).toBe("Invented.level");
  expect(inputRead(25, reads, new Set(["Invented.level"]))).toBeNull();
  expect(inputRead(25, [...reads, ["Other.level", 25]], new Set())).toBeNull();
  expect(inputRead(99, reads, new Set())).toBeNull();
});
