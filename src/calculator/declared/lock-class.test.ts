// The lock and another class's source (spec 010, FR-002a): the invented Drop Rate (TreeDeclChain and its blueprint
// decl-chain), whose talent is class 3's.
import { expect, test } from "vitest";
import { parseBlueprint } from "./blueprint.ts";
import type { BlueprintNode } from "./blueprint.ts";
import {
  chainInput,
  inventedBlueprint,
  recorded,
  sourceOf,
} from "./lock-fixture.ts";
import { lockBlueprint } from "./lock.ts";

test("another class's source is not descended: below it is what its own class's character has (FR-002a)", () => {
  // the talent's points as the twin's record: its own class's character sees the wrong child
  const bp = inventedBlueprint("decl-chain");
  const points = sourceOf(bp, 0, "talents", "talent", "talent", "points");
  points.ref = { read: "TreeTwins[1]" };
  points.leaf = "record";
  expect(lockBlueprint(chainInput(bp)).errors.map((e) => e.kind)).toContain(
    "undeclaredPart",
  );
  // another class's character: the source is not in its tree, only its value is checked
  expect(
    lockBlueprint({ ...chainInput(bp), characterClass: 5 }).errors,
  ).toEqual([
    {
      kind: "classMismatch",
      where: "decl-chain/0/talents/talent",
      expected: "3",
      got: 5,
    },
  ]);
});

/** TreeClassFactorRoot locked for a character of class `cls`: the factor TreeWriteCall() is only above class 6. */
function factorLock(cls: number) {
  const leaf = (key: string, read: string): BlueprintNode => ({
    key,
    name: key,
    ref: { read },
    leaf: "level",
  });
  const out = parseBlueprint(
    {
      id: "invented-factor",
      root: {
        name: "Invented",
        ref: { call: "TreeClassFactorRoot", args: [] },
      },
      pools: [
        {
          kind: "additive",
          groups: [
            {
              system: "cards",
              sources: [
                leaf("level", "TreeLevel"),
                {
                  key: "factor",
                  name: "Factor",
                  ref: { call: "TreeClassFactor", args: [] },
                  children: [
                    {
                      key: "item",
                      name: "Item",
                      ref: { call: "TreeTurnItem", args: [1] },
                      children: [leaf("list", "TreeList[1]")],
                    },
                    {
                      key: "times",
                      name: "Times",
                      ref: { call: "TreeWriteCall", args: [] },
                      classes: [7, 8],
                      children: [leaf("base", "TreeBase")],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    { fileId: "invented-factor", systemIds: new Set(["cards"]) },
  );
  if (!out.ok) throw new Error(out.reason);
  const { key, ...input } = recorded("TreeClassFactorRoot", {
    CharacterClass: cls,
  });
  return lockBlueprint({
    blueprint: out.blueprint,
    key,
    ...input,
    character: 0,
    characterClass: cls,
  }).errors;
}

test("a call's child only some classes have: their runs check it, the others' runs pass without it (T211)", () => {
  expect(factorLock(7)).toEqual([]);
  expect(factorLock(3)).toEqual([]);
});
