// The calls the 007 catalog names from the game's own tables (proven at 0e47e87b): the Arcade shop, the Lab's bonuses
// and jewels, talents, buffs, the Flurbo shop, a pet and a distance, each a static name of the names table (FR-012a).
import { expect, test } from "vitest";
import { nameOf } from "./names.ts";
import { isNameText } from "./name-text.ts";
import { STATIC_NAMES } from "./names-table.ts";
import { row } from "./rows.ts";

const CALLS: readonly (readonly [code: string, name: string])[] = [
  ["ArcadeBonus(54)", "Arcade: Prisma Bonuses"],
  ["ArcadeBonus(51)", "Arcade: Emperor Bonuses"],
  ["MainframeBonus(8)", "Spelunker Obol"],
  ["MainframeBonus(119)", "Pure Opal Navette"],
  ["MainframeBonus(116)", "Black Diamond Rhinestone"],
  ["TalentCalc(620)", "Will Of The Eldest"],
  ["ArcadeBonus(20)", "Arcade: Base AGI"],
  ["ArcadeBonus(21)", "Arcade: Base WIS"],
  ["MainframeBonus(17)", "Depot Studies PhD"],
  ["MainframeBonus(120)", "Pure Opal Rhombol"],
  ["MainframeBonus(112)", "Emerald Navette"],
  ["GetBuffBonuses(40, 2)", "Maestro Transfusion 2"],
  ["TalentCalc(31)", "Skillage Damage"],
  ["TalentCalc(110)", "Apocalypse Zow"],
  ["TalentCalc(125)", "Precision Power"],
  ["TalentCalc(485)", "Virile Vials"],
  ["TalentCalc(305)", "Looty Mc Shooty"],
  ["TalentCalc(470)", "Paperwork, Great"],
  ["GetBuffBonuses(273, 1)", "Strafe"],
  ["TalentCalc(656)", "Dreamer Damage"],
  ["ArcadeBonus(27)", "Arcade: Drop Rate"],
  ["ArcadeBonus(6)", "Arcade: AFK Gains Rate"],
  ["FlurboShop(7)", "Flurbo shop bonus 7"],
  ["TalentCalc(650)", "Rando Event Looty"],
  ["TalentCalc(57)", "Species Epoch"],
  ["ArcadeBonus(24)", "Arcade: Worship Souls"],
  ["MainframeBonus(15)", "Slab Sovereignty"],
  ["MainframeBonus(118)", "Pure Opal Rhinestone"],
  ["ArcadeBonus(58)", "Arcade: Palette Luck"],
  ["ArcadeBonus(64)", "Arcade: Megacrop Chance"],
  ["GetBuffBonuses(288, 2)", "Extendo Rangeo"],
  ["GetBuffBonuses(124, 1)", "Balanced Spirit"],
  ["ArcadeBonus(2)", "Arcade: Total Accuracy"],
  ["FlurboShop(5)", "Flurbo shop bonus 5"],
  ["GetBuffBonuses(94, 1)", "Firmly Grasp It"],
  ["ArcadeBonus(19)", "Arcade: Base STR"],
  ["ArcadeBonus(22)", "Arcade: Base LUK"],
  ["ArcadeBonus(61)", "Arcade: Kruk Bubble LVs"],
  ["ArcadeBonus(39)", "Arcade: Gold Ball Gain"],
  ["ArcadeBonus(25)", "Arcade: Refinery Speed"],
  ["MainframeBonus(2)", "Gilded Cyclical Tubing"],
  ['Breeding("2ndMulti", "0", 3, 15)', "Hedgehog (pet multi)"],
  ["ArcadeBonus(47)", "Arcade: Windwalker Dust"],
  ["MainframeBonus(122)", "North Winds Jewel"],
  ["ArcadeBonus(13)", "Arcade: Shiny Chance"],
  ["ArcadeBonus(18)", "Arcade: Skill EXP gain"],
  ["FlurboShop(2)", "Flurbo shop bonus 2"],
  ["GetBuffBonuses(40, 1)", "Maestro Transfusion 1"],
  ["DistanceEqn(1335, 294, 470, 294)", "Distance"],
  ["ArcadeBonus(32)", "Arcade: Artifact Find 32"],
  ["ArcadeBonus(66)", "Arcade: Artifact Find 66"],
  ["MainframeBonus(14)", "Artifact Attraction"],
  ["ArcadeBonus(33)", "Arcade: Sailing Loot"],
  ["ArcadeBonus(59)", "Arcade: Meritocracy Bonus"],
];

test.each(CALLS)("%s is named %s, with its proof", (code, name) => {
  expect(nameOf(code)).toBe(name);
  expect(isNameText(name)).toBe(true);
  expect(STATIC_NAMES.get(code)?.proof).toMatch(
    /; bench 007 catalog, proven at 0e47e87b(?:,|$)/,
  );
  expect(row({ pieceKey: "k", value: 1, code }).flags).toEqual({});
});

test("a call like them off the list keeps no name", () => {
  expect(nameOf("ArcadeBonus(999)")).toBeNull();
  expect(
    row({ pieceKey: "k", value: 1, code: "ArcadeBonus(999)" }).flags,
  ).toEqual({ unnamed: true });
});
