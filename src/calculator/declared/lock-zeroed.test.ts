// A source zeroed by an early return shows its children (spec 010, T183; FR-018 of the 009: "every value a system
// influences MUST show that system as a child, even when the contribution is 0"). The invented game (fake-game.js,
// TreeGateRoot) gives TreeLevel + TreeGateBonus(), the bonus 0 because its gate TreeOwned is 0, before its count.
import { expect, test } from "vitest";
import { parseBlueprint } from "./blueprint.ts";
import type { BlueprintNode } from "./blueprint.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint } from "./lock.ts";

const ID = "invented-zeroed";

function lockWith(gate: Partial<BlueprintNode>) {
  const out = parseBlueprint(
    {
      id: ID,
      root: {
        name: "Invented",
        ref: { call: "TreeGateRoot", args: [0, 0, 0] },
      },
      pools: [
        {
          kind: "additive",
          groups: [
            {
              system: "cards",
              sources: [
                {
                  key: "level",
                  name: "Invented Level",
                  ref: { read: "TreeLevel" },
                  leaf: "level",
                },
                {
                  key: "gate",
                  name: "Invented Gate",
                  ref: { call: "TreeGateBonus", args: [] },
                  ...gate,
                },
              ],
            },
          ],
        },
      ],
    },
    { fileId: ID, systemIds: new Set(["cards"]) },
  );
  if (!out.ok) throw new Error(out.reason);
  const { key, ...input } = recorded("TreeGateRoot");
  expect(key.final).toBe(25);
  return lockBlueprint({
    blueprint: out.blueprint,
    key,
    ...input,
    character: 0,
    characterClass: 3,
  });
}

test("a source that returns 0 early closes with the children it read before the return", () => {
  const lock = lockWith({
    children: [
      {
        key: "owned",
        name: "Invented Owned",
        ref: { read: "TreeOwned" },
        leaf: "quantity",
      },
    ],
  });
  expect(lock.errors).toEqual([]);
});

test("the zeroed source asks for what it read: with no child it is a leaf that has one", () => {
  const lock = lockWith({ leaf: "rawBonus" });
  expect(lock.errors).toContainEqual({
    kind: "leafHasChildren",
    where: "invented-zeroed/0/cards/gate",
    got: "TreeOwned",
  });
});
