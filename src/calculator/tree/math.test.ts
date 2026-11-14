// The formula line's arithmetic, without eval (tree/math.ts).
import { expect, test } from "vitest";
import { evaluate } from "./math.ts";

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
