// The worn food a golden food's row is named by (A18 of the audit of 19/11). N.js GoldFoodBonuses walks the food slots
// i = 0 … n − 1 and, for each slot whose food is a golden food of its effect, sets the bonus to that slot's product:
// bonus = Amountᵢ × multi × 0.05 × log₁₀(1 + quantityᵢ) × (…), each such slot overwriting the one before. The food that
// counts is the last such slot, so the row takes its name. Invented items and quantities.
import { afterEach, expect, test } from "vitest";
import type { RecValue } from "../recording.ts";
import { emporiumName, equippedName } from "./gold-food.ts";
import { TABLES } from "./gold-food-fixture.ts";
import { useGameTables } from "./table-names.ts";

afterEach(() => {
  useGameTables(new Map());
});

const reads = (pairs: [string, RecValue][]) => new Map(pairs);

test("two slots with a food of the effect: the row is the last slot's food, as the game's bonus is", () => {
  useGameTables(TABLES);
  const r = reads([
    ["EquipmentOrder[2][0]", "itemA"],
    ["EquipmentQuantity[2][0]", 10],
    ["EquipmentOrder[2][3]", "itemB"],
    ["EquipmentQuantity[2][3]", 5],
  ]);
  expect([equippedName(r), emporiumName(r)]).toEqual([
    "Equipped: Other Dish",
    "Beanstalk: Other Dish",
  ]);
});

test("the last slot is by its number, not by the order of the reads", () => {
  useGameTables(TABLES);
  const r = reads([
    ["EquipmentOrder[2][12]", "itemB"],
    ["EquipmentQuantity[2][12]", 5],
    ["EquipmentOrder[2][2]", "itemA"],
    ["EquipmentQuantity[2][2]", 10],
  ]);
  expect(equippedName(r)).toBe("Equipped: Other Dish");
});

test("one slot with a food of the effect: its food", () => {
  useGameTables(TABLES);
  const r = reads([
    ["EquipmentOrder[2][1]", "itemA"],
    ["EquipmentQuantity[2][1]", 10],
  ]);
  expect(equippedName(r)).toBe("Equipped: Invented Charm");
});
