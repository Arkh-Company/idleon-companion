// pieces.cjs rename NAMES (BASELINE-4): the names proven in the before/after table of 10/11, by the row's code, over
// every other name, with the leaf's type. The table texts come from invented tables in the bench's canonical form, as
// the boot keeps them; no text of the game is in this file.
import { afterEach, beforeEach, expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { classify } from "./kinds.ts";
import { nameOf } from "../names/names.ts";
import { STATIC_NAMES } from "../names/names-table.ts";
import { renameKind, renameOf, RENAMES } from "../names/renames.ts";
import { row } from "./rows.ts";
import { useGameTables } from "../names/table-names.ts";

const at = (i: number, v: unknown) => {
  const list: unknown[] = [];
  list[i] = v;
  return list;
};
const TABLES = new Map<string, unknown>([
  ["CustomLists.GodsInfo", at(2, ["INVENTED_GOD"])],
  ["CustomLists.RANDOlist", at(91, at(1, "Invented_Type"))],
  ["CustomLists.SkillNames", at(1, "Invented Skill")],
  ["CustomLists.MealINFO", at(2, ["Invented_Meal"])],
  ["CustomLists.NinjaInfo", at(39, at(2, "Invented_Shop_@_more"))],
  ["CustomLists.SummonUPG", at(1, [0, 1, 2, "Invented_Upgrade"])],
  ["CustomLists.ArcaneUpg", at(3, ["Invented_Arcane"])],
  ["CustomLists.MarketInfo", at(1, ["INVENTED_PLOTS"])],
  ["CustomLists.MarketExoticInfo", at(2, ["Invented_Seed"])],
  ["CustomLists.GamingPalette", at(2, [0, 1, 2, "Invented_Colour"])],
  ["CustomLists.TalentIconNames", at(5, "INVENTED_TALENT")],
  [
    "CustomLists.Spelunky",
    at(6, [0, 1, 2, "Invented_Cove", 4, 5, 6, 7, "Other_Cave"]),
  ],
  ["ItemDefinitionsGET.itemA", { displayName: "Invented|Charm" }],
]);
beforeEach(() => {
  useGameTables(TABLES);
});
afterEach(() => {
  useGameTables(new Map());
});

const PX = "PixelHelperActor[22].behaviors.getBehavior(ActorEvents_548)";
const PX8 = "PixelHelperActor[8].behaviors.getBehavior(ActorEvents_481)";
type Case = [
  code: string,
  name: string | null,
  leaf: string | null,
  cond?: string,
];
const CASES: Case[] = [
  ["GodsInfo[2][14]", "Invented God blessing bonus per level", "fixedValue"],
  // family 2 (audit of 19/11): a text that does not resolve never becomes the list's index; the row has no name
  ["CustomLists.GodsInfo[4][14]", null, "fixedValue"],
  [
    "CustomLists.GodsInfo[2][3]",
    "Invented God minor link bonus top",
    "fixedValue",
  ],
  ["CustomLists.GodsInfo[4][3]", null, "fixedValue"],
  ["CustomLists.GodsInfo[2][7]", "Invented God bonus constant", "fixedValue"],
  ["CustomLists.GodsInfo[4][7]", null, "fixedValue"],
  ["Divinity[25]", "Gods unlocked", "quantity"],
  [
    "CustomLists.RANDOlist[92][1]",
    "Shiny bonus per level (Invented Type)",
    "fixedValue",
  ],
  ["RANDOlist[92][5]", null, "fixedValue"],
  ["Spelunk[44][0]", "Grand Discoveries, cave 1", "quantity"],
  ["Spelunk[47][2]", "Manic depth, cave 3", "record"],
  ["Spelunk[8][5]", "Lore chapter 2 bonus 2 level", "level"],
  ["OptionsListAccount[628]", "Best round defeated (mode 2)", "record"],
  ["DNSM.AtomBonCalc1", "Tower levels above 50 (9 towers)", "level"],
  ["DNSM.CkMst_AcLvT", "Total Cooking level of all characters", "level"],
  ["DNSM.CkMst_RbLvT", "Total ribbon tiers of the meals", "tier"],
  ['Breeding("TotPetsFound", 0)', "Pets found", "quantity"],
  [`${PX}._GenINFO[110]`, "Pets found", "quantity"],
  [
    `${PX8}._GenINFO[114]`,
    "Total MSA waves (best wave of every totem)",
    "record",
  ],
  ["DNSM.skillLvRanks[1]", "Invented Skill mastery rank", "tier"],
  ["DNSM.skillLvRanks[3]", null, "tier"],
  ["CookMaster[1][0]", "Cooking mastery rank", "level"],
  ["CookMaster[1][3]", "Cooking mastery points collected", "quantity"],
  ["CookMaster[2][4]", "Cooking mastery bonus 5 level", "level"],
  [
    "CustomLists.RandoListo2[8][0]",
    "Cooking mastery bonus 1: bonus per level",
    "fixedValue",
  ],
  ["Ribbon[30]", "Ribbon tier of Invented Meal", "tier"],
  ["Ribbon[29]", null, "tier"],
  ["Ribbon[3]", "Ribbon shelf slot 3", "tier"],
  ["OptionsListAccount[99]", "Critter minigame best score", "record"],
  [
    "OptionsListAccount[125]",
    "Gold Relic charge (+1 per second, up to 20 + 20 × rarity)",
    "quantity",
  ],
  [
    "OptionsListAccount[323]",
    "Event Shop item 4 charge (+1 per second, up to 50)",
    "quantity",
  ],
  [
    "OptionsListAccount[354]",
    "Companion 17 charge (+1 per second, up to 100)",
    "quantity",
  ],
  [
    "OptionsListAccount[364]",
    "Compass bonus 43 charge (+1 per second)",
    "quantity",
  ],
  [
    "OptionsListAccount[479]",
    "Legend Talent 17 charge (+1 per second)",
    "quantity",
  ],
  ["OptionsListAccount[262]", "Megafeathers from Orion", "quantity"],
  ["OptionsListAccount[279]", "Megafish from Poppy", "quantity"],
  ["Holes[22][4]", "Measurement 4 amount", "quantity"],
  ["Spelunk[9][2]", "Invented Colour level", "level"],
  ["Spelunk[9][4]", null, "level"],
  [
    "CustomLists.NinjaInfo[38][4]",
    "Ballot bonus value (ballot 1)",
    "fixedValue",
  ],
  ["CustomLists.NinjaInfo[38][2]", "Ballot table value 2", "fixedValue"],
  ['Summoning("EventShopOwned", 1, 0)', "Invented Shop", "condition", "owned"],
  ['Summoning2("EventShopOwned", 3, 0)', null, "condition", "owned"],
  ["Summon[0][1]", "Invented Upgrade level", "level"],
  ["Summon[0][5]", null, "level"],
  [
    "CustomLists.NinjaInfo[41][7]",
    "Meritocracy bonus value (bonus 2)",
    "fixedValue",
  ],
  ["CustomLists.NinjaInfo[41][3]", "Meritocracy table value 3", "fixedValue"],
  ["RoyalG[0][2]", "Royal statue 2 level", "level"],
  ["CustomLists.Research[41][2]", "Royal statue 2 base bonus", "fixedValue"],
  [
    "CustomLists.Research[42][2]",
    "Royal statue 2 bonus per level",
    "fixedValue",
  ],
  [`${PX}._GenInfo[84]`, "Tome points", "quantity"],
  // the level of a row of a game list: the name column of the same list (family 2)
  ["Arcane[3]", "Invented Arcane level", "level"],
  ["Arcane[4]", null, "level"],
  // N.js FarmingStuffs BasketUpgQTY: FarmUpg[2 + k] is the level of MarketInfo[k]; ExoticBonusQTY: FarmUpg[20 + i] of
  // MarketExoticInfo[i]
  ["FarmUpg[3]", "Invented Plots level", "level"],
  ["FarmUpg[22]", "Invented Seed level", "level"],
  ["FarmUpg[0]", null, "level"],
  ["Meals[0][2]", "Invented Meal level", "level"],
  ["Meals[0][3]", null, "level"],
  [
    "CustomLists.TalentDescriptions[5][1][2]",
    "Invented Talent curve constant",
    "fixedValue",
  ],
  ["CustomLists.TalentDescriptions[6][1][2]", null, "fixedValue"],
  ["CustomLists.GamingPalette[2][1]", "Invented Colour constant", "fixedValue"],
  ["CustomLists.GamingPalette[4][2]", null, "fixedValue"],
  [
    "CustomLists.SummonEnemies[7][3]",
    "Summoning win bonus of battle 3",
    "fixedValue",
  ],
  ["DNSM.CardBonusSdl[4]", "Bonus per star (card)", "fixedValue"],
  ["ShrineInfo[2][3]", "Shrine level", "level"],
  ["CustomLists.ShrineInfo[2][3]", "Bonus per level (shrine)", "fixedValue"],
  ["CustomLists.ShrineInfo[2][2]", "Base bonus (shrine)", "fixedValue"],
  ["DNSM.cardLvCalco", "Card stars", "level"],
  ["GrimoireUpg[3][5]", "Bonus per level (Grimoire)", "fixedValue"],
  ["CustomLists.ArcaneUpg[3][5]", "Bonus per level (Arcane)", "fixedValue"],
  ["UpgradeVault[3][5]", "Bonus per level (Upgrade Vault)", "fixedValue"],
  ["ArmoryUpg[3][5]", "Bonus per level (Royal Armory)", "fixedValue"],
  ["SpelunkUpg[3][4]", "Bonus per level (Spelunking shop)", "fixedValue"],
  ["ResGridSquares[3][2]", "Bonus per level (Research Grid)", "fixedValue"],
  ["MarketExoticInfo[3][3]", "Max bonus of the exotic seed", "fixedValue"],
  ["LabMainBonus[3][5]", "Lab bonus value", "fixedValue"],
  ["JewelDesc[3][12]", "Jewel bonus value", "fixedValue"],
  ["ChipDesc[3][11]", "Chip bonus value", "fixedValue"],
  [
    "CustomLists.SigilDesc[3][12]",
    "Sigil bonus at its current tier",
    "fixedValue",
  ],
  ["NinjaInfo[36][2]", "Bonus per rank level (Farming)", "fixedValue"],
  ["Research[12][4]", "Glimbo trades, type 4", "quantity"],
  ["Holes[11][63]", "Ancient Golem kills (Caverns)", "quantity"],
  ["PrayersActive[1]", "Prayer in slot 2", "choice"],
  // family 13 (audit of 19/11): a lore by its cave, the panel the lore screen draws it in; a dream by the title the
  // Equinox screen writes, "Dream #" its task + 1, "Nightmare" its task − 35 from the 36th
  [
    "Spelunk[0][3]",
    "Spelunking lore: Invented Cove found",
    "condition",
    "owned",
  ],
  ["Spelunk[0][4]", null, "condition", "owned"],
  ['Spelunk("DoWeHaveLoreN1", 8, 0)', "Spelunking lore: Other Cave", null],
  ['Spelunk("DoWeHaveLoreN1", 4, 0)', null, null],
  ["WeeklyBoss.d_3", "Equinox: Dream #4", null],
  // the Killroy shop's bonus t by what it raises (the Vinicius's names of 19/11)
  [
    'RandomEvent("KillroyBonuses", 0, 0)',
    "Killroy: Artifact Find Chance",
    null,
  ],
  [
    'RandomEvent("KillroyBonuses", 3, 0)',
    "Killroy: Gallery Grade chance",
    null,
  ],
  ['RandomEvent("KillroyBonuses", 6, 0)', "Killroy: Daily coral gain", null],
  ['RandomEvent("KillroyBonuses", 7, 0)', null, null],
  // a merit shop's purchase by what it raises (the list the Vinicius approved on 19/11); a filler slot has no name
  ["Tasks[2][5][4]", "Merit shop: Winner's Bonuses from Summoning", null],
  ["Tasks[2][0][0]", "Merit shop: Inventory Bag for everyone", null],
  ["Tasks[2][6][5]", "Merit shop: Nautilus recipe", null],
  ["Tasks[2][0][7]", null, null],
  ["WeeklyBoss.d_40", "Equinox: Nightmare 5", null],
  [
    "DNSM.GurtBonuzzDN",
    "Best bonus of this talent among your characters",
    "record",
  ],
  ["DNSM.GurtBonuzzDN2", "Bonus of the character in turn", null],
  ["DNSM.ArcadBonDNz", "Arcade maxed doubler", "condition", "max"],
  ["DNSM.BminorDivQdl[2]", "Minor bonus of the god", "fixedValue"],
  ["DNSM.GalleryDN2", "Trophy slot multiplier (podium level)", "rawBonus"],
  ["DNSM.OwlBonusAll", "Megafeathers total", "fixedValue"],
  [
    "DNSM.ArcMultBon[1]",
    "Arcane multi of the current map (capped)",
    "rawBonus",
  ],
  ["DNSM.PrayNonEq", "No prayer equipped", "condition", "active"],
  ["DNSM.CauldStatDNzz", "Vial Mastery (Rift reward)", null],
  [
    `${PX8}._GenINFO[108]`,
    "Vial Mastery count (kept by the alchemy helper)",
    "quantity",
  ],
  [
    "ItemDefinitionsGET.itemA.UQ1val",
    "Invented Charm bonus value",
    "fixedValue",
  ],
  ["ItemDefinitionsGET.itemB.UQ2val", null, "fixedValue"],
  ["DNSM.StampExalted_double", "Exalted stamp multiplier", null],
  [
    "DummyNumbersStatManager.Stamp_TOTAL_bonus_of_type_X",
    "Stamp total so far",
    null,
  ],
  [
    "DNSM.FrendBonzStatz[0]",
    "Friend bonus for Drop Rate, before Mr Pig",
    "rawBonus",
  ],
  ["DNSM.CalcTalentDN1", "Lowest skill level among the 9 skills", "level"],
];

test.each(CASES)(
  "[rename NAMES] %s is named %s, a %s",
  (code, name, leaf, cond) => {
    expect(renameOf(code)).toBe(name);
    expect(renameKind(code)).toEqual(
      leaf ? { leaf, condition: cond ?? null } : null,
    );
    if (name === null) return;
    // the row of the code takes it, a name of its own (the game's working value too), and the host takes it
    const r = row({ pieceKey: "k", value: 1, code });
    expect([r.name, r.flags]).toEqual([name, {}]);
    expect(checkTree({ id: "x", ...r }, 1)).not.toBeNull();
  },
);

test("every rule of NAMES has a case", () => {
  const missed = RENAMES.filter(
    (r) => !CASES.some(([code]) => r.test.test(code)),
  );
  expect(missed.map((r) => String(r.test))).toEqual([]);
});

test("NAMES names over the names table, as the bench renames the finished tree", () => {
  const key = [...STATIC_NAMES.keys()].find(
    (k) =>
      (renameOf(k) ?? STATIC_NAMES.get(k)?.name) !== STATIC_NAMES.get(k)?.name,
  );
  expect(key).toBeDefined();
  expect(nameOf(key ?? "")).toBe(renameOf(key ?? ""));
});

test("a leaf takes NAMES's type over the other rules", () => {
  expect(classify({ name: "x", code: "DNSM.AtomBonCalc1" })).toEqual({
    leaf: "level",
    condition: null,
    why: null,
  });
  expect(classify({ name: "x", code: "DNSM.ArcadBonDNz" })).toEqual({
    leaf: "condition",
    condition: "max",
    why: null,
  });
  // a rule with no type leaves it to the others
  expect(classify({ name: "x", code: "DNSM.GurtBonuzzDN2" }).leaf).toBe(
    "unknown",
  );
});
