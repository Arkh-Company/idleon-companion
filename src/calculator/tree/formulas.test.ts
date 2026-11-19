// Each shape of the ⓘ a branch gets from its parts (spec 008, T017: formulas.cjs `addFormulas` for one row), over rows
// written by hand: a read is written by its path (no name yet, FR-012a), a constant of the code by its number.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { node } from "../../renderer/formula-fixture.ts";
import { formulaLines } from "../../renderer/tree-text.ts";
import { formulaFor, token, withFormula } from "./formulas.ts";
import type { FormulaRow } from "./formulas.ts";
import { row } from "./rows.ts";
import { useGameTables } from "./table-names.ts";
import type { Row } from "./rows.ts";
import { at, branch, cond, fixed, read } from "./tree-fixture.ts";

/** A part at ×1 of a product level the 008 grouped (rows.ts `finish` marks it): the ⓘ leaves it aside. */
const asideAtOne = (r: Row): Row => ({
  ...r,
  asideAtOne: true,
});

const tok = token;

/** The row's ⓘ on its way to the window (the worker's formula, the main's check, "How it adds up"): its two lines. */
function expectShown(r: FormulaRow, kids: Row[]): void {
  const tree = checkTree(node({ formula: withFormula(r, kids).formula }), 1);
  expect(tree).not.toBeNull();
  const shown = tree?.formula ? formulaLines(tree.formula) : null;
  expect(shown && [shown.names, shown.numbers]).toEqual(formulaFor(r, kids));
}

test.each<[string, number, Row[], [string, string] | null]>([
  [
    "a product of the parts",
    12,
    [read("Stats.a", 3), read("Stats.b", 4)],
    ["Stats.a × Stats.b", "3 × 4 = 12"],
  ],
  [
    "a sum of the parts",
    7,
    [read("Stats.a", 3), read("Stats.b", 4)],
    ["Stats.a + Stats.b", "3 + 4 = 7"],
  ],
  [
    "a constant of the code as its number",
    6,
    [fixed("× 2", 2), read("Stats.a", 3)],
    ["2 × Stats.a", "2 × 3 = 6"],
  ],
  ["two parts with one term", 12, [branch(3), branch(4)], null],
  [
    "a sum beside the parts at ×1: its last form, by names",
    8,
    [
      fixed("Base 5", 5),
      read("Stats.a", 3),
      asideAtOne(read("Stats.o", 1)),
      asideAtOne(read("Stats.p", 1)),
    ],
    ["Base 5 + Stats.a", "5 + 3 = 8"],
  ],
  [
    "1 + a part ÷ 100",
    1.5,
    [read("Stats.a", 50)],
    ["1 + Stats.a ÷ 100", "1 + 50 ÷ 100 = 1.5"],
  ],
  [
    "a part ÷ 100",
    0.5,
    [read("Stats.a", 50)],
    ["Stats.a ÷ 100", "50 ÷ 100 = 0.5"],
  ],
  [
    "1 + a product ÷ 100",
    1.06,
    [read("Stats.a", 2), read("Stats.b", 3)],
    ["1 + (Stats.a × Stats.b) ÷ 100", "1 + (2 × 3) ÷ 100 = 1.06"],
  ],
  [
    "a product ÷ 100",
    0.06,
    [read("Stats.a", 2), read("Stats.b", 3)],
    ["(Stats.a × Stats.b) ÷ 100", "(2 × 3) ÷ 100 = 0.06"],
  ],
  [
    "1 + a sum ÷ 100",
    1.05,
    [read("Stats.a", 2), read("Stats.b", 3)],
    ["1 + (Stats.a + Stats.b) ÷ 100", "1 + (2 + 3) ÷ 100 = 1.05"],
  ],
])("%s", (_name, v, kids, formula) => {
  expect(formulaFor(at(v), kids)).toEqual(formula);
  expectShown(at(v), kids);
});

