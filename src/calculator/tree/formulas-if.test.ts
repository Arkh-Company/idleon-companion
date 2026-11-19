// The ⓘ of a branch with checks among its parts, its If (spec 008, T017: formulas.cjs `addFormulas` for one row), apart
// from the other shapes in formulas.test.ts, over rows written by hand: a read is written by its path (no name yet,
// FR-012a), a constant of the code by its number.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { node } from "../../renderer/formula-fixture.ts";
import { formulaLines } from "../../renderer/tree-text.ts";
import { formulaFor, token, withFormula } from "./formulas.ts";
import type { FormulaRow } from "./formulas.ts";
import { formulaOut } from "./math.ts";
import type { Row } from "./rows.ts";
import { at, cond, fixed, read } from "./tree-fixture.ts";

const tok = token;
/** A row with a name, as US1c gives it: no longer a path. */
const named = (r: Row): Row => ({ ...r, node: { ...r.node, flags: {} } });

/** The row's ⓘ on its way to the window (the worker's formula, the main's check, "How it adds up"): its two lines. */
function expectShown(r: FormulaRow, kids: Row[]): void {
  const tree = checkTree(node({ formula: withFormula(r, kids).formula }), 1);
  expect(tree).not.toBeNull();
  const shown = tree?.formula ? formulaLines(tree.formula) : null;
  expect(shown && [shown.names, shown.numbers]).toEqual(formulaFor(r, kids));
}

test("an expression that only repeats the row's own term gives way to its If", () => {
  const n = at(6, { xf: [`6 × ${tok("c:Own()", "Own()")}`, "6 × 1 = 6"] });
  expect(
    formulaFor(n, [cond("Stats.f = 1", true), read("Stats.x", 6)]),
  ).toEqual(["If Stats.f = 1: Stats.x", "yes → 6"]);
  expectShown(n, [cond("Stats.f = 1", true), read("Stats.x", 6)]);
});

test.each<[string, number, Row[], [string, string] | null, string?]>([
  [
    "the literal the checks give, with all its checks",
    35,
    [
      cond("Stats.a ≥ 3", true),
      cond("Stats.b = 1", false),
      fixed("Fixed value", 35),
    ],
    ["If Stats.a ≥ 3 and not (Stats.b = 1): 35", "yes → 35"],
  ],
  [
    "a 1 when all checks pass",
    1,
    [cond("Stats.a = 1", true), cond("Stats.b < 2", false)],
    ["If Stats.a = 1 and not (Stats.b < 2): 1", "yes → 1"],
  ],
  [
    "one true check and the part it picks",
    9,
    [cond("Stats.f = 1", true), read("Stats.x", 9), read("Stats.y", 2)],
    ["If Stats.f = 1: Stats.x", "yes → 9"],
  ],
  [
    "one true check and its own 1",
    1,
    [cond("Stats.f = 1", true), read("Stats.y", 2)],
    ["If Stats.f = 1: 1", "yes → 1"],
  ],
  [
    "one true check and a literal of the code",
    25,
    [cond("Stats.f = 1", true), read("Stats.y", 2)],
    ["If Stats.f = 1: 25", "yes → 25"],
  ],
  [
    "one true check, no part and no literal",
    2.5,
    [cond("Stats.f = 1", true), read("Stats.y", 2)],
    null,
  ],
  [
    "a failed check beside the 0 it returns",
    0,
    [cond("Stats.f = 1", false), fixed("Value when the check fails", 0)],
    ["If not (Stats.f = 1): Value when the check fails", "no → 0"],
  ],
  [
    "a failed check and the part that is the value",
    4.5,
    [cond("Stats.f = 1", false), read("Stats.x", 4.5), read("Stats.y", 2)],
    ["If not (Stats.f = 1): Stats.x", "no → 4.5"],
  ],
  [
    "a check that only starts another is left out",
    9,
    [
      cond("Stats.f = 1", true),
      cond("Stats.f = 1 and Stats.g > 2", true),
      read("Stats.x", 9),
    ],
    ["If Stats.f = 1 and Stats.g > 2: Stats.x", "yes → 9"],
  ],
  [
    "a named check that ends in a call stays whole",
    9,
    [named(cond("Stats.a = Calc(2)", true)), read("Stats.x", 9)],
    ["If Stats.a = Calc(2): Stats.x", "yes → 9"],
  ],
  [
    "a check whose text cannot be followed",
    9,
    [cond("0 = 0 and Stats.g > 2", true), read("Stats.x", 9)],
    null,
  ],
  [
    "the parts beside the checks make a sum",
    3.5,
    [cond("Stats.f = 1", true), read("Stats.a", 1.5), fixed("Base 2", 2)],
    ["Stats.a + 2", "1.5 + 2 = 3.5"],
  ],
  [
    "a card level says its checks elsewhere",
    9,
    [cond("Stats.f = 1", true), read("Stats.x", 9)],
    null,
    'RunCodeOfTypeXforThingY("CardLv", "x")',
  ],
])("If: %s", (_name, v, kids, formula, code) => {
  expect(formulaFor(at(v, code ? { code } : {}), kids)).toEqual(formula);
  expectShown(at(v, code ? { code } : {}), kids);
});

test("a sum that counts its yes/no among its terms is said by its expression", () => {
  const xweak: [string, string] = [
    `${tok("c:Stats.s@7", "Stats.s")} × 1`,
    "7 × 1 = 7",
  ];
  const kids = [
    cond("Stats.f = 1", true),
    read("Stats.a", 2),
    read("Stats.b", 4),
  ];
  expect(formulaFor(at(7, { xweak }), kids)).toEqual([
    "Stats.s × 1",
    "7 × 1 = 7",
  ]);
  // with no such sum, the If stays
  expect(formulaFor(at(7, { xweak: ["x", "9 × 1 = 7"] }), kids)).toEqual([
    "If Stats.f = 1: 7",
    "yes → 7",
  ]);
  expectShown(at(7, { xweak }), kids);
  expectShown(at(7, { xweak: ["x", "9 × 1 = 7"] }), kids);
});

test("an If of long checks is no ⓘ, and the tree still passes the main's check: the worker's longest line is the main's", () => {
  const long = (i: number) => cond(`Stats.${"a".repeat(60)}${String(i)}`, true);
  const kids = [long(1), long(2), long(3), fixed("Fixed value", 35)];
  const { formula } = withFormula(at(35), kids);
  expect(checkTree(node({ formula }), 1)).toEqual(node({ formula: null }));
  for (const n of [200, 201])
    expect(
      checkTree(node({ formula: formulaOut(["x".repeat(n), "yes → 1"]) }), 1),
    ).not.toBeNull();
});
