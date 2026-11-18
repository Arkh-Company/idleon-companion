// The calls the recording makes beside a tree's root (spec 009, FR-018): a system the game skips while its value is 0,
// so that value still opens into it (tree/build-up-vote.ts).
import { expect, test } from "vitest";
import { EXTRA_ROOTS, legendMaxRoots } from "./tree-recipe.ts";

test("the recording calls the Meritocracy bonus multiplier beside the root, with the game's arity", () => {
  expect(EXTRA_ROOTS).toEqual([["Summoning", ["MeritocBonuszMulti", 0, 0]]]);
});

test("the recording calls the max level of every Legend Talent of the checked table, and none without it", () => {
  expect(legendMaxRoots(2)).toEqual([
    ["Thingies", ["LegendTalent_MaxLV", 0, 0]],
    ["Thingies", ["LegendTalent_MaxLV", 1, 0]],
  ]);
  expect(legendMaxRoots(null)).toEqual([]);
});