test("a curve part with the row's value gives its own ⓘ", () => {
  const curve: Row = {
    ...branch(4, [read("Stats.lv", 10)]),
    node: row({
      pieceKey: null,
      value: 4,
      code: "ArbitraryCode5Inputs()",
      name: "Curve: 4 + 0 × 10",
      flags: {},
    }),
    f: ["4 + 0 × Stats.lv", "4 + 0 × 10 = 4"],
  };
  expect(formulaFor(at(4), [curve, read("Stats.x", 9)])).toEqual(curve.f);
  expectShown(at(4), [curve, read("Stats.x", 9)]);
});

test("a row with its pair keeps it; one of only the parts at ×1 a product leaves aside has none (spec 009, FR-016)", () => {
  const ab = [read("Stats.a", 1), read("Stats.b", 1)];
  expect(formulaFor(at(7, { f: ["a", "b"] }), ab)).toEqual(["a", "b"]);
  expect(formulaFor(at(1), ab.map(asideAtOne))).toBeNull();
});

test.each<[string, string, Row[], string]>([
  [
    "a part with that code",
    tok("c:Stats.a@3", "Stats.a"),
    [read("Stats.a", 3)],
    "Stats.a ÷ 100",
  ],
  [
    "a curve by its input",
    tok("c:Curve()@3", "Curve()"),
    [
      {
        ...branch(3, [fixed("Max bonus of the curve", 5), read("Stats.lv", 2)]),
        node: row({
          pieceKey: null,
          value: 3,
          code: "Curve()",
          name: "Curve: 5 × 2",
          flags: {},
        }),
      },
    ],
    "curve of Stats.lv ÷ 100",
  ],
  [
    "a condition keeps the read's own term",
    tok("c:Stats.f@1", "Stats.f"),
    [cond("Stats.f = 1", true, "Stats.f"), read("Stats.x", 9)],
    "Stats.f ÷ 100",
  ],
  [
    "a call no part shows: the call",
    tok("c:Gone()", "Gone()"),
    [read("Stats.x", 9)],
    "Gone() ÷ 100",
  ],
  [
    "a call inside a branch of its value: the branch",
    tok("c:Inner()@11", "Inner()"),
    [branch(11, [read("Inner()", 3)]), fixed("Fixed value 11", 11)],
    "Game value ÷ 100",
  ],
  [
    "a read no part shows: the only part with its value",
    tok("c:Stats.gone@4", "Stats.gone"),
    [fixed("Fixed value 4", 4)],
    "Fixed value 4 ÷ 100",
  ],
  [
    "a bare value: the only part with it",
    tok("v:4", "4"),
    [fixed("Fixed value 4", 4)],
    "Fixed value 4 ÷ 100",
  ],
  [
    "a bare value two parts have: the number",
    tok("v:4", "4"),
    [fixed("Fixed value 4", 4), read("Stats.four", 4)],
    "4 ÷ 100",
  ],
])("the game's expression names %s", (_name, token, kids, names) => {
  const n = at(0.03, { xf: [`${token} ÷ 100`, "3 ÷ 100 = 0.03"] });
  expect(formulaFor(n, kids)).toEqual([names, "3 ÷ 100 = 0.03"]);
  expectShown(n, kids);
});

test("a product that closes only by a 0 is no ⓘ: the game's expression is", () => {
  const n = at(0, {
    xf: [`${tok("c:Stats.z@0", "Stats.z")} × 5`, "0 × 5 = 0"],
  });
  expect(formulaFor(n, [read("Stats.z", 0), read("Stats.a", 5)])).toEqual([
    "Stats.z × 5",
    "0 × 5 = 0",
  ]);
});

test.each<[string, string, [string, string] | null]>([
  // a cache path no rule names (FR-012a): its name is its path
  ["a cache path is no ⓘ", "DNSM.t[x]", null],
  ["another path keeps it", "Stats.t", ["0 + Stats.t", "0 + 5 = 5"]],
])("a formula that only adds 0 to %s", (_name, path, formula) => {
  const n = at(5, {
    xf: [`${tok("v:0", "0")} + ${tok(`c:${path}@5`, path)}`, "0 + 5 = 5"],
  });
  expect(formulaFor(n, [read(path, 5), read("Stats.q", 2)])).toEqual(formula);
});

