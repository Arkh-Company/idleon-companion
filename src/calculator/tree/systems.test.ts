// The system of a source (spec 009, FR-003, FR-004): the block it calls, or the block that writes the cache it reads,
// gives its system by a rule with proof; an unknown block gives none (the caller files it under "🔹 Other"). The V1
// order is the bench's (build-v1mold.cjs V1). Invented blocks and paths, apart from the game's own block names the
// rules read.
import { expect, test } from "vitest";
import { isNameText } from "./names.ts";
import { SYSTEM_TAGS } from "./tags.ts";
import {
  EXTRA_SYSTEMS,
  isHelper,
  SYSTEM_ORDER,
  SYSTEM_RULES,
  systemLabel,
  systemOf,
  V1_SYSTEMS,
} from "./systems.ts";

test.each<[string, string | null, string | undefined, string | null]>([
  ["a card's call", "CardBonusREAL(10, 0)", undefined, "🃏 Cards"],
  ["a talent's call", "GetTalentNumber(1, 207)", undefined, "🎯 Talents"],
  [
    "a block known by its mode",
    'Summoning("VotingBonusz", 27)',
    undefined,
    "🗳️ Voting",
  ],
  [
    "a cache read with an Alchemy writer",
    "DNSM.InventedCache",
    'CauldronStats("InventedMode", 0)',
    "⚗️ Alchemy",
  ],
  [
    "a read the bench files by its path",
    "DNSM.AlchBubbles.InventedBubble",
    undefined,
    "⚗️ Alchemy",
  ],
  [
    "an Equinox upgrade's level, which the V1 files under Dreams",
    "Dream[10]",
    undefined,
    "💭 Dreams",
  ],
  ["an unknown block", 'InventedBlock("Mode", 0)', undefined, null],
  [
    "a known block in a mode no rule names",
    'Summoning("InventedMode", 0)',
    undefined,
    null,
  ],
  ["a read with no writer", "DNSM.InventedCache", undefined, null],
  [
    "a read whose writer is unknown",
    "DNSM.InventedCache",
    'InventedBlock("Mode")',
    null,
  ],
  ["no code", null, undefined, null],
])("%s", (_name, code, writer, label) => {
  const s = systemOf(code, writer);
  expect(s && systemLabel(s)).toBe(label);
});

test("the order is the V1's, Other last", () => {
  expect(SYSTEM_ORDER).toEqual([
    "LUK / Stats",
    "Talents",
    "Cards",
    "Star Signs",
    "Achievements",
    "Companions",
    "Friends",
    "Stamps",
    "Alchemy",
    "Sigils",
    "Prayers",
    "Shrines",
    "Guild",
    "Arcade",
    "Voting",
    "Post Office",
    "Shiny Pets",
    "Tome",
    "Researching",
    "Chips",
    "Dreams",
    "Cloud Bonus",
    "Owl",
    "Grimoire",
    "Vault",
    "Farming",
    "Holes",
    "Emperor",
    "Legend Talents",
    "Spelunk Shop",
    "Sushi",
    "Minehead",
    "Menagerie",
    "Arcane Map",
    "Glimbo",
    "Equipment",
    "Obols",
    "Gallery",
    "Hatrack",
    "Cape Vine",
    "Golden Food",
    "Set Bonuses",
    "Bundles",
    "Pristine Charms",
    "Sneaking Mastery",
    "Summoning",
    "Royal Guardian",
    "Other",
  ]);
});

test("every system's label is a name the host takes, with its emoji first", () => {
  expect(V1_SYSTEMS.map((s) => s.name)).toEqual(SYSTEM_ORDER);
  for (const s of V1_SYSTEMS) {
    const label = systemLabel(s);
    expect([label, isNameText(label)]).toEqual([`${s.emoji} ${s.name}`, true]);
  }
  expect(V1_SYSTEMS.at(-1)).toEqual({ name: "Other", emoji: "🔹" });
});

test("every system a rule gives is in the V1 list or among the systems beyond it", () => {
  const known = [...SYSTEM_ORDER, ...EXTRA_SYSTEMS.map((s) => s.name)];
  for (const r of SYSTEM_RULES)
    expect([String(r.test), known.includes(r.system)]).toEqual([
      String(r.test),
      true,
    ]);
});

