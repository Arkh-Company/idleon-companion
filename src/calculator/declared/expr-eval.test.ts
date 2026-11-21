// The evaluator of a recorded expression (spec 010, FR-010, research R2): the lock rebuilds a level's sum with its
// children's values and compares it with the recorded value. Never `eval`: an operator or a function it does not know
// gives null, never an exception.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { Expr } from "../recorded/steps.ts";
import { evalExpr } from "./expr-eval.ts";

const num = (v: number): Expr => ({ t: "num", v });
const call = (id: number, v = 0): Expr => ({ t: "call", id, v });
const read = (p: string, v = 0): Expr => ({ t: "read", p, v });
const op = (o: string, l: Expr, r: Expr): Expr => ({ t: "op", o, l, r, v: 0 });
const fn = (name: string | null, ...args: Expr[]): Expr => ({
  t: "fn",
  name,
  args,
  v: 0,
});

/** Children's values: call 1 is 4, call 2 is 10, the read A[1] is 3; nothing else has one. */
const kids = (e: Expr): number | undefined =>
  e.t === "call"
    ? { 1: 4, 2: 10 }[e.id]
    : e.t === "read" && e.p === "A[1]"
      ? 3
      : undefined;
const run = (e: Expr) => evalExpr(e, kids);

test("sum, product, division, power and unary minus over the children's values", () => {
  expect(run(op("+", call(1), read("A[1]")))).toBe(7);
  expect(
    run(op("*", call(1), op("+", num(1), op("/", call(2), num(100))))),
  ).toBeCloseTo(4.4);
  expect(run(op("/", call(2), call(1)))).toBe(2.5);
  expect(run(op("**", call(1), num(2)))).toBe(16);
  expect(run(op("-", num(0), call(2)))).toBe(-10);
  expect(run(op("-", call(2), read("A[1]")))).toBe(7);
  expect(run({ t: "def", e: op("*", call(1), num(2)), v: 8 })).toBe(8);
});

test("the Math functions makeSteps records", () => {
  expect(run(fn("min", call(1), call(2)))).toBe(4);
  expect(run(fn("max", call(1), call(2), num(12)))).toBe(12);
  expect(run(fn("floor", op("/", call(2), call(1))))).toBe(2);
  expect(run(fn("ceil", op("/", call(2), call(1))))).toBe(3);
  expect(run(fn("pow", call(1), num(0.5)))).toBe(2);
  expect(run(fn("log", num(Math.E)))).toBe(1);
});

test("a reference takes its child's value; one with no value gives null", () => {
  expect(evalExpr(op("+", call(1), call(9)), kids)).toBe(null);
  expect(evalExpr(read("B[2]", 5), kids)).toBe(null);
  // a value with no source has no child either
  expect(evalExpr({ t: "val", v: 3 }, kids)).toBe(null);
  // the child's value wins over the recorded one
  expect(evalExpr(call(1, 99), kids)).toBe(4);
});

test("an unknown operator or function, and a division by zero, give null and never throw", () => {
  expect(run(op("<<", call(1), num(1)))).toBe(null);
  expect(run(fn(null, call(1)))).toBe(null);
  expect(run(fn("unknownFn", call(1)))).toBe(null);
  expect(run(op("/", call(1), num(0)))).toBe(null);
  expect(run({ t: "num", v: "(text)" })).toBe(null);
});

test("the evaluator never uses eval nor Function", () => {
  const code = readFileSync(join(import.meta.dirname, "expr-eval.ts"), "utf8");
  expect(code).not.toMatch(/\beval\s*\(/);
  expect(code).not.toMatch(/\bFunction\s*\(/);
  expect(code).not.toMatch(/new\s+Function/);
});
