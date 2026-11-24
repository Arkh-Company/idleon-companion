// A source zeroed by an early return shows its children (spec 010, T183; FR-018 of the 009: "every value a system
// influences MUST show that system as a child, even when the contribution is 0"). The invented game (fake-game.js,
// TreeGateRoot) gives TreeLevel + TreeGateBonus(), the bonus 0 because its gate TreeOwned is 0, before its count.
import { expect, test } from "vitest";
import { parseBlueprint } from "./blueprint.ts";
import type { BlueprintNode } from "./blueprint.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint } from "./lock.ts";

const ID = "invented-zeroed";

function lockWith(
  gate: Partial<BlueprintNode>,
  [root, call, final] = ["TreeGateRoot", "TreeGateBonus", 25],
) {
  const out = parseBlueprint(
    {
      id: ID,
      root: {
        name: "Invented",
        ref: { call: root, args: [0, 0, 0] },
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
                  ref: { call, args: [] },
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
  const { key, ...input } = recorded(root);
  expect(key.final).toBe(final);
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

// A call that returns a read with no step of its own (a cache, a table's cell; the LUK's GetSetBonus, Companions): the
// read, the last thing the call did, is its level (fake-game.js, TreeBareRoot).
test("a call that returns a bare read closes by that read, its unused step aside", () => {
  const lock = lockWith(
    {
      children: [
        {
          key: "big",
          name: "Invented Big",
          ref: { read: "TreeBig.k2" },
          leaf: "quantity",
        },
      ],
    },
    ["TreeBareRoot", "TreeBareRead", 32],
  );
  expect(lock.errors).toEqual([]);
});

// A literal the code picks by a test, with no step nor call of its own (the LUK's AchieveStatus: 1 when the
// achievement is done): its reads are its children (fake-game.js, TreeDoneRoot).
test("a call that returns a literal by a test closes with the read it tested", () => {
  const lock = lockWith(
    {
      children: [
        {
          key: "owned",
          name: "Invented Owned",
          ref: { read: "TreeOwned" },
          leaf: "condition",
        },
      ],
    },
    ["TreeDoneRoot", "TreeDone", 26],
  );
  expect(lock.errors).toEqual([]);
});
