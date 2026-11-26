// A key the save does not have (spec 010, T214; the Drop Rate's UQ2val of an equipment with no upgrade stone): the
// recorder notes the empty read at its place, and the 0 the game uses is a fixed value, by the path the code names.
// The invented game's TreeEmptyKey gives TreeBase × 2 + asNumber(TreeBig.k9), k9 being no key of TreeBig.
import { expect, test } from "vitest";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";

const leaf = (
  key: string,
  read: string,
  kind: NonNullable<BlueprintNode["leaf"]> = "level",
): BlueprintNode => ({ key, name: key, ref: { read }, leaf: kind });

test("the recorder notes the read of a key the save does not have, at its place, with no write's number (T214)", () => {
  const { rec } = recorded("TreeEmptyKeyRoot");
  const call = rec.nodes.find((n) => n.b === "TreeEmptyKey");
  expect(call?.rx).toContainEqual([
    "TreeBig.k9",
    "(undefined)",
    expect.any(Number),
    null,
    expect.any(Number),
  ]);
});

test("the 0 the game uses for the empty key is a fixed value, by the path the code names (T214)", () => {
  const blueprint: Blueprint = {
    id: "invented-empty",
    root: {
      name: "Invented",
      ref: { call: "TreeEmptyKeyRoot", args: [0, 0, 0] },
    },
    pools: [
      {
        kind: "additive",
        groups: [
          {
            system: "cards",
            sources: [
              leaf("capped", "TreeCapped"),
              {
                key: "empty",
                name: "Empty",
                ref: { call: "TreeEmptyKey", args: [] },
                children: [
                  leaf("base", "TreeBase"),
                  leaf("stone", "TreeBig.k9", "fixedValue"),
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const lock = lockBlueprint({
    blueprint,
    ...recorded("TreeEmptyKeyRoot"),
    character: 0,
    characterClass: 3,
  });
  expect(lock.errors.map(lockMessage)).toEqual([]);
});
