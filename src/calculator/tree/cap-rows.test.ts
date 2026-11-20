// Each cap of the game is one row with the name of what it caps (fix tree-shape-091, rule 4; Vinicius: everything has a
// name, never "Game value"): c + max((x − c)^e, 0) and c × (x ÷ c)^e, one after the other on the same part, are one row,
// "Base Damage", "Damage Bonus" or "Damage Multi" (the part of the max damage it caps), straight in its pool, in no
// group; its rows the sources of x by system (rule 1; no group "🔹 Other": Vinicius, 19/11), its ⓘ their sum or
// product by those rows' names, never "Game value"; its constant, exponent and floor in its ⓘ only, never loose in the
// pool, the cap's c added before its step too. Over the invented game (fake-game.js TreeShapeCaps), invented values.
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
const X = 30 + 8000 + 7 + 25;
const BASE = 5000 + Math.pow(4000 + Math.pow(X - 4000, 0.9) - 5000, 0.8);
const M = 8 * 6 * 1.15;
const BONUS = 20 * Math.pow((10 + Math.pow(M - 10, 0.86)) / 20, 0.5);
const MULTI = 2 * Math.pow((6 * 1.04 * 1.15) / 2, 0.6);

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
  // its rows are the sources of the part by system, two of the same name each in its own system's group, the sources
  // of no system after them; no constant of its caps among them
  const kids = kidsOpen(b, base);
  expect(kids.map((k) => [k.name, k.code, k.role])).toEqual([
    ["🕹️ Arcade", null, "system"],
    ["🧪 Lab", null, "system"],
    [
      "Damage working value, part 1",
      "DummyNumbersStatManager.DamageDealtLIST[0]",
      "piece",
    ],
    [expect.any(String), "TreeLevel", "piece"],
  ]);
  expect(
    kids.slice(0, 2).map((g) => kidsOpen(b, g).map((k) => [k.name, k.code])),
  ).toEqual([
    [["Base Damage", null]],
    [["Base Damage", 'Labb("BaseDamage", 0, 0)']],
  ]);
  // its ⓘ: both caps around the sum of its sources, closing on its value (FR-008)
  expect(Array.isArray(base?.formula)).toBe(true);
  const [names, numbers] = linesOf(base?.formula);
  expect(names).toMatch(
    /^5000 \+ max \( pow \( \( 4000 \+ max \( pow \( \( .+ \) − 4000 , 0\.9 \) , 0 \) \) − 5000 , 0\.8 \) , 0 \)$/,
  );
  expect(names).toContain(
    "( 🕹️ Arcade + 🧪 Lab + Damage working value, part 1 + TreeLevel )",
  );
  expect(names).not.toContain("Game value");
  expect(numbers?.split(" ").at(-1)).toBe(String(+BASE.toFixed(3)));
});

test("caps of a part multiplied in the pool are one row each, named by the part; no cap's constant is loose in the pool", () => {
  const { b, multi } = caps();
  const rows = kidsOpen(b, multi);
  const all = [...rows, ...rows.flatMap((g) => kidsOpen(b, g))];
  // the capped parts are rows straight in the pool, in no group
  expect(rows.map((k) => [k.name, k.role])).toEqual([
    ["Damage Bonus", "piece"],
    ["Damage Multi", "piece"],
    [expect.any(String), "piece"],
  ]);
  const part = (name: string) => rows.find((k) => k.name === name);
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
  // the part's sources are its rows by system, the multiplier among them its × row (rule 2)
  expect(
    kidsOpen(b, part("Damage Bonus")).map((k) => [k.name, k.code]),
  ).toEqual([
    ["🌟 Pristine Charms", null],
    [
      "Damage working value, part 2",
      "DummyNumbersStatManager.DamageDealtLIST[1]",
    ],
    [expect.any(String), "TreeLoop()"],
  ]);
  expect(all.map((k) => k.name).filter((n) => CONSTANT.test(n))).toEqual([]);
  // a multiplier of a step under the part's own is its × row too, in its system's group (rule 2)
  const third = kidsOpen(b, part("Damage Multi"));
  expect(third.map((k) => [k.name, k.code])).toEqual([
    ["🃏 Cards", null],
    ["🌟 Pristine Charms", null],
    [
      "Damage working value, part 3",
      "DummyNumbersStatManager.DamageDealtLIST[2]",
    ],
  ]);
  expect(kidsOpen(b, third[1]).map((k) => [k.name, k.fmt, k.value])).toEqual([
    ["Cotton Candy", "x", 1.15],
  ]);
  // the caps' rows have names, never the generic one (the invented calls under them have none in the invented game)
  expect(
    ["Damage Bonus", "Damage Multi"].map((n) => part(n)?.flags.unnamed),
  ).toEqual([undefined, undefined]);
});
