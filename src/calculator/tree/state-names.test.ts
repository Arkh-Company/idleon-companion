// The game state paths that had no name (FR-012a, the 30 families of 16/11): each family is a rule by the path's shape,
// whose name comes from a game table the boot checked by its hash, or from words when no table names it (those rules'
// proofs say "inferred"). The tables here hold only the cells the examples read, with the installed game's text at
// 0e47e87b; a character is only ever its slot.
import { afterEach, expect, test } from "vitest";
import {
  isNameText,
  nameOf,
  pathName,
  SHAPE_NAMES,
  useGameNames,
} from "./names.ts";
import { GENERIC_NAME, row } from "./rows.ts";
import { useGameTables } from "./table-names.ts";
import { TOME_PATHS } from "./state-names.ts";
import { STATIC_NAMES, TABLE_HASHES } from "./names-table.ts";
import { renameOf } from "./renames.ts";
import { GAME, list } from "./state-fixture.ts";

afterEach(() => {
  useGameTables(new Map());
  useGameNames(new Map());
});

const LAB = "PixelHelperActor[22].behaviors.getBehavior(ActorEvents_548)";
const SUMMONING = "PixelHelperActor[24].behaviors.getBehavior(ActorEvents_623)";
const STAMPS = "PixelHelperActor[8].behaviors.getBehavior(ActorEvents_481)";

