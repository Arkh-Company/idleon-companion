// The golden food of the invented game (fake-game.js GoldFoodBonuses), shared by its tests: the items' texts, in the
// bench's canonical form (table-names.ts), and the state of a golden food. No text of the game is in this file.
import { mosaicOf } from "../fixtures/fake-mosaic.ts";

export const TABLES = new Map<string, unknown>([
  ["ItemDefinitionsGET.itemA", { displayName: "Invented|Charm" }],
  ["ItemDefinitionsGET.itemB", { displayName: "OTHER_DISH" }],
  // the family bonus of class 33, key 66 of FamBonusQTYs, in the game's form (tree/state-names.ts)
  [
    "CustomLists.ClassFamilyBonuses",
    Array.from({ length: 34 }, (_, c) =>
      c === 33 ? ["{千@INVENTED_FAMILY"] : [],
    ),
  ],
]);
/** The state of a golden food: the worn food's quantity, the emporium's level and the family bonus of key 66. */
export const golden = (
  quantity: number,
  level: number,
  family: number,
  cache: number,
) =>
  mosaicOf({
    GfoodSet: [10, 20],
    GfoodStart: 9,
    EquipmentOrder: [[], [], ["Blank", "itemA"]],
    EquipmentQuantity: [[], [], [0, quantity]],
    Ninja: Array.from({ length: 105 }, (_, i) => (i === 104 ? [level] : [])),
    DNSM: {
      $m: {
        FamBonusQTYs: Array.from({ length: 67 }, (_, i) =>
          i === 66 ? family : 0,
        ),
        GfoodMap: { $m: { Amount: 7 } },
        GfoodBonus: 0,
        GameCache: { $m: { v: cache } },
      },
    },
  });
