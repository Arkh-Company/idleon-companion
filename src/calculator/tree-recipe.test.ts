// The calls the recording makes beside a tree's root (spec 009, FR-018): a system the game skips while its value is 0,
// so that value still opens into it (tree/build-up-vote.ts). The recipe's builders (spec 010, T196): a cache a blueprint
// reads is built again by the block that builds it, so its writes are recorded and the tree goes down through them.
import { expect, test } from "vitest";
import { EXTRA_ROOTS, FOLLOW_CALLS, TREE_RECIPE } from "./tree-recipe.ts";

test("the recording calls the Meritocracy bonus multiplier beside the root, with the game's arity", () => {
  expect(EXTRA_ROOTS).toEqual([["Summoning", ["MeritocBonuszMulti", 0, 0]]]);
});

test("after the roots, the recording calls the max level of each Legend Talent the roots called, with the game's arity", () => {
  expect(FOLLOW_CALLS).toEqual([
    ["Thingies", "LegendPTS_bonus", "Thingies", "LegendTalent_MaxLV"],
  ]);
});

test("the count of the sigils at their purple tier is built by the block that counts them (T196)", () => {
  expect(TREE_RECIPE.builders).toContainEqual({
    cache: "SigTotPup",
    run: { block: "Labb", args: ["TotalPurpleSigils", "0", 0, 0] },
  });
});