/** The examples of regras-propostas.json, by family: the path, its name and whether the rule is only inferred. */
const EXAMPLES: [code: string, name: string, inferred?: 1][] = [
  ["DNSM.FishTKdl[1]", "Fishing Toolkit Yellow Depth (weight + line)"],
  ["DNSM.FishTKdl[2]", "Fishing Toolkit Red Depth (weight + line)"],
  ["DNSM.FishTKdl[0]", "Fishing Toolkit Weight (weight + line)", 1],
  ["DNSM.GalleryNametagBonTOT.%_ALL_STATS", "Gallery Nametags: % All Stats"],
  ["DNSM.PremHatBonTOT.%_ALL_STATS", "Hat Rack: % All Stats"],
  ["DNSM.CapeVineBonTOT.%_DROP_RATE", "Cape Vine: % Drop Rate"],
  ["DNSM.GalleryTrophyBonTOT.%_SKILL_EXP", "Gallery Trophies: % Skill EXP"],
  ["DNSM.TotalStatsDM.UQ1val", "Bonus value 1 of the item in turn"],
  ["DNSM.CalcTalentMAP[656]", "Dreamer Damage (talent calc)"],
  ["DNSM.StarSigns.WorshEff", "Star Signs total: Worship Efficiency", 1],
  ["DNSM.StarSigns.Drop", "Star Signs total: Drop Rate", 1],
  ["DNSM.SumUpgMoltoz", "Summoning upgrade bonus multiplier", 1],
  ["DNSM.HoleozDN", "Cavern villagers owned", 1],
  ["DNSM.StatueOnyxOwned", "Onyx Statues owned", 1],
  ["Research[7][9]", "Successful Jelly Operations"],
  ["Research[7][4]", "Minehead Opponents Defeated"],
  ["Research[11].length", "Rat King Crowns Reclaimed"],
  ["Research[17][0]", "Amoeba Cell Cultivation LV"],
  ["Research[17][38]", "Daily Transfusion LV"],
  ["Research[4][0]", "Observation 1 LV", 1],
  ["Research[2][0]", "Observation 1 found", 1],
  ["Research[7][14]", "Jelly Operator daily Bloodcell bonus (%)", 1],
  ["PlayerDATABASE[0].Lv0[9]", "Character 1: Worship level"],
  ["PlayerDATABASE[3].Lv0[20]", "Character 4: Research level"],
  ["PlayerDATABASE[1].Lv0[15]", "Character 2: Gaming level"],
  ["PlayerDATABASE[0].CharacterClass", "Character 1: Class"],
  ["CustomLists.CompassUpg[39][5]", "Circle Supremacy bonus per level"],
  ["CustomLists.CompassUpg[80][5]", "Abomination Slayer XXI bonus per level"],
  ["CustomLists.CompassUpg[42][5]", "Critter Culture bonus per level"],
  // the shop's own text (the file's example, "Gallery Multiplier", is the screen's text after two buys)
  [
    "OptionsListAccount[467]",
    "Killroy Shop: 5% Chance for +1 Grade for your Gallery in World 7! (times bought)",
  ],
  [
    "OptionsListAccount[468]",
    "Killroy Shop: Permanently boosts the drops of Masterclasses by x (times bought)",
  ],
  ["OptionsListAccount[196]", "Blue Tome Pages added to the Tome"],
  ["OptionsListAccount[197]", "Red Tome Pages added to the Tome"],
  ["OptionsListAccount[238]", "Moissanite gemstone LV"],
  ["OptionsListAccount[369]", "Spirited Valley Emperor Boss Kills"],
  ["OptionsListAccount[594]", "Button Presses"],
  ["Spelunk[49][28]", "Violet black star"],
  ["Spelunk[46].length", "Premium Hats Found"],
  ["Spelunk[6].length", "Total Spelunk Discoveries made"],
  ["Spelunk[4][1]", "Overstim LV"],
  ["Spelunk[4][10]", "Manic Mode on"],
  ["Spelunk[14][0]", "Sneaking symbol 0 LV", 1],
  ["CustomLists.FishToolkitInfo[1][9][1]", "Zeus Gon Fishin Weight", 1],
  ["CustomLists.FishToolkitInfo[1][9][2]", "Zeus Gon Fishin Yellow Depth"],
  ["CustomLists.FishToolkitInfo[0][9][5]", "Valve Circles EXP"],
  [`${LAB}._GenINFO[92][50]`, "Invented Link connected"],
  [`${SUMMONING}._GenINFO[143][9]`, "Total Career Summoning Wins"],
  [`${STAMPS}._GenINFO[106]`, "Stamp Total LV"],
  [`${SUMMONING}._GenINFO[146]`, "Summoning battle type in progress", 1],
  [`${SUMMONING}._GenINFO[132]`, "Summoning opponent in progress", 1],
  ["Dream[12]", "Equinox Symbols LV"],
  ["Dream[10]", "Faux Jewels LV"],
  ["Dream[13]", "Voter Rights LV"],
  [
    "CustomLists.SummonEnemies[10][15]",
    "Summoning win 16 bonus: Winner Bonuses",
  ],
  ["CustomLists.SummonEnemies[10][5]", "Summoning win 6 bonus: Meal Bonuses"],
  ["CustomLists.SummonEnemies[10][2]", "Summoning win 3 bonus: Ballot Bonus"],
  ["Boats[0][3]", "Boat 1 loot upgrade level"],
  ["Boats[0][5]", "Boat 1 speed upgrade level"],
  ["Boats[19][5]", "Boat 20 speed upgrade level"],
  ["FarmRank[0][0]", "Farming plot 1 Land Rank"],
  ["FarmRank[2][20]", "Invented Boost LV"],
  ["KRbest.stache", "Killroy Prime best: Sir Stache"],
  ["KRbest.w4c1", "Killroy Prime best: Clammie"],
  ["Holes[11][3]", "Eternal Hive: Resource Layers Destroyed", 1],
  ["Holes[11][1]", "Motherlode: Resource Layers Destroyed", 1],
  ["Holes[11][55]", "Ancient Golem sanctums cleared"],
  ["Bubba[2][13]", "Super Chart bonus LV"],
  ["Bubba[2][0]", "1st Slice bonus LV"],
  ["Bubba[4][0]", "Bubba die 1 value", 1],
  ["Bubba[5][0]", "Smoked meat type 1 (Bubba)", 1],
  ["PlayerStuff[1]", "Talent preset in use", 1],
  ["DummyNumbersStatManager.TotalStatsDN", "Total Stats working value", 1],
  [
    "DummyNumbersStatManager.PlayerHPmaxLIST[0]",
    "Max HP working value, part 1",
    1,
  ],
  ["CustomLists.MealINFO[6][2]", "Corn meal bonus per level"],
  ["CustomLists.MealINFO[27][2]", "Riceball meal bonus per level"],
  ["Refinery[3][1]", "Redox Salts rank"],
  ["Menagerie[0][8]", "Scurge level", 1],
  ["Menagerie[0][11]", "Construction build bonus 1 stacks", 1],
  ["CustomLists.SummonUPG[78][6]", "Allstar bonus per level"],
  ["CustomLists.SummonUPG[24][6]", "Re-Draw bonus per level"],
  ["CustomLists.Research[58][24]", "Menagerie Boost: x Drop Rate (per level)"],
  [
    "CustomLists.Research[58][16]",
    "Menagerie Boost: Orion's first upgrade is x cheaper (per level)",
  ],
  [
    "CustomLists.Research[25][5]",
    "Glassical Bananical Sticker (bonus per sticker)",
  ],
  [
    "CustomLists.AtomInfo[11][4]",
    "Magnesium - Trap Compounder bonus per level",
  ],
  [
    "CustomLists.AtomInfo[1][4]",
    "Helium - Talent Power Stacker bonus per level",
  ],
  ["EquipmentMap[0][5].UQ1val", "Worn item (group 0 – slot 5) bonus value 1"],
  ["CustomLists.AtomInfo[1][3]", "Helium - Talent Power Stacker max LV", 1],
  ["CustomLists.AtomInfo[1][1]", "Helium - Talent Power Stacker cost base"],
  ["CustomMaps.NjEQ.NjGem5[3]", "Moissanite base bonus", 1],
  ["CustomMaps.NjEQ.NjGem5[5]", "Moissanite bonus growth", 1],
  ["CustomMaps.NjEQ.NjTr18[5]", "Gold Dagger bonus growth", 1],
  ["Sailing[3][41]", "Artifact slot 42 rarity (no artifact yet)"],
  ["Sailing[3][59]", "Artifact slot 60 rarity (no artifact yet)"],
  ["GamingSprout[32][1]", "Highest Immortal Snail LV"],
  ["CustomLists.BubbaUpg[13][3]", "Super Chart bonus per level"],
  ["CustomLists.BubbaUpg[0][1]", "1st Slice cost base"],
  ["QuestComplete.Cactolyte3", "Cactolyte quest 3 completed"],
  ["QuestComplete.Lord_of_the_Hunt2", "Lord of the Hunt quest 2 completed"],
  // spec 009 T030 (decision of 18/11: never a raw path as a name): a Cosmo upgrade's level, by its name in the table
  ["Holes[4][0]", "Monumental Vibes level"],
  ["Holes[5][3]", "Lengthmeister level"],
  ["Holes[6][3]", "Voter Integrity level"],
  // the bench's names of two counters (names-other.cjs; build-v1mold.cjs [G6b])
  ["OptionsListAccount[139]", "Plunderous Kills (account total)"],
  ["OptionsListAccount[189]", "Weekly boss difficulties defeated this week"],
];

