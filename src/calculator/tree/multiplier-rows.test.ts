// Each multiplier is one × row with its source's name (fix tree-shape-091, rule 2; FR-018: each multiplier is its own ×
// row and opens in its children; audit family 7): a factor 1 + x ÷ 100, or 1 + k × x ÷ 100, of one source in a Multi
// pool is the row of its source's name, its value the factor; the source under it by its role, "Bonus"; its math, its
// constants ("Base 1", "÷ 100", "× 5") in its ⓘ only, never loose in the pool. Over the invented game (fake-game.js
// TreeShapeMulti), invented values.
import { expect, test } from "vitest";
import type { CalcTreeNode } from "../tree-contract.ts";
import { byRole } from "./inline.ts";
import { row as nodeOf } from "./rows.ts";
import { CONSTANT, kidsOpen, linesOf, shapeTree } from "./shape-fixture.ts";

const build = () => shapeTree("TreeShapeMulti");
const multi = (b: ReturnType<typeof build>) =>
  b.root.kids === "lazy"
    ? undefined
    : b.root.kids.find((k) => k.name === "Multi pool");
const group = (b: ReturnType<typeof build>, name: string) =>
  kidsOpen(b, multi(b)).find((k) => k.role === "system" && k.name === name);
const row = (k: CalcTreeNode | undefined) => [
  k?.name,
  k?.value,
  k?.fmt,
  k?.code,
  k?.role,
];

test("a factor 1 + x ÷ 100 of one source is the × row of its source's name, the source its Bonus, in %", () => {
  const b = build();
  expect(b.root.value).toBeCloseTo(12 * 1.15 * 1.2 * 1.95 * 1.01, 9);
  const charms = group(b, "🌟 Pristine Charms");
  expect(row(charms)).toEqual([
    "🌟 Pristine Charms",
    1.15,
    "x",
    null,
    "system",
  ]);
  const [candy, ...rest] = kidsOpen(b, charms);
  expect(rest).toEqual([]);
  expect(row(candy)).toEqual(["Cotton Candy", 1.15, "x", null, "piece"]);
  // its rows by their role, no constant among them; its math, the constants too, in its ⓘ, closing (FR-008)
  expect(kidsOpen(b, candy).map(row)).toEqual([
    ["Bonus", 15, "%", 'Ninja("PristineBon", 3, 0)', "piece"],
  ]);
  expect(candy?.formula).toEqual([
    ["1", "+", "(", "Bonus", "÷", "100", ")"],
    [1, 15, 100, 1.15],
  ]);
});

test("a factor 1 + k × x ÷ 100 is the × row of its source too, k in its ⓘ; no constant is loose in the pool", () => {
  const b = build();
  const cards = group(b, "🃏 Cards");
  const [card] = kidsOpen(b, cards);
  expect([card?.value, card?.fmt, card?.code]).toEqual([1.2, "x", null]);
  expect(kidsOpen(b, card).map((k) => [k.code, k.value])).toEqual([
    ["CardBonusREAL(1)", 4],
  ]);
  const [names, numbers] = linesOf(card?.formula);
  expect(names).toContain("5 ×");
  expect(numbers?.split(" ").at(-1)).toBe("1.2");
  // the pool's rows are its systems' groups; none of its rows nor of its groups is a constant of the code
  const all = kidsOpen(b, multi(b));
  expect(all.every((k) => k.role === "system")).toBe(true);
  expect(
    [...all, ...all.flatMap((g) => kidsOpen(b, g))]
      .map((k) => k.name)
      .filter((n) => CONSTANT.test(n)),
  ).toEqual([]);
});

test("a part named as its row, a tag at its end, takes its role in the ⓘ too, where it is written short", () => {
  // the Tome's "Drop Rate (multi)" over its source "Drop Rate (multi)", which the ⓘ writes "Drop Rate" (formulas.ts short)
  const src = {
    node: nodeOf({
      pieceKey: "s",
      value: 27.5,
      code: 'Summoning("TomeBonus", 7, 0)',
      name: "Drop Rate (multi)",
    }),
    open: null,
  };
  const out = byRole("Drop Rate (multi)", {
    formula: [
      ["1", "+", "(", "Drop Rate", "÷", "100", ")"],
      [1, 27.5, 100, 1.275],
    ],
    rows: [src],
  });
  expect(out.rows.map((k) => k.node.name)).toEqual(["Bonus"]);
  expect(Array.isArray(out.formula) && out.formula[0]).toEqual([
    "1",
    "+",
    "(",
    "Bonus",
    "÷",
    "100",
    ")",
  ]);
});
