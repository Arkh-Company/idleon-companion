// The calls the 007 catalog names and the app did not (spec 009, T029, decision of 18/11: the bench is the reference of
// the names): every call the catalog proves from the game's own tables (at 0e47e87b, the same game as RULES_GAME_SHA)
// that no earlier rule of the bench's nameOf names gets the catalog's name, as a static name with the 007 proof by
// reference, in every tree. The Drop Rate's examples; game text may be in a name (Vinicius, 14/11).
import { expect, test } from "vitest";
import { nameOf } from "./names.ts";
import { isNameText } from "./name-text.ts";
import { STATIC_NAMES } from "./names-table.ts";

const CALLS: readonly (readonly [code: string, name: string])[] = [
  ['Holes("B_UPG", 46, 0)', "Gloomie Lootie"],
  ['Holes("B_UPG", 82, 20)', "Sanctum of LOOT"],
  ['Ninja("PristineBon", 17, 0)', "Liqorice Rolle"],
  ['FarmingStuffs("LankRankUpgBonus", 9, 0)', "Seed of Loot"],
  ['FarmingStuffs("CropSCbonus", 7, 0)', "Science Highlighter"],
  [
    'Summoning("VotingBonusz", 27, 0)',
    "Increases Drop Rate for all your characters by",
  ],
  [
    'Summoning2("MeritocBonusz", 22, 0)',
    "All of your Starsigns give x higher bonuses than normal",
  ],
];

test.each(CALLS)("%s is named %s, with the 007 proof", (code, name) => {
  expect(nameOf(code)).toBe(name);
  expect(isNameText(name)).toBe(true);
  expect(STATIC_NAMES.get(code)?.proof).toMatch(
    /; bench 007 catalog, proven at 0e47e87b(?:,|$)/,
  );
});

test("an earlier rule of the bench's nameOf still names its calls: a talent by its talent's name", () => {
  // a talent's name comes from the talents' table (a recipe of the 008), never from the catalog
  expect(STATIC_NAMES.get("GetTalentNumber(1, 279)")?.proof ?? "").not.toMatch(
    /bench 007 catalog/,
  );
  expect(STATIC_NAMES.get("Shrine(8)")?.proof ?? "").not.toMatch(
    /bench 007 catalog/,
  );
});
