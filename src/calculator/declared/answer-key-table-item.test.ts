// A value of the game's table read by a key the save gives (spec 010, T179; the LUK's equipment): each turn of the
// gear's loop adds the base of the item the save puts in the slot, `ItemDefinitionsGET[<EquipmentOrder[r][o]>].LUK`.
// The term of the table's read takes, as its item, the save's path that gave the key, read in its own turn: the slot,
// never the first slot with that item. The invented game (fake-game.js, TreeGearTable) puts itemA in two slots.
import { expect, test } from "vitest";
import { recorded } from "./lock-fixture.ts";

export const GEAR = {
  TreeGearOrder: [["itemA", "itemB"], ["itemA"]],
  TreeGearMap: [[{ $m: { v: 3 } }, { $m: {} }], [{ $m: { v: 5 } }]],
};

test("the base of each slot's item comes from the game's table, with the slot that gave its key as its item", () => {
  const { key } = recorded("TreeGearTable", GEAR);
  expect(key.final).toBe(37);
  expect(key.pools.map((p) => p.kind)).toEqual(["additive"]);
  expect(key.pools[0]?.terms.map((t) => [t.ref, t.item ?? null])).toEqual([
    ["TreeLevel", null],
    ["ItemDefinitionsGET.itemA.v", "TreeGearOrder[0][0]"],
    ["TreeGearMap[0][0].v", null],
    ["ItemDefinitionsGET.itemB.v", "TreeGearOrder[0][1]"],
    ["ItemDefinitionsGET.itemA.v", "TreeGearOrder[1][0]"],
    ["TreeGearMap[1][0].v", null],
  ]);
});