/** The shape rule that names `code`. */
const ruleOf = (code: string) =>
  SHAPE_NAMES.find((r) => r.test.test(code) && r.name(code, null) !== null);

test.each(EXAMPLES)("%s is named %s", (code, name, inferred) => {
  useGameTables(GAME);
  expect(nameOf(code)).toBe(name);
  expect(isNameText(name)).toBe(true);
  expect(row({ pieceKey: "k", value: 1, code }).flags).toEqual({});
  // the proof of a rule no game text proves says so
  expect(/\binferred\b/.test(ruleOf(code)?.proof ?? "")).toBe(!!inferred);
});

test.each([
  "CustomLists.CompassUpg[39][4]",
  "Research[7][5]",
  "Research[17].length",
  "PlayerDATABASE[0].Lv1[9]",
  "OptionsListAccount[469]",
  "Spelunk[4][3]",
  "Spelunk[45].length",
  "Boats[0][4]",
  "FarmRank[1][0]",
  "KRbest.SummzTrz0",
  "Holes[11][57]",
  "Bubba[0][1]",
  "PlayerStuff[2]",
  "Menagerie[0][3]",
  "CustomLists.AtomInfo[1][5]",
  "CustomLists.BubbaUpg[13][4]",
  "Sailing[2][41]",
  "QuestComplete.Cactolyte",
  `${SUMMONING}._GenINFO[143][8]`,
])("%s, like a family but off its rule, keeps no name", (code) => {
  useGameTables(GAME);
  expect(nameOf(code)).toBeNull();
  expect(row({ pieceKey: "k", value: 1, code }).flags).toEqual({
    unnamed: true,
  });
});

