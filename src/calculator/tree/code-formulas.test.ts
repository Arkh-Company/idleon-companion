// The ⓘ the game's code gives a row (spec 008, T017: pieces.cjs exprFormula, callFormula and familyFormula), over
// expressions and calls written by hand with invented blocks and paths. A part is a token until the row's parts exist.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { node as windowNode } from "../../renderer/formula-fixture.ts";
import { formulaLines } from "../../renderer/tree-text.ts";
import { makeCodeFormulas } from "./code-formulas.ts";
import { formulaFor, token, withFormula } from "./formulas.ts";
import type { Pair } from "./formulas.ts";
import { NAMES_BY_LABEL } from "./names.ts";
import type { Expr, Step } from "./steps.ts";
import {
  at,
  callOf,
  recNode as node,
  read as readRow,
} from "./tree-fixture.ts";

const num = (v: number): Expr => ({ t: "num", v });
const val = (v: number): Expr => ({ t: "val", v });
const read = (p: string, v: number | boolean): Expr => ({ t: "read", p, v });
const call = (id: number, v: number): Expr => ({ t: "call", id, v });
const op = (o: string, l: Expr, r: Expr, v: number): Expr => ({
  t: "op",
  o,
  l,
  r,
  v,
});
const fn = (name: string, args: Expr[], v: number): Expr => ({
  t: "fn",
  name,
  args,
  v,
});
const { expr } = makeCodeFormulas([node(0, "Talk", { v: 4 })], () => []);
const reads = new Map();

/** A row's ⓘ from the code on its way to the window (its parts found, the main's check, "How it adds up"): its two lines. */
function expectShown(pair: Pair | null): void {
  if (!pair) return;
  const r = at(1, { xf: pair });
  const kids = [readRow("Stats.other", 123456)];
  const tree = checkTree(
    windowNode({ formula: withFormula(r, kids).formula }),
    1,
  );
  const shown = tree?.formula ? formulaLines(tree.formula) : null;
  expect(shown && [shown.names, shown.numbers]).toEqual(formulaFor(r, kids));
}

test.each<[string, Expr, number, [string, string] | null]>([
  [
    "a read and a constant",
    op("/", read("Stats.a", 8), num(4), 2),
    2,
    [`${token("c:Stats.a@8", "Stats.a")} ÷ 4`, "8 ÷ 4 = 2"],
  ],
  [
    "a bare value and a call",
    op("*", val(3), call(0, 4), 12),
    12,
    [`${token("v:3", "3")} × ${token("c:Talk()", "Talk()")}`, "3 × 4 = 12"],
  ],
  [
    "a sum inside a product, in brackets, through a def",
    op(
      "*",
      { t: "def", e: op("+", read("Stats.a", 1), num(2), 3), v: 3 },
      num(5),
      15,
    ),
    15,
    [`(${token("c:Stats.a@1", "Stats.a")} + 2) × 5`, "(1 + 2) × 5 = 15"],
  ],
  [
    "a cap",
    fn("min", [read("Stats.a", 9), num(5)], 5),
    5,
    [`min(${token("c:Stats.a@9", "Stats.a")}, 5)`, "min(9, 5) = 5"],
  ],
  [
    "0 + a part is the part",
    op("+", num(0), op("-", read("Stats.a", 9), num(1), 8), 8),
    8,
    [`${token("c:Stats.a@9", "Stats.a")} − 1`, "9 − 1 = 8"],
  ],
  ["0 + 0 stays", op("+", num(0), num(0), 0), 0, null],
  ["a value it does not give", op("/", read("Stats.a", 8), num(4), 2), 3, null],
  ["a read alone", read("Stats.a", 8), 8, null],
  ["only numbers of the code", op("+", num(1), num(2), 3), 3, null],
  ["a yes/no read", op("*", read("Stats.f", true), num(2), 2), 2, null],
  [
    "an operator it cannot write",
    op("%", read("Stats.a", 7), num(4), 3),
    3,
    null,
  ],
  ["a math name it cannot write", fn("sqrt", [read("Stats.a", 9)], 3), 3, null],
])("the expression of %s", (_name, e, v, formula) => {
  expect(expr(e, reads, v)).toEqual(formula);
  expectShown(formula);
});