// T028: the blocks and reads of the probe's "Other" list that name a known system (the game's own block and path
// names, invented arguments)
test.each<[string, string, string]>([
  ["a research grid cell", "Research[7][2]", "🔬 Researching"],
  [
    "the stamps' running total",
    "DummyNumbersStatManager.Stamp_TOTAL_bonus_of_type_X",
    "📜 Stamps",
  ],
  ["a menagerie cell", "Menagerie[3][1]", "🪼 Menagerie"],
  ["an owl cell", "CustomLists.Owlz[2][0]", "🦉 Owl"],
  ["a companion's +", "CompLV2(132)", "🐾 Companions"],
  ["any farming mode", 'FarmingStuffs("StickerDMGmulti", 0, 0)', "🌾 Farming"],
  ["a meal", 'MealBonus("zInvented")', "🍲 Meals"],
  ["the meals' cache", "DNSM.MealBonusesS.Invented", "🍲 Meals"],
  ["a bribe", 'GetBribeBonus("36")', "💰 Bribes"],
  [
    "the jelly operator",
    'JellyOperation("RoG_BonusQTY", 10, 0)',
    "🫧 Jelly Operator",
  ],
  [
    "the atom collider",
    'AtomCollider("AtomBonuses", 12, 0)',
    "⚛️ Atom Collider",
  ],
  ["a compass bonus", 'Windwalker("CompassBonus", 76, 0)', "🧭 Compass"],
  ["gaming", 'GamingStatType("PaletteBonus", 23, 0)', "🎮 Gaming"],
  ["a spelunking cell", "Spelunk[4][0]", "🔦 Spelunking"],
  ["trapping", 'TrappingStuffs("TrapMGbonus", 2)', "🪤 Trapping"],
  ["sailing", 'Sailing("SlabboBonus", 6, 0)', "⛵ Sailing"],
  ["the lab's mainframe", "MainframeBonus(122)", "🧪 Lab"],
  // decision of 19/11: Chips is 🧩, Gem Shop takes 💎
  ["a chip", 'chipBonuses("acc")', "🧩 Chips"],
  ["a captain", "CaptBonusCalc(3, 5)", "⛵ Sailing"],
  ["a sailing cell", "Sailing[3][1]", "⛵ Sailing"],
  ["an atom's level", "Atoms[4]", "⚛️ Atom Collider"],
])("%s", (_name, code, label) => {
  const s = systemOf(code);
  expect(s && systemLabel(s)).toBe(label);
});

// Family 15 of the audit of 19/11: the systems Vinicius named (decision 4), and the existing systems whose block had
// no rule, each by the block a source calls (the game's own block and path names, invented arguments)
test.each<[string, string, string]>([
  ["a family bonus", "DNSM.FamBonusQTYs[7]", "👪 Family Bonuses"],
  [
    "Royal Guardian keeps its own family bonus",
    "DNSM.FamBonusQTYs[32]",
    "🏰 Royal Guardian",
  ],
  ["any Bubba mode", 'Bubbastuff("TotUpgBonus", 0, 0)', "🥩 Bubba"],
  ["a Bubba cell", "Bubba[0][1]", "🥩 Bubba"],
  ["the Clamworks", 'Thingies("ClamWorkBonus", 8, 0)', "🐚 Clam"],
  ["a Clam cost", 'Thingies("Clam_Cost", 1, 1)', "🐚 Clam"],
  ["a Rift reward", 'RiftStuff("RiftSkillBonus,19", 2)', "🌀 Rift"],
  ["a Rift star sign unlock", 'RiftStuff("enabledStarSigns", 0)', "🌀 Rift"],
  ["Killroy's shop", 'RandomEvent("KillroyBonuses", 3, 0)', "💀 Killroy"],
  // decision of 19/11: Divinity is 🕊️ (Prayers keeps 🙏)
  ["a god's minor bonus", 'Divinity("Bonus_Minor", 3, 0)', "🕊️ Divinity"],
  ["a god's blessing", 'Divinity("BlesssBonus", 2, 0)', "🕊️ Divinity"],
  ["a gem shop purchase", "GemItemsPurchased[139]", "💎 Gem Shop"],
  // review r1: each branch of the rules above
  ["Bubba's working value", "DNSM.Bubba_SM", "🥩 Bubba"],
  [
    "the next Glimbo trade's cost",
    'Minehead("Glimbo_Cost", 0, 0)',
    "🎲 Glimbo",
  ],
  [
    "a bundle the block checks by bon",
    'Thingies("Have_bon_x", 0, 0)',
    "🎁 Bundles",
  ],
  ["a talent's calc", "TalentCalc(328)", "🎯 Talents"],
  ["the talents' calc cache", "DNSM.CalcTalentMAP[635]", "🎯 Talents"],
  ["the arcade's doubler cache", "DNSM.ArcadBonDNz[14]", "🕹️ Arcade"],
  ["a bundle received", "BundlesReceived.bun_v", "🎁 Bundles"],
  ["a bundle the block checks", 'Thingies("Have_ban_i", 0, 0)', "🎁 Bundles"],
  ["a Holes2 mode", 'Holes2("Fount_MarbleizeCost", 0, 1)', "🕳️ Holes"],
  [
    "a Holes mode no tag names",
    'Holes("MeasurementQTYfound", 11, 99)',
    "🕳️ Holes",
  ],
  ["a Minehead upgrade", 'Minehead("UpgradeQTY", 4, 0)', "⛏️ Minehead"],
  ["a Glimbo trade", 'Minehead("GlimboTotalTrades", 0, 0)', "🎲 Glimbo"],
  ["a Summoning upgrade", 'Summoning("SummUpgBonus", 12, 0)', "🐲 Summoning"],
  ["a lab line", 'Labb("BonusLineWidth", 0, 0)', "🧪 Lab"],
  ["a lab cell", "Lab[1][2]", "🧪 Lab"],
  ["a stat of the character", 'TotalStats("Accuracy")', "🍀 LUK / Stats"],
])("family 15: %s", (_name, code, label) => {
  const s = systemOf(code);
  expect(s && systemLabel(s)).toBe(label);
});

