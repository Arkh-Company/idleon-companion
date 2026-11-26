// No source of a named system leaves its system's group (fix tree-shape-091, round 1; rule 1, FR-005, FR-017, the talent
// × count of the Open Questions): a factor 1 + (a + b) ÷ 100 of several sources inside a step the chain reads back is
// its own Multi pool, its sources by system, as the Drop Rate's "1 + (🍣 Sushi + 🫧 Jelly Operator) ÷ 100"; a bonus
// times a count, 1 + min(100, count × bonus) ÷ 100 or (bonus × count ÷ 1) ÷ 100, is the row of the bonus, in the
// bonus's system, its parts by their role. Over the invented game (fake-game.js TreeShapeLoose), invented values.
// Since spec 010, T231 ("a antiga nao me importa"), each part's last read is the working list's read at its own place,
// so the old tree no longer reads the chain back: the root is the product of the three parts.
import { expect, test } from "vitest";
import { kidsOpen, shapeTree } from "./shape-fixture.ts";

// the parts: 30 + 0 + 15 × 25 ÷ 100; 8 × (1 + (4 + 8) ÷ 100) × (1 + min(100, 25 × 4) ÷ 100); 6 × 6
const FIRST = 30 + (15 * 25) / 100;
const SECOND = 8 * 1.12 * 2;
const THIRD = 6 * 6;

test("each part is its working value's read at its own place, a row of the root's product: its factors no longer show (T231)", () => {
  const b = shapeTree("TreeShapeLoose");
  expect(b.root.value).toBeCloseTo(FIRST * SECOND * THIRD, 9);
  const pools = kidsOpen(b, b.root);
  expect(pools.map((p) => [p.name, p.role, p.combine])).toEqual([
    ["Multi pool", "pool", "product"],
  ]);
  const parts = kidsOpen(b, pools[0]);
  expect(parts.map((k) => [k.name, k.code, k.role, k.value])).toEqual(
    [FIRST, SECOND, THIRD].map((v, i): unknown[] => [
      `Damage working value, part ${String(i + 1)}`,
      `DummyNumbersStatManager.DamageDealtLIST[${String(i)}]`,
      "piece",
      expect.closeTo(v, 9),
    ]),
  );
  expect(parts.flatMap((k) => kidsOpen(b, k))).toEqual([]);
});
