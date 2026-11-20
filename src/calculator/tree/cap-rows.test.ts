// Each cap of the game is one row with the name of what it caps (fix tree-shape-091, rule 4; Vinicius: everything has a
// name, never "Game value"): c + max((x − c)^e, 0) and c × (x ÷ c)^e, one after the other on the same part, are one row,
// "Base Damage", "Damage Bonus" or "Damage Multi" (the part of the max damage it caps); its rows the sources of x, its
// constant, exponent and floor in its ⓘ only, never loose in the pool, the cap's c added before its step too. Over the
// invented game (fake-game.js TreeShapeCaps), invented values.
import { expect, test } from "vitest";
import type { CalcTreeNode } from "../tree-contract.ts";
import { CONSTANT, kidsOpen, linesOf, shapeTree } from "./shape-fixture.ts";

const caps = () => {
  const b = shapeTree("TreeShapeCaps");
  const [add, multi] = kidsOpen(b, b.root);
  return { b, add, multi };
};
/** Each row under `n`, opened, at any depth below it, down to `depth`. */
const below = (
  b: ReturnType<typeof shapeTree>,
  n: CalcTreeNode | undefined,
  depth = 3,
): CalcTreeNode[] =>
  depth === 0
    ? []
    : kidsOpen(b, n).flatMap((k) => [k, ...below(b, k, depth - 1)]);
// the parts as the invented block gives them
const X = 30 + 8000 + 25;
const BASE = 5000 + Math.pow(4000 + Math.pow(X - 4000, 0.9) - 5000, 0.8);
const M = 8 * 6 * 1.15;
const BONUS = 20 * Math.pow((10 + Math.pow(M - 10, 0.86)) / 20, 0.5);
const MULTI = 2 * Math.pow((6 * 1.04) / 2, 0.6);

test("the tests' constant is a name of the code's place, Base and its number, never a proven name", () => {
  expect(
    [
      "Base 1",
      "Base 2500",
      "Percent to number (÷ 100)",
      "Minimum 0",
      "Cap 1.3",
    ].map((n) => CONSTANT.test(n)),
  ).toEqual([true, true, true, true, true]);
  expect(
    ["Base Damage", "Base statue bonus", "Bonus", "Cotton Candy"].map((n) =>
      CONSTANT.test(n),
    ),
  ).toEqual([false, false, false, false]);
});

test("two caps of a part summed in the pool are one row of the part's name, its sources its rows, its caps in its ⓘ", () => {
  const { b, add } = caps();
  expect(b.root.value).toBeCloseTo(BASE * BONUS * MULTI * 6, 6);
  const rows = kidsOpen(b, add);
  expect(
    rows
      .map((k) => k.name)
      .filter((n) => /^(?:Fixed |Minus |Exponent |Minimum )/.test(n)),
  ).toEqual([]);
  const base = rows.find((k) => k.name === "Base Damage");
  expect([base?.value, base?.code, base?.flags.unnamed]).toEqual([
    expect.closeTo(BASE, 9),
    null,
    undefined,
  ]);
  // its rows are the sources of the part, no constant of its caps among them
  const kids = kidsOpen(b, base);
  expect(kids.map((k) => k.name).filter((n) => CONSTANT.test(n))).toEqual([]);
  expect(below(b, base).map((k) => k.code)).toEqual(
    expect.arrayContaining([
      "DummyNumbersStatManager.DamageDealtLIST[0]",
      "ArcadeBonus(0)",
      "TreeLevel",
    ]),
  );
  // its ⓘ: both caps around the sum of its sources, closing on its value (FR-008)
  expect(Array.isArray(base?.formula)).toBe(true);
  const [names, numbers] = linesOf(base?.formula);
  expect(names).toMatch(
    /^5000 \+ max \( pow \( \( 4000 \+ max \( pow \( \( .+ \) − 4000 , 0\.9 \) , 0 \) \) − 5000 , 0\.8 \) , 0 \)$/,
  );
  expect(numbers?.split(" ").at(-1)).toBe(String(+BASE.toFixed(3)));
});

test("caps of a part multiplied in the pool are one row each, named by the part; no cap's constant is loose in the pool", () => {
  const { b, multi } = caps();
  const rows = kidsOpen(b, multi);
  const all = [...rows, ...rows.flatMap((g) => kidsOpen(b, g))];
  const part = (name: string) => all.find((k) => k.name === name);
  expect(
    ["Damage Bonus", "Damage Multi"].map((n) => [n, part(n)?.value]),
  ).toEqual([
    ["Damage Bonus", expect.closeTo(BONUS, 9)],
    ["Damage Multi", expect.closeTo(MULTI, 9)],
  ]);
  const [bonusNames] = linesOf(part("Damage Bonus")?.formula);
  expect(bonusNames).toMatch(
    /^20 × pow \( \( 10 \+ max \( pow \( .+ − 10 , 0\.86 \) , 0 \) \) ÷ 20 , 0\.5 \)$/,
  );
  const [multiNames] = linesOf(part("Damage Multi")?.formula);
  expect(multiNames).toMatch(/^2 × pow \( .+ ÷ 2 , 0\.6 \)$/);
  // the part's sources are its rows, the multiplier among them its × row (rule 2)
  expect(below(b, part("Damage Bonus")).map((k) => k.code)).toEqual(
    expect.arrayContaining([
      "DummyNumbersStatManager.DamageDealtLIST[1]",
      'Ninja("PristineBon", 3, 0)',
    ]),
  );
  expect(all.map((k) => k.name).filter((n) => CONSTANT.test(n))).toEqual([]);
  expect(all.map((k) => k.name)).not.toContain("Game value");
});