test("a part with a name is written by its name until the row's parts exist (pieces.cjs pathName, callName)", () => {
  const [label = "", name = ""] = NAMES_BY_LABEL[0] ?? [];
  const nodes = [
    node(0, "Invented", { a: ["SomeMode", 0, 0], v: 4 }),
    node(1, "ArbitraryCode5Inputs", { a: ["bigBase", 4, 0, 10], v: 4 }),
  ];
  const e = op("*", read(`DNSM.${label}`, 2), call(0, 4), 8);
  const pair = makeCodeFormulas(nodes, () => []).expr(e, reads, 8);
  expect(pair).toEqual([
    `${token(`c:DNSM.${label}@2`, name.replace(/\s*\(.*\)$/, ""))} × ${token('c:Invented("SomeMode", 0, 0)', "Some Mode")}`,
    "2 × 4 = 8",
  ]);
  expectShown(pair);
  // the curve block is "Curve"
  expect(
    makeCodeFormulas(nodes, () => []).expr(
      op("+", call(1, 4), read("Stats.b", 1), 5),
      reads,
      5,
    )?.[0],
  ).toBe(
    `${token('c:ArbitraryCode5Inputs("bigBase", 4, 0, 10)', "Curve")} + ${token("c:Stats.b@1", "Stats.b")}`,
  );
});

test("an expression of one part is no ⓘ where two are asked", () => {
  const e = op("/", read("Stats.a", 8), num(4), 2);
  expect(expr(e, reads, 2, 2)).toBeNull();
  expect(
    expr(op("+", read("Stats.a", 8), read("Stats.b", 1), 9), reads, 9, 2)?.[1],
  ).toBe("8 + 1 = 9");
});

test("a talent inside a sum shows its own curve", () => {
  const nodes = [
    node(0, "GetTalentNumber", { a: [1, 7], v: 4, c: [1] }),
    node(1, "ArbitraryCode5Inputs", { a: ["bigBase", 4, 0, 10], v: 4 }),
  ];
  const e = op("+", call(0, 4), read("Stats.b", 1), 5);
  expect(makeCodeFormulas(nodes, () => []).expr(e, reads, 5)).toEqual([
    `(4 + 0 × (Points in the talent + All-talent levels)) + ${token("c:Stats.b@1", "Stats.b")}`,
    "(4 + 0 × 10) + 1 = 5",
  ]);
  expectShown(makeCodeFormulas(nodes, () => []).expr(e, reads, 5));
});

test("a call's last step with its value, else the curve it returns", () => {
  const step: Step = { v: 2, e: op("/", read("Stats.a", 8), num(4), 2) };
  const other: Step = { v: 9, e: op("+", read("Stats.a", 8), num(1), 9) };
  expect(
    callOf([node(0, "Calc", { v: 2, r: [["Stats.a", 8]] })], {
      0: [step, other],
    }),
  ).toEqual([`${token("c:Stats.a@8", "Stats.a")} ÷ 4`, "8 ÷ 4 = 2"]);
  const curve = [
    node(0, "Box", { v: 4, c: [1], r: [["Stats.pts", 10]] }),
    node(1, "ArbitraryCode5Inputs", { a: ["bigBase", 4, 0, 10], v: 4 }),
  ];
  expect(callOf(curve, { 0: [{ v: 1, e: read("Stats.x", 1) }] })).toEqual([
    "4 + 0 × Stats.pts",
    "4 + 0 × 10 = 4",
  ]);
  expect(
    callOf(
      [
        curve[0] ?? node(0, "Box"),
        node(1, "ArbitraryCode5Inputs", { a: ["bigBase", 4, 0, 11], v: 4 }),
      ],
      { 0: [{ v: 1, e: read("Stats.x", 1) }] },
    )?.[0],
  ).toBe("4 + 0 × Level");
  expect(callOf([node(0, "Calc", { v: 2 })], { 0: [other] })).toBeNull();
});

