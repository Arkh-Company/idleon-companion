// The slot the save chooses (spec 010, T213; the leaf types: "Escolha: o que está no slot"; Open Questions 24/11: a list
// is a model child): a list over the slots, its model tied by the recorded place of each read, beside the level's other
// children. The invented game's TreeSlotBonus reads TreeFoodQty[i] for the slot whose food is the gold one, as the
// game's GoldFoodBonuses reads EquipmentQuantity[2][i]; each character keeps it in a slot of its own.
import { expect, test } from "vitest";
import { mosaicOf } from "../fixtures/fake-mosaic.ts";
import { parseBlueprint } from "./blueprint.ts";
import type { BlueprintNode } from "./blueprint.ts";
import { inventedRecorder } from "./lock-fixture.ts";
import { lockMessage } from "./lock.ts";
import { lockNumber } from "./real-trees-check.ts";
import type { RecordFn } from "./real-trees-check.ts";

const leaf = (key: string, read: string): BlueprintNode => ({
  key,
  name: key,
  ref: { read },
  leaf: "quantity",
});

/** The slot bonus locked over one run per food list (a character each), its other child beside the list's model. */
function lockSlots(foods: readonly number[][], model = true) {
  const out = parseBlueprint(
    {
      id: "invented-slot",
      root: { name: "Invented", ref: { call: "TreeSlotRoot", args: [] } },
      pools: [
        {
          kind: "additive",
          groups: [
            {
              system: "cards",
              sources: [
                leaf("capped", "TreeCapped"),
                {
                  key: "slot",
                  name: "Slot",
                  ref: { call: "TreeSlotBonus", args: [] },
                  ...(model && {
                    each: { list: "TreeFoodQty[*]", as: "slot" },
                  }),
                  children: [
                    leaf("base", "TreeBase"),
                    leaf(
                      "qty",
                      model ? "TreeFoodQty[{slot}]" : "TreeFoodQty[1]",
                    ),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    { fileId: "invented-slot", systemIds: new Set(["cards"]) },
  );
  if (!out.ok) throw new Error(out.reason);
  let i = 0;
  const record: RecordFn = (_mosaic, _scene, roots) =>
    inventedRecorder().record(
      mosaicOf({ TreeFood: foods[i++], TreeFoodQty: [3, 5, 7] }),
      roots,
      { recompute: [], builders: [] },
    );
  const runs = foods.map(() => ({ character: 0, characterClass: 3 }));
  return lockNumber(
    record,
    inventedRecorder().ops,
    out.blueprint,
    mosaicOf(),
    runs,
  ).lock.errors.map(lockMessage);
}

test("a list over the slots: each character's slot by the place of its read, the level's other child beside it (T213)", () => {
  expect(
    lockSlots([
      [0, 1, 0],
      [0, 0, 1],
    ]),
  ).toEqual([]);
});

test("one slot written out passes only the character whose slot it is (T213)", () => {
  expect(
    lockSlots(
      [
        [0, 1, 0],
        [0, 0, 1],
      ],
      false,
    ),
  ).toContain(
    "parte não declarada: invented-slot/0/cards/slot: TreeFoodQty[2]",
  );
});