test("a game cache off its rule keeps the generic name of a working value", () => {
  useGameTables(GAME);
  for (const code of ["DNSM.FishTKdl[4]", "DNSM.StarSigns[69]"])
    expect(row({ pieceKey: "k", value: 1, code })).toMatchObject({
      name: `Working value of the game (${code.slice(5, code.search(/\[/))})`,
      flags: { unnamed: true },
    });
});

test("the Tome's rule names a path by the Tome's own line, read in CustomLists.Tome", () => {
  expect(TOME_PATHS.get("Research[7][9]")).toBe(121);
  useGameTables(
    new Map([["CustomLists.Tome", list({ 121: ["Invented_Tome_Line"] })]]),
  );
  expect(nameOf("Research[7][9]")).toBe("Invented Tome Line");
  // a path the Tome holds on a line the table has not
  expect(nameOf("Research[7][4]")).toBeNull();
  // with no Tome checked at the boot, no path of the Tome has a name but the ones a name already existed for
  useGameTables(new Map());
  for (const path of TOME_PATHS.keys())
    if (renameOf(path) === null && !STATIC_NAMES.has(path))
      expect(nameOf(path)).toBeNull();
});

test("with its table changed, a rule names nothing, and a game cache keeps the generic name", () => {
  useGameTables(new Map());
  expect(nameOf("CustomLists.CompassUpg[39][5]")).toBeNull();
  expect(nameOf("KRbest.stache")).toBeNull();
  expect(
    row({ pieceKey: "k", value: 1, code: "DNSM.CalcTalentMAP[656]" }),
  ).toMatchObject({
    name: "Working value of the game (CalcTalentMAP)",
    flags: { unnamed: true },
  });
  expect(
    row({ pieceKey: "k", value: 1, code: "DNSM.FishTKdl[1]" }).name,
  ).not.toBe(GENERIC_NAME);
});

test("a name that already exists wins over the family's rule", () => {
  useGameTables(GAME);
  // the names table's and the renames' own names, by the same shape
  expect(nameOf("PlayerDATABASE[2].Lv0[0]")).toBe("Character 3: Class level");
  expect(nameOf("Spelunk[4][8]")).toBe("Overstim level");
  expect(nameOf("OptionsListAccount[262]")).toBe("Megafeathers from Orion");
  // an item's bonus value: the rename's name, now that the boot checks the item's table (state-hashes.json)
  expect(nameOf("ItemDefinitionsGET.EquipmentNametag8.UQ2val")).toBe(
    "Summer Shovel Nametag bonus value",
  );
  expect(nameOf("ItemDefinitionsGET.Trophy10.UQ1val")).toBe(
    "Critter Baron bonus value",
  );
  // the recipes of the Lab's links and of the Land Rank upgrades: with no name from the game, none from the rule
  for (const code of [
    `${LAB}._GenINFO[92][8]`,
    `${LAB}._GenINFO[92][20]`,
    "FarmRank[2][9]",
    "Sailing[3][40]",
    "Spelunk[49][3]",
    "PlayerDATABASE[0].Lv0[1]",
  ]) {
    expect(nameOf(code)).toBeNull();
    useGameNames(new Map([[code, "Recipe name"]]));
    expect(nameOf(code)).toBe("Recipe name");
  }
});