test("a call kept from a cache takes its twin's ⓘ: the twin with calls, or the twin with steps", () => {
  const withCalls = [
    node(0, "RunCodeOfTypeXforThingY", { a: ["CardLv", "x"], v: 0 }),
    node(1, "RunCodeOfTypeXforThingY", { a: ["CardLv", "x"], v: 5, c: [2] }),
    node(2, "RiftStuff", { v: 0 }),
  ];
  // the first one is 0 by itself; the twin needs the same value
  expect(callOf(withCalls)).toEqual([
    "0 while no card is collected",
    "0 cards → 0",
  ]);
  const steps = { 1: [{ v: 2, e: op("/", read("Stats.a", 8), num(4), 2) }] };
  expect(
    callOf(
      [
        node(0, "Calc", { v: 2 }),
        node(1, "Calc", { v: 2, r: [["Stats.a", 8]] }),
      ],
      steps,
    )?.[1],
  ).toBe("8 ÷ 4 = 2");
  expect(
    callOf([node(0, "Calc", { v: 3 }), node(1, "Calc", { v: 2 })], steps),
  ).toBeNull();
  const twin = [
    node(0, "getbonus2", { v: 6 }),
    node(1, "getbonus2", { v: 6, c: [2, 3] }),
    node(2, "ArbitraryCode5Inputs", { v: 6 }),
    node(3, "ArbitraryCode5Inputs", { v: 1 }),
  ];
  expect(callOf(twin)?.[1]).toBe("max(6, 1) = 6");
});

test("a talent at 0 inside a sum is its call, and an expression of more than 30 parts is no ⓘ", () => {
  const nodes = [node(0, "GetTalentNumber", { a: [1, 7], v: 0 })];
  const e = op("+", call(0, 0), read("Stats.b", 1), 1);
  expect(makeCodeFormulas(nodes, () => []).expr(e, reads, 1)?.[0]).toBe(
    `${token("c:GetTalentNumber(1, 7)", "GetTalentNumber(1, 7)")} + ${token("c:Stats.b@1", "Stats.b")}`,
  );
  const many = Array.from({ length: 31 }, (_, i) =>
    read(`Stats.p${String(i)}`, 1),
  );
  const sum = many.reduce((a, x, i) => (i ? op("+", a, x, i + 1) : x));
  expect(expr(sum, reads, 31)).toBeNull();
  expect(
    expr(
      many.slice(0, 30).reduce((a, x, i) => (i ? op("+", a, x, i + 1) : x)),
      reads,
      30,
    )?.[1],
  ).toMatch(/= 30$/);
});

test("a talent at 50 levels outside a dungeon, the buff the game counts apart, and a curve of another value", () => {
  const talent = [
    node(0, "GetTalentNumber", { v: 5, c: [1, 2] }),
    node(1, "ArbitraryCode5Inputs", { a: ["bigBase", 0, 0.1, 50], v: 5 }),
    node(2, "RunCodeOfTypeXforThingY", { a: ["AllTalentLV", 3], v: 10 }),
  ];
  expect(callOf(talent)?.[0]).toBe(
    "0 + 0.1 × (Points in the talent + All-talent levels)",
  );
  const buff = [
    node(0, "GetBuffBonuses", { a: [46, 3], v: 7, c: [1] }),
    node(1, "GetTalentNumber", { v: 7 }),
  ];
  expect(callOf(buff)).toBeNull();
  const other = [
    node(0, "Box", { v: 4, c: [1, 2], r: [["Stats.pts", 10]] }),
    node(1, "ArbitraryCode5Inputs", { a: ["bigBase", 9, 0, 10], v: 9 }),
    node(2, "ArbitraryCode5Inputs", { a: ["bigBase", 4, 0, 10], v: 4 }),
  ];
  expect(callOf(other, { 0: [{ v: 1, e: read("Stats.x", 1) }] })?.[1]).toBe(
    "4 + 0 × 10 = 4",
  );
});