test("a Labb sigil stays a Sigil and a vote stays Voting: the mode rules come before the block's", () => {
  const sigil = systemOf('Labb("SigilBonus", 0, 3)');
  const vote = systemOf('Summoning("VotingBonusz", 27)');
  expect([sigil && systemLabel(sigil), vote && systemLabel(vote)]).toEqual([
    "🔮 Sigils",
    "🗳️ Voting",
  ]);
});

test("a block the game only calls as a curve or a log is a helper, of no system of its own", () => {
  expect(isHelper('ArbitraryCode5Inputs("decay", 10, 100, 101, 0, 0)')).toBe(
    true,
  );
  expect(isHelper("getLOG(0)")).toBe(true);
  expect(isHelper("Log2(0)")).toBe(true);
  expect(isHelper("CardBonusREAL(10, 0)")).toBe(false);
  expect(isHelper("DNSM.Invented")).toBe(false);
  expect(systemOf('ArbitraryCode5Inputs("add", 1, 0, 101, 0, 0)')).toBeNull();
});

test("no two systems share an emoji: Arcade is 🕹️, Gaming 🎮 (Vinicius, 18/11)", () => {
  const all = [...V1_SYSTEMS, ...EXTRA_SYSTEMS];
  expect(new Set(all.map((s) => s.emoji)).size).toBe(all.length);
  const arcade = systemOf("ArcadeBonus(0)");
  expect(arcade && systemLabel(arcade)).toBe("🕹️ Arcade");
});

test("the systems beyond the V1 have a label the host takes, and none is a V1 name", () => {
  for (const s of EXTRA_SYSTEMS) {
    const label = systemLabel(s);
    expect([label, isNameText(label), SYSTEM_ORDER.includes(s.name)]).toEqual([
      `${s.emoji} ${s.name}`,
      true,
      false,
    ]);
  }
});

test("every system a tagged call gives is in the V1 list", () => {
  for (const t of SYSTEM_TAGS)
    expect([String(t.test), SYSTEM_ORDER.includes(t.system)]).toEqual([
      String(t.test),
      true,
    ]);
});

// fix tree-shape-091, round 1 (Vinicius, 19/11: the game has no system Other): the count of the sneaking masteries
// completed, which the max damage multiplies by, is Sneaking Mastery's
test("the count of the sneaking masteries completed is Sneaking Mastery's", () => {
  const s = systemOf("OptionsListAccount[232]");
  expect(s && systemLabel(s)).toBe("🥷 Sneaking Mastery");
  expect(systemOf("OptionsListAccount[233]")).toBeNull();
});
