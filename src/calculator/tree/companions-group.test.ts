// The companions of a factor in their group (fix tree-shape-091, rule 3; FR-005, FR-017, rule Y; the clamp's answer B):
// max(1, min(1.3, 1 + a) × (1 + 0.5 × b)), a product of companions with a floor, beside max(1, min(1.01, 1 + c ÷
// 2500)), is the group "🐾 Companions" of its Multi pool, each companion its own × row; the floor and the cap of the
// product in the group's ⓘ, each companion's own math in its row's, its parts its rows, the companion by its role; the
// companion's check (owned) in its ⓘ, never a row. Over the invented game (fake-game.js TreeShapeMulti), invented values.
import { expect, test } from "vitest";
import { kidsOpen, linesOf, shapeTree } from "./shape-fixture.ts";

const companions = () => {
  const b = shapeTree("TreeShapeMulti");
  const multi =
    b.root.kids === "lazy"
      ? undefined
      : b.root.kids.find((k) => k.name === "Multi pool");
  const group = kidsOpen(b, multi).find((k) => k.name === "🐾 Companions");
  return { b, group };
};

test("the companions of a product with a floor are the pool's group 🐾 Companions, each its own × row", () => {
  const { b, group } = companions();
  expect([group?.role, group?.combine, group?.fmt, group?.value]).toEqual([
    "system",
    "product",
    "x",
    expect.closeTo(1.95 * 1.01, 9),
  ]);
  const rows = kidsOpen(b, group);
  expect(rows.map((k) => [k.value, k.fmt, k.role])).toEqual([
    [1.3, "x", "piece"],
    [1.5, "x", "piece"],
    [1.01, "x", "piece"],
  ]);
  // each companion's row opens in its parts, the companion by its role, the code's constants as they are; no check is
  // a row (a companion owned is said in the ⓘ), and the ⓘ names each part by its row's name
  expect(rows.map((k) => kidsOpen(b, k).map((x) => x.name))).toEqual([
    ["Cap 1.3", "Base 1", "Bonus"],
    ["Base 1", "× 0.5", "Bonus"],
    ["Minimum 1", "Cap 1.01", "Base 1", "Bonus", "Divided by 2500"],
  ]);
  expect(
    rows.map((k) => kidsOpen(b, k).map((x) => x.leaf === "condition")),
  ).toEqual([
    [false, false, false],
    [false, false, false],
    [false, false, false, false, false],
  ]);
  expect(
    rows.map((k) =>
      kidsOpen(b, k)
        .find((x) => x.name === "Bonus")
        ?.code?.startsWith("Companions("),
    ),
  ).toEqual([true, true, true]);
  // the companion owned is said in the ⓘ of its bonus
  const owned = kidsOpen(b, rows[1]).find((x) => x.name === "Bonus");
  expect([owned?.leaf, owned?.formula]).toEqual([
    "rawBonus",
    { rule: ["If Owned: 1", "yes → 1"] },
  ]);
  expect(rows.map((k) => linesOf(k.formula)[0])).toEqual([
    expect.stringMatching(/^min \( 1\.3 , 1 \+ Bonus \)$/),
    expect.stringMatching(/^1 \+ \( 0\.5 × Bonus \)$/),
    expect.stringMatching(/Bonus ÷ 2500/),
  ]);
});

test("the group's ⓘ holds the floor of the product, max(1, …), and closes with its rows' numbers (FR-008)", () => {
  const { group } = companions();
  const [names, numbers] = linesOf(group?.formula);
  expect(names).toMatch(/^max \( 1 , .+ × .+ \) × .+$/);
  expect(numbers).toBe("1 1.3 1.5 1.01 1.97");
  expect(Array.isArray(group?.formula)).toBe(true);
});