// the skill by its name in the game's list, never by its index (family 2 of the audit of 19/11); an invented list
const RIFT = "1 if Rift level ≥ 15 and Invented Skill mastery rank > 2, else 0";
test.each<[number, number, number, [string, string]]>([
  [20, 4, 1, [RIFT, "20 ≥ 15 and 4 > 2 → 1"]],
  [20, 1, 0, [RIFT, "20 ≥ 15 and 1 ≤ 2 → 0"]],
  [10, 4, 0, [RIFT, "10 < 15 → 0"]],
  [20, 4, 5, [`5 × (${RIFT})`, "5 × 1 = 5"]],
])(
  "a skill's Rift bonus (deep-2): level %d, rank %d, value %d",
  (lv, rank, v, formula) => {
    useGameTables(
      new Map([["CustomLists.SkillNames", [0, 1, 2, "Invented Skill"]]]),
    );
    const n = at(v, { code: 'RiftStuff("RiftSkillBonus,3", 2)' });
    const kids = [read("Rift[0]", lv), read("DNSM.skillLvRanks[3]", rank)];
    expect(formulaFor(n, kids)).toEqual(formula);
    expectShown(n, kids);
    useGameTables(new Map());
  },
);

test.each<[string, Row[], number, string]>([
  [
    "a named part without its tag",
    [fixed("Bonus per level (talent 3)", 2), read("Stats.a", 3)],
    6,
    "Bonus per level × Stats.a",
  ],
  [
    "a part named by its own sum, in parentheses",
    [fixed("4 + 1", 5), read("Stats.a", 3)],
    15,
    "(4 + 1) × Stats.a",
  ],
  [
    "a part named by its cap, whole",
    [fixed("min(5, 2)", 2), read("Stats.a", 3)],
    6,
    "min(5, 2) × Stats.a",
  ],
  [
    "two parts with one short name: their whole names",
    [fixed("Bonus (a)", 2), fixed("Bonus (b)", 3)],
    1.05,
    "1 + (Bonus (a) + Bonus (b)) ÷ 100",
  ],
  [
    "a product of two parts with one short name",
    [fixed("Bonus (a)", 2), fixed("Bonus (b)", 3)],
    6,
    "Bonus (a) × Bonus (b)",
  ],
  [
    "a part with no name: its call, whole",
    [read("Calc(2)", 2), read("Stats.a", 3)],
    6,
    "Calc(2) × Stats.a",
  ],
  [
    "two caches with the generic name: their paths",
    [read("DNSM.CacheA[0]", 2), read("DNSM.CacheB[0]", 3)],
    6,
    "DNSM.CacheA[0] × DNSM.CacheB[0]",
  ],
])("%s", (_name, kids, v, names) => {
  expect(formulaFor(at(v), kids)?.[0]).toBe(names);
  expectShown(at(v), kids);
});

// The Meritocracy bonus multiplier's leftovers (audit family 14): a part named with a colon ("Arcade: …") or a sign
// split into two terms, so the ⓘ was no atoms and the unnamed step around it could not move up
test("a part whose name has a colon or a sign stays one term: the ⓘ is atoms and closes", () => {
  const named = (code: string, name: string, value: number): Row => ({
    node: row({ pieceKey: code, value, code, name }),
    open: null,
  });
  const kids = [
    named("Stats.a", "Arcade: Invented Bonus", 3),
    named("Stats.b", "Invented + More", 4),
  ];
  const r = branch(7, kids);
  expect(withFormula(r, kids).formula).toEqual([
    ["Arcade: Invented Bonus", "+", "Invented + More"],
    [3, 4, 7],
  ]);
});
