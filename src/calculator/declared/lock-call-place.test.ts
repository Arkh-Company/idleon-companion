// The lock refuses a level whose call ties by no place (spec 010, T177 r3; CODING_STANDARDS, "The answer key ties by the
// recorded place, never by value alone"): the root's answer key stands, and the descent into one of its calls opens a
// step whose variable two calls of one block with the same value could have set. The invented game (fake-game.js,
// TreeTwinRoot) gives TreeLevel + TreeTwinKid(), the kid x * 2 with x one of two TreeThree of 3.
import { expect, test } from "vitest";
import { parseBlueprint } from "./blueprint.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint } from "./lock.ts";

const ID = "invented-twin-number";

test("a level opened below the root with two calls of one value and no place is refused, the root's key standing", () => {
  const out = parseBlueprint(
    {
      id: ID,
      root: {
        name: "Invented",
        ref: { call: "TreeTwinRoot", args: [0, 0, 0] },
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
                  key: "kid",
                  name: "Invented Kid",
                  ref: { call: "TreeTwinKid", args: [] },
                  children: [
                    {
                      key: "three",
                      name: "Invented Three",
                      ref: { call: "TreeThree", args: [0] },
                      leaf: "rawBonus",
                    },
                  ],
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
  const { key, ...input } = recorded("TreeTwinRoot");
  expect(key.final).toBe(31);
  const lock = lockBlueprint({
    blueprint: out.blueprint,
    key,
    ...input,
    character: 0,
    characterClass: 3,
  });
  expect(lock.errors).toContainEqual({
    kind: "rootForm",
    where: "root",
    got: "a chamada TreeThree de valor 3 sai de mais de uma chamada, e o lugar não decide",
  });
});
