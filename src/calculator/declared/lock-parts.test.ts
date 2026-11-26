// A leaf's neutral value by its role in a level's count (T211; r2 of parts P and Q): 0 in a sum, 1 in a product and as
// a division's divisor; a numerator has none.
import { expect, test } from "vitest";
import type { Expr } from "../recorded/steps.ts";
import { neutralOf } from "./lock-parts.ts";

const leaf: Expr = { t: "read", p: "TreeBase", v: 4 };
const other: Expr = { t: "num", v: 2 };
const op = (o: string, l: Expr, r: Expr): Expr => ({ t: "op", o, l, r, v: 0 });

test("a leaf's neutral value: 0 in a sum, 1 in a product and as the divisor, none as the numerator (r2 of P and Q)", () => {
  expect(neutralOf(op("+", leaf, other), leaf)).toBe(0);
  expect(neutralOf(op("*", other, leaf), leaf)).toBe(1);
  expect(neutralOf(op("/", other, leaf), leaf)).toBe(1);
  expect(neutralOf(op("/", leaf, other), leaf)).toBe(null);
});

test("a leaf on the left of a subtraction has no neutral value: zeroing it gives minus the other side (r3 of P and Q)", () => {
  expect(neutralOf(op("-", other, leaf), leaf)).toBe(0);
  expect(neutralOf(op("-", leaf, other), leaf)).toBe(null);
});
