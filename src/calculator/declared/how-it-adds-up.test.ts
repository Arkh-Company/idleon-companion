// The ⓘ, "How it adds up" (spec 010, FR-016, research R11): made from a level's recorded expression with the names of
// its children, never kept; the root's joins the pools. Its text never has a block's name nor a game's path.
import { expect, test } from "vitest";
import type { Expr } from "../recorded/steps.ts";
import { curveFormula, howItAddsUp, rootFormula } from "./how-it-adds-up.ts";

const read = (p: string, v: number | boolean | null): Expr => ({
  t: "read",
  p,
  v,
});
const op = (o: string, l: Expr, r: Expr, v: number | boolean): Expr => ({
  t: "op",
  o,
  l,
  r,
  v,
});
const num = (v: number): Expr => ({ t: "num", v });
const NAMES: Record<string, string> = {
  TreeLevel: "Invented Level",
  TreeBase: "Invented Base",
  TreeOwned: "Invented Owned",
  TreeFlagOn: "Invented Flag",
};
const names = (e: Expr) => (e.t === "read" ? (NAMES[e.p] ?? null) : null);

test("a source's ⓘ comes from the recorded expression, with its children's names and their numbers", () => {
  const sum = op("+", read("TreeLevel", 25), read("TreeBase", 4), 29);
  expect(howItAddsUp(sum, names)).toEqual([
    ["Invented Level", "+", "Invented Base"],
    [25, 4, 29],
  ]);
  // the code's precedence keeps its parentheses, and a constant of the code is its number
  const product = op("*", sum, op("-", num(2), read("TreeOwned", 0), 2), 58);
  expect(howItAddsUp(product, names)).toEqual([
    [
      "(",
      "Invented Level",
      "+",
      "Invented Base",
      ")",
      "×",
      "(",
      "2",
      "−",
      "Invented Owned",
      ")",
    ],
    [25, 4, 2, 0, 58],
  ]);
  const fn: Expr = {
    t: "fn",
    name: "min",
    args: [read("TreeLevel", 25), num(10)],
    v: 10,
  };
  expect(howItAddsUp(fn, names)).toEqual([
    ["min", "(", "Invented Level", ",", "10", ")"],
    [25, 10, 10],
  ]);
});

test("a curve shows by its role, its two constants named (FR-016)", () => {
  expect(curveFormula("decay", 40, 100, 50, 40 / 3, "Talent points")).toEqual({
    rule: [
      "Max bonus of the curve × Talent points ÷ (Talent points + Level at half of the max)",
      "40 × 50 ÷ (50 + 100) = 13.333",
    ],
  });
  expect(curveFormula("intervalAdd", 2, 10, 35, 5, "Level")).toEqual({
    rule: [
      "Base of the curve + floor(Level ÷ Levels for each +1)",
      "2 + floor(35 ÷ 10) = 5",
    ],
  });
  // a curve its numbers do not give, or one not of the game's kinds, has no ⓘ of its own
  expect(curveFormula("decay", 40, 100, 50, 7, "Level")).toBeNull();
  expect(curveFormula("spiral", 1, 2, 3, 4, "Level")).toBeNull();
});

test("a branch's check goes to the ⓘ, as a rule of two lines", () => {
  const on = op(
    "&&",
    op("==", read("TreeFlagOn", 1), num(1), true),
    op("+", read("TreeLevel", 25), read("TreeBase", 4), 29),
    29,
  );
  expect(howItAddsUp(on, names)).toEqual({
    rule: [
      "Invented Level + Invented Base (Invented Flag = 1: yes)",
      "25 + 4 = 29",
    ],
  });
});

test("terms and numbers that do not pair give the 008's form of a rule", () => {
  // a part with no number: its place in the line of numbers says so
  const e = op("+", read("TreeLevel", 25), read("TreeBase", null), 29);
  expect(howItAddsUp(e, names)).toEqual({
    rule: ["Invented Level + Invented Base", "25 + ? = 29"],
  });
});

test("the root's ⓘ joins the pools with their numbers", () => {
  expect(
    rootFormula([
      { name: "Additive pool 1", value: 10, kind: "additive" },
      { name: "Multi pool 1", value: 2, kind: "multi" },
      { name: "Additive pool 2", value: 0.5, kind: "additive" },
      { name: "Multi pool 2", value: 1.2, kind: "multi" },
    ]),
  ).toEqual([
    [
      "(",
      "Additive pool 1",
      "×",
      "Multi pool 1",
      "+",
      "Additive pool 2",
      ")",
      "×",
      "Multi pool 2",
    ],
    [10, 2, 0.5, 1.2, (10 * 2 + 0.5) * 1.2],
  ]);
  // one pool is no join
  expect(
    rootFormula([{ name: "Multi pool", value: 2, kind: "multi" }]),
  ).toBeNull();
});

test("the text never has a block's name nor a game's path: a part with no name gives no ⓘ", () => {
  const call: Expr = { t: "call", id: 3, v: 4 };
  const e = op("+", read("TreeLevel", 25), call, 29);
  expect(howItAddsUp(e, names)).toBeNull();
  const hidden = op("+", read("TreeLevel", 25), read("TreeStats.b", 5), 30);
  expect(howItAddsUp(hidden, names)).toBeNull();
  const named = howItAddsUp(
    op("+", read("TreeLevel", 25), read("TreeBase", 4), 29),
    names,
  );
  expect(JSON.stringify(named)).not.toMatch(/Tree[A-Z]/);
});
