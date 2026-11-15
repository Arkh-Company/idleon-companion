// formulas.cjs `formulaOf` (A), its rename: a branch whose name is its own sum with numbers takes the name of the sum's
// shape (SHAPES) when each number is one part and the sum gives its value; before the source's name (`fallback`).
import { expect, test } from "vitest";
import { atZero } from "./rows.ts";
import type { Row } from "./rows.ts";
import { shapeName } from "./shapes.ts";
import type { Expr } from "./steps.ts";
import { branch, cond, fixed, ones, read as part } from "./tree-fixture.ts";
import { fn, num, op, read } from "./term-fixture.ts";

const shaped = (e: Expr, group: Row[], v = Number(e.v)) =>
  shapeName(e, branch(v, group));
/** 1 + (a ÷ 100), with a = 5, and its three parts. */
const PCT = op("+", num(1), op("/", read("A", 5), num(100), 0.05), 1.05);
const pctParts = () => [
  fixed("Base 1", 1),
  part("A", 5),
  fixed("Percent to number (÷ 100)", 100),
];

test.each<[string, Expr, Row[], string]>([
  [
    "a ÷ (b + a)",
    op("/", read("A", 30), op("+", num(1000), read("A", 30), 1030), 30 / 1030),
    [part("A", 30), fixed("Base 1000", 1000)],
    "Level factor",
  ],
  ["a + (b ÷ c)", PCT, pctParts(), "Multiplier"],
  [
    "((a − b) × c) + d",
    op("+", op("*", op("-", read("L", 10), num(1), 9), num(2), 18), num(5), 23),
    [part("L", 10), fixed("Minus 1", 1), fixed("× 2", 2), fixed("Base 5", 5)],
    "Bonus from level",
  ],
  [
    "pow(floor(a), b)",
    fn("pow", [fn("floor", [read("A", 7.5)], 7), num(2)], 49),
    [part("A", 7.5), fixed("Exponent 2", 2)],
    "Points curve",
  ],
])("bench formulas.cjs SHAPES: the shape %s", (_shape, e, group, name) => {
  expect(shaped(e, group)).toBe(name);
});

test("a shape names the branch only when each number is one part and the sum gives the value", () => {
  // a number two parts have, or none
  expect(shaped(PCT, [...pctParts(), part("B", 5)])).toBeNull();
  expect(shaped(PCT, pctParts().slice(0, 2))).toBeNull();
  // the sum with the parts' values is not the branch's
  expect(shaped(PCT, pctParts(), 2)).toBeNull();
  // a Condition among the parts
  expect(shaped(PCT, [...pctParts(), cond("A = 0", false)])).toBeNull();
  // a name that is no sum with numbers (round is no math name of one), or a sum of no shape
  const round = fn("round", [read("A", 7.5)], 8);
  expect(
    shaped(fn("pow", [fn("floor", [round], 8), num(2)], 64), [
      part("A", 7.5),
      fixed("Exponent 2", 2),
    ]),
  ).toBeNull();
  expect(
    shaped(op("*", read("A", 5), num(40), 200), [
      part("A", 5),
      fixed("× 40", 40),
    ]),
  ).toBeNull();
});

test("a number of the name is a part's value as the name writes it; the sum takes the exact values", () => {
  const v = 1.23456;
  const e = op(
    "+",
    num(1),
    op("/", read("A", v), num(100), v / 100),
    1 + v / 100,
  );
  expect(
    shaped(e, [
      fixed("Base 1", 1),
      part("A", v),
      fixed("Percent to number (÷ 100)", 100),
    ]),
  ).toBe("Multiplier");
  // or within a millionth of it: a part of 12345.01 is the name's 12345
  const big = op(
    "+",
    num(1),
    op("/", read("A", 12345), num(100), 123.45),
    124.45,
  );
  expect(
    shaped(
      big,
      [
        fixed("Base 1", 1),
        part("A", 12345.01),
        fixed("Percent to number (÷ 100)", 100),
      ],
      1 + 12345.01 / 100,
    ),
  ).toBe("Multiplier");
});

test("the group of the parts at ×1 is no part; the parts at 0 are", () => {
  expect(shaped(PCT, [...pctParts(), ones(part("X", 1), part("Y", 1))])).toBe(
    "Multiplier",
  );
  const zero = op("+", num(1), op("/", read("A", 0), num(100), 0), 1);
  expect(
    shaped(
      zero,
      atZero(
        [
          fixed("Base 1", 1),
          part("A", 0),
          fixed("Percent to number (÷ 100)", 100),
        ],
        "sum",
      ),
    ),
  ).toBe("Multiplier");
  // two parts at 0 under the At 0 group are two parts: the 0 of the name is neither
  const level = op(
    "/",
    read("A", 0),
    op("+", num(1000), read("A", 0), 1000),
    0,
  );
  expect(
    shaped(
      level,
      atZero([part("A", 0), fixed("Base 1000", 1000), part("B", 0)], "sum"),
    ),
  ).toBeNull();
});