const COMPASS_CALL = 'Windwalker("CompassBonus", 39, 0)';
const SUMMONING_CALL = 'Summoning("SummUpgBonus", 78, 0)';
// pathName cuts a name's last bracket: what tells two reads of a family apart is never in it
test.each([
  [["CustomMaps.NjEQ.NjGem5[3]", "CustomMaps.NjEQ.NjGem5[5]"]],
  [[1, 2, 3, 4].map((c) => `CustomLists.AtomInfo[1][${String(c)}]`)],
  [[1, 2, 3].map((c) => `CustomLists.BubbaUpg[0][${String(c)}]`)],
  [
    [1, 2, 3, 4, 5, 6, 7].map(
      (c) => `CustomLists.FishToolkitInfo[1][9][${String(c)}]`,
    ),
  ],
  [[1, 3, 5, 7].map((c) => `Holes[11][${String(c)}]`)],
  [
    [
      "PlayerDATABASE[0].Lv0[9]",
      "PlayerDATABASE[1].Lv0[9]",
      "PlayerDATABASE[11].Lv0[0]",
      "PlayerDATABASE[12].Lv0[0]",
      "PlayerDATABASE[0].CharacterClass",
      "PlayerDATABASE[1].CharacterClass",
    ],
  ],
  [
    [
      "DummyNumbersStatManager.TotalStatsDN",
      "DummyNumbersStatManager.PlayerHPmaxDN",
      "DummyNumbersStatManager.PlayerHPmaxLIST[0]",
      "DummyNumbersStatManager.PlayerHPmaxLIST[1]",
    ],
  ],
  [["DNSM.RooDN3", "DNSM.RooDN4", "DNSM.DropRateLUK", "DNSM.DropRateLUK2"]],
  // a bonus per level and the call that reads it, named by its recipe with the same table text
  [["CustomLists.CompassUpg[39][5]", COMPASS_CALL]],
  [["CustomLists.SummonUPG[78][6]", SUMMONING_CALL]],
  [["CustomLists.MealINFO[6][2]", "CustomLists.MealINFO[27][2]"]],
])("the reads %j each have their own term in the ⓘ", (codes) => {
  useGameTables(GAME);
  useGameNames(
    new Map([
      [COMPASS_CALL, "Circle Supremacy"],
      [SUMMONING_CALL, "Allstar"],
    ]),
  );
  const terms = codes.map(pathName);
  expect(new Set(terms).size).toBe(codes.length);
  // a term is a name, never the path
  expect(terms.filter((t, i) => t === codes[i])).toEqual([]);
});

test("the boot checks by its hash each table the examples read", () => {
  expect([...GAME.keys()].filter((id) => !TABLE_HASHES.has(id))).toEqual([]);
  // every monster, for Killroy's best of any of them
  expect(TABLE_HASHES.has("MonsterDefinitionsGET.jarSand")).toBe(true);
});

test("a character is only its slot, never a name", () => {
  useGameTables(GAME);
  for (const p of [0, 7, 10]) {
    expect(nameOf(`PlayerDATABASE[${String(p)}].Lv0[9]`)).toBe(
      `Character ${String(p + 1)}: Worship level`,
    );
    expect(nameOf(`PlayerDATABASE[${String(p)}].CharacterClass`)).toBe(
      `Character ${String(p + 1)}: Class`,
    );
  }
  // a skill the list holds as a number is no skill's name
  useGameTables(new Map([["CustomLists.SkillNames", list({ 20: "21" }, 21)]]));
  expect(nameOf("PlayerDATABASE[0].Lv0[21]")).toBeNull();
});
