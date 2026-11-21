// The formula line's arithmetic, without eval (tree/math.ts).
import { expect, test } from "vitest";
import { evaluate, formulaAtoms, formulaOut, isOperator } from "./math.ts";

test.each<[string, number]>([
  ["1 + 2 × 3", 7],
  ["(1 + 2) × 3", 9],
  ["10 ÷ 4 − 1", 1.5],
  ["2 - -3", 5],
  ["-(2 + 3) * 2", -10],
  ["2 ^ 3 ^ 2", 512],
  ["min(5, pow(2, 3))", 5],
  ["max(0.01, 1e-3)", 0.01],
  ["floor(7 ÷ 2) + ceil(0.2) + round(2.5)", 7],
  ["abs(-4) + sqrt(9)", 7],
  ["log₁₀(1000)", 3],
  ["log(1)", 0],
  ["1,000 + 1", 1001],
  ["9245 ÷ (1000 + 9245)", 9245 / 10245],
])("%s is %d", (line, value) => {
  expect(evaluate(line)).toBeCloseTo(value, 12);
});

test.each([
  "Level × 2",
  "1 +",
  "(1 + 2",
  "1 + 2)",
  "alert(1)",
  "constructor(1)",
  "3 mod 2",
  "",
  "1 ; 2",
])("%s is not arithmetic", (line) => {
  expect(evaluate(line)).toBeNaN();
});

test("a formula leaves the worker as its terms and its numbers, the result last", () => {
  expect(
    formulaAtoms([
      "40 × Invented.level ÷ (Invented.level + 100)",
      "40 × 25 ÷ (25 + 100) = 8",
    ]),
  ).toEqual([
    ["40", "×", "Invented.level", "÷", "(", "Invented.level", "+", "100", ")"],
    [40, 25, 25, 100, 8],
  ]);
  expect(formulaAtoms(["min(Ka, 1e-3)", "min(0.5, 0.001) = 0.001"])).toEqual([
    ["min", "(", "Ka", ",", "1e-3", ")"],
    [0.5, 0.001, 0.001],
  ]);
});

test("a known term stays whole, even with brackets in it", () => {
  const path = "Helper[5].behaviors.get(Event_2)._Owned.x";
  expect(formulaAtoms([`2 × ${path}`, "2 × 3 = 6"], [path])).toEqual([
    ["2", "×", path],
    [2, 3, 6],
  ]);
});

test("a thousands comma is part of its number", () => {
  expect(formulaAtoms(["Ka + 1,000", "5 + 1,000 = 1,005"])).toEqual([
    ["Ka", "+", "1000"],
    [5, 1000, 1005],
  ]);
});

test("each term that is not an operator has the next number; a math name is an operator", () => {
  const [terms, numbers] = formulaAtoms([
    "1 + floor(Level ÷ 10)",
    "1 + floor(25 ÷ 10) = 3",
  ]);
  expect(isOperator("floor")).toBe(true);
  expect(terms.filter((t) => !isOperator(t))).toEqual(["1", "Level", "10"]);
  expect(numbers).toEqual([1, 25, 10, 3]);
});

test.each<[string, [string, string], boolean]>([
  ["each term's number gives the result", ["Ka × 2", "3 × 2 = 6"], true],
  ["rounded numbers that give the result", ["Ka ÷ 3", "1 ÷ 3 = 0.333"], true],
  ["numbers that give another result", ["Ka + Kb", "3 + 4 = 9"], false],
  ["a result just past the rounding", ["Ka + Kb", "3 + 4 = 7.01"], false],
  ["one number too many", ["Ka (in a dungeon)", "50 = 5"], false],
  [
    "a line of numbers with no result",
    ["0 while Ka ≤ 0", "0 points → 0"],
    false,
  ],
  ["a sign no sum has", ["max(Ka: Kb)", "max(6, 2) = 6"], false],
])("%s: atoms %s", (_name, pair, atoms) => {
  expect(formulaOut(pair)).toEqual(atoms ? formulaAtoms(pair) : { rule: pair });
});

test("a rule with a line longer than the window takes is no ⓘ", () => {
  expect(formulaOut(["x".repeat(201), "yes → 1"])).toBeNull();
  expect(formulaOut(["If Ka: 1", `${"1 ".repeat(100)}→ 1`])).toBeNull();
  expect(formulaOut(["x".repeat(200), "yes → 1"])).toEqual({
    rule: ["x".repeat(200), "yes → 1"],
  });
});
