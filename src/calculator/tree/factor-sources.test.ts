// No source of a named system leaves its system's group (fix tree-shape-091, round 1; rule 1, FR-005, FR-017, the talent
// × count of the Open Questions): a factor 1 + (a + b) ÷ 100 of several sources inside a step the chain reads back is
// its own Multi pool, its sources by system, as the Drop Rate's "1 + (🍣 Sushi + 🫧 Jelly Operator) ÷ 100"; a bonus
// times a count, 1 + min(100, count × bonus) ÷ 100 or (bonus × count ÷ 1) ÷ 100, is the row of the bonus, in the
// bonus's system, its parts by their role. Over the invented game (fake-game.js TreeShapeLoose), invented values.
import { expect, test } from "vitest";
import type { CalcTreeNode } from "../tree-contract.ts";
import { kidsOpen, linesOf, shapeTree } from "./shape-fixture.ts";

const loose = () => {
  const b = shapeTree("TreeShapeLoose");
  return { b, pools: kidsOpen(b, b.root) };
};
const rowOf = (k: CalcTreeNode | undefined) => [k?.name, k?.code, k?.role];
// the parts: 30 + 0 + 15 × 25 ÷ 100; 8 × (1 + (4 + 8) ÷ 100) × (1 + min(100, 25 × 4) ÷ 100); 6 × 6
const FIRST = 30 + (15 * 25) / 100;
const SECOND = 8 * 1.12 * 2;
const THIRD = 6 * 6;

test("a factor 1 + (a + b) ÷ 100 of two systems inside a step is its own Multi pool, its sources by system", () => {
  const { b, pools } = loose();
  expect(b.root.value).toBeCloseTo(FIRST * SECOND * THIRD, 9);
  expect(pools.map((p) => [p.name, p.role, p.combine, p.value])).toEqual([
    ["Additive pool", "pool", "sum", expect.closeTo(FIRST, 9)],
    ["Multi pool 1", "pool", "product", expect.closeTo(16 * THIRD, 9)],
    ["Multi pool 2", "pool", "onePlusPercent", expect.closeTo(1.12, 9)],
  ]);
  const own = pools[2];
  expect(kidsOpen(b, own).map(rowOf)).toEqual([
    ["🃏 Cards", null, "system"],
    ["🕹️ Arcade", null, "system"],
  ]);
  expect(
    kidsOpen(b, own).map((g) => kidsOpen(b, g).map((k) => k.code)),
  ).toEqual([["CardBonusREAL(1)"], ["ArcadeBonus(0)"]]);
  expect(linesOf(own?.formula)[0]).toBe("1 + ( 🃏 Cards + 🕹️ Arcade ) ÷ 100");
  expect(linesOf(b.root.formula)[0]).toBe(
    "Additive pool × Multi pool 1 × Multi pool 2",
  );
});

test("a bonus times a count is the bonus's row in its system, its parts by their role, in a product and in a sum", () => {
  const { b, pools } = loose();
  // in the product: 1 + min(100, count × bonus) ÷ 100, the row of the bonus (the charm 2); the groups first, a source
  // of no system after them, never in a group "🔹 Other"
  const [charms, part, third, loop] = kidsOpen(b, pools[1]);
  expect(rowOf(part)).toEqual([
    "Damage working value, part 2",
    "DummyNumbersStatManager.DamageDealtLIST[1]",
    "piece",
  ]);
  expect(rowOf(charms)).toEqual(["🌟 Pristine Charms", null, "system"]);
  expect([third?.code, loop?.code]).toEqual([
    "DummyNumbersStatManager.DamageDealtLIST[2]",
    "TreeLoop()",
  ]);
  const [veil] = kidsOpen(b, charms);
  expect([veil?.name, veil?.value, veil?.fmt]).toEqual([
    "Glowing Veil",
    2,
    "x",
  ]);
  const parts = kidsOpen(b, veil);
  expect(
    parts.filter((k) => k.code !== null).map((k) => [k.name, k.code]),
  ).toEqual([
    [expect.any(String), "TreeLevel"],
    ["Bonus", 'Ninja("PristineBon", 2, 0)'],
  ]);
  expect(linesOf(veil?.formula)[0]).toContain("min ( 100 ,");
  // in the sum: (bonus × count ÷ 1) ÷ 100, the row of the bonus (the charm 3), in its system's group of the pool
  const sum = kidsOpen(b, pools[0]);
  const candy = sum.find((k) => k.name === "🌟 Pristine Charms");
  expect(kidsOpen(b, candy).map((k) => [k.name, k.value])).toEqual([
    ["Cotton Candy", expect.closeTo(3.75, 9)],
  ]);
  // every row straight in a pool is a system's group, a part of the math or a source of no system
  const straight = [...sum, ...kidsOpen(b, pools[1])].filter(
    (k) => k.role !== "system",
  );
  expect(straight.map((k) => k.code)).toEqual([
    "DummyNumbersStatManager.DamageDealtLIST[0]",
    "TreeOwned",
    "DummyNumbersStatManager.DamageDealtLIST[1]",
    "DummyNumbersStatManager.DamageDealtLIST[2]",
    "TreeLoop()",
  ]);
});
