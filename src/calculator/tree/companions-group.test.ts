// The companions of a factor in their group (fix tree-shape-091, rule 3; FR-005, FR-017, rule Y; the clamp's answer B):
// max(1, min(1.3, 1 + a) × (1 + 0.5 × b)), a product of companions with a floor, beside max(1, min(1.01, 1 + c ÷
// 2500)), is the group "🐾 Companions" of its Multi pool, each companion its own × row; the floor and the cap of the
// product in the group's ⓘ, each companion's own math in its row's, no constant loose. Over the invented game
// (fake-game.js TreeShapeMulti), invented values.
import { expect, test } from "vitest";
import { CONSTANT, kidsOpen, linesOf, shapeTree } from "./shape-fixture.ts";

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
  // each companion's row opens in its companion, never in a constant (its math in its ⓘ)
  expect(
    rows.map((k) =>
      kidsOpen(b, k)
        .map((x) => x.name)
        .filter((n) => CONSTANT.test(n)),
    ),
  ).toEqual([[], [], []]);
  expect(
    rows.map((k) =>
      kidsOpen(b, k).some((x) => x.code?.startsWith("Companions(")),
    ),
  ).toEqual([true, true, true]);
  const [names] = linesOf(rows[0]?.formula);
  expect(names).toMatch(/^min \( 1\.3 , 1 \+ /);
});

test("the group's ⓘ holds the floor of the product, max(1, …), and closes with its rows' numbers (FR-008)", () => {
  const { group } = companions();
  const [names, numbers] = linesOf(group?.formula);
  expect(names).toMatch(/^max \( 1 , .+ × .+ \) × .+$/);
  expect(numbers).toBe("1 1.3 1.5 1.01 1.97");
  expect(Array.isArray(group?.formula)).toBe(true);
});
