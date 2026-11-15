// The type of each leaf (spec 008, FR-013; the 9 types of the model agreed with Vinicius): the port of pieces.cjs
// `classify`, `KIND_PATHS` and `RULES` (with names-sailing.cjs `KINDS` asked first, and the type half of `opus2Leaf`)
// from the bench at BASELINE-4. The slot's role in the game's code decides first (`KIND_PATHS`), then the rules on the
// code, then the same rules on the name. Every rule carries its proof as a reference, never as the game's text (FR-032).
// The bench's last step, the 007 dictionary (`dictKind`), stays out of the app.
import type { CALC_CONDITION_KINDS, CalcTreeNode } from "../tree-contract.ts";
import { renameKind } from "./renames.ts";

type Leaf = NonNullable<CalcTreeNode["leaf"]>;
type Condition = (typeof CALC_CONDITION_KINDS)[number];
export interface KindRule {
  test: RegExp;
  leaf: Leaf;
  condition?: Condition;
  /** Where the rule is proved: the bench's rule or the game's block, never a quoted text of the game. */
  proof: string;
}

const rule = (
  test: RegExp,
  leaf: Leaf,
  proof: string,
  condition?: Condition,
): KindRule =>
  condition ? { test, leaf, condition, proof } : { test, leaf, proof };

/** The type half of pieces.cjs `opus2Leaf` (OPUS2-PATCH B C D): three counts the N.js proves; their names come with US1c. */
export const COUNT_LEAVES: readonly KindRule[] = [
  rule(
    /^WorkbenchStuff\("OverkillQTY", \d+, 0\)$/,
    "quantity",
    "bench pieces.cjs opus2Leaf; N.js WorkbenchStuff OverkillQTY",
  ),
  rule(
    /^Holes\[9\]\[\d+\]$/,
    "quantity",
    "bench pieces.cjs opus2Leaf; N.js ActorEvents_670",
  ),
  rule(
    /ActorEvents_670.*_GenINFO\[129\]$/,
    "quantity",
    "bench pieces.cjs opus2Leaf; N.js CavernStuffz2",
  ),
];

/** pieces.cjs `KIND_PATHS` (deep-7): the type by the slot's path, asked before `RULES`. */
export const KIND_PATHS: readonly KindRule[] = [
  rule(
    /^OptionsListAccount\[232\]$/,
    "quantity",
    "bench pieces.cjs KIND_PATHS INT5-KIND232, rule 155",
  ),
  rule(
    /^Divinity\[(1[2-9]|2[0-3])\]$/,
    "choice",
    "bench pieces.cjs KIND_PATHS deep-7; N.js Divinity",
  ),
  rule(
    /^RoyalG\[3\]\[2\]$/,
    "choice",
    "bench pieces.cjs KIND_PATHS deep-7; N.js RoyalG OutpostROGbon",
  ),
  rule(
    /^Research\[7\]\[9\]$/,
    "choice",
    "bench pieces.cjs KIND_PATHS deep-7; N.js Research",
  ),
  rule(
    /^RoyalG\[2\]\[\d+\]$/,
    "level",
    "bench pieces.cjs KIND_PATHS deep-7; N.js RoyalG",
  ),
  rule(
    /^CauldronInfo\[\d+\]\[\d+\]$/,
    "level",
    "bench pieces.cjs KIND_PATHS deep-7; N.js CauldronStats",
  ),
  rule(
    /^Compass\[0\]\[\d+\]$/,
    "level",
    "bench pieces.cjs KIND_PATHS deep-7; N.js Compass",
  ),
  rule(
    /^Holes\[11\]\[(6[5-9]|70)\]$/,
    "record",
    "bench pieces.cjs KIND_PATHS Names 2; N.js Holes2 GambitPts",
  ),
  rule(
    /^Holes\[11\]\[(26|28|32|33|34|35|36|55|56|63)\]$/,
    "quantity",
    "bench pieces.cjs KIND_PATHS deep-7; N.js Holes2",
  ),
  rule(
    /^Holes\[24\]\[\d+\]$/,
    "level",
    "bench pieces.cjs KIND_PATHS INT2-H24; N.js CavernStuffz2",
  ),
  rule(
    /^AchieveReg\[\d+\]$/,
    "condition",
    "bench pieces.cjs KIND_PATHS deep-7; N.js AchieveStatus",
    "done",
  ),
  rule(
    /^(AchieveStatus|Breeding|CardSetBonuses|CardBonusREAL|MealBonus|Windwalker|GamingStatType|RunCodeOfTypeXforThingY|FarmingStuffs)\(/,
    "rawBonus",
    "bench pieces.cjs KIND_PATHS deep-7, a call returns a ready value",
  ),
  rule(
    /^Thingies\("(LegendPTS_bonus|CoralKidUpgBonus|SuperTalentPTS_LVgiven)"/,
    "rawBonus",
    "bench pieces.cjs KIND_PATHS deep-7; N.js Thingies",
  ),
  rule(
    /^MenagerieStuff\("(PinkJellyBonus|ObolAutoTrashRate)"/,
    "rawBonus",
    "bench pieces.cjs KIND_PATHS deep-7; N.js MenagerieStuff",
  ),
  rule(
    /^Ninja\("EmporiumBonus"/,
    "rawBonus",
    "bench pieces.cjs KIND_PATHS deep-7; N.js Ninja EmporiumBonus",
  ),
  rule(
    /^Spelunk\("DoWeHaveLoreN1"/,
    "rawBonus",
    "bench pieces.cjs KIND_PATHS deep-7; N.js Spelunk",
  ),
];

/** names-sailing.cjs `KINDS` (Names 1), put before the other `RULES` as the bench does (`RULES.unshift`). */
const SAILING: readonly KindRule[] = [
  rule(
    /^Boats\[\d+\]\[[35]\]$/,
    "level",
    "bench names-sailing.cjs KINDS; N.js Sailing BoatValue",
  ),
  rule(
    /^Boats\[\d+\]\[[012]\]$/,
    "choice",
    "bench names-sailing.cjs KINDS; N.js Sailing BoatSpeed",
  ),
  rule(
    /^Captains\[\d+\]\[[12]\]$/,
    "choice",
    "bench names-sailing.cjs KINDS; N.js Sailing CaptBonusCalc",
  ),
  rule(
    /^Captains\[\d+\]\[3\]$/,
    "level",
    "bench names-sailing.cjs KINDS; N.js Sailing CaptBonusCalc",
  ),
  rule(
    /^Captains\[\d+\]\[[56]\]$/,
    "rawBonus",
    "bench names-sailing.cjs KINDS; N.js Sailing CaptBonusCalc",
  ),
  rule(/^NONdummies\[60\]$/, "quantity", "bench names-sailing.cjs KINDS"),
  rule(
    /^CustomLists\.Research\[(?:25|58)\]\[\d+\]$/,
    "fixedValue",
    "bench names-sailing.cjs KINDS, a game table value",
  ),
  rule(
    /^PixelHelperActor\[5\]\.behaviors\.getBehavior\(ActorEvents_232\)\._ItemsAndStorageOWNED\.\w+$/,
    "quantity",
    "bench names-sailing.cjs KINDS; N.js ActorEvents_232",
  ),
  rule(
    /^Research\[9\]\[\d+\]$/,
    "quantity",
    "bench names-sailing.cjs KINDS; N.js FarmingStuffs",
  ),
  rule(
    /^PlayerDATABASE\[\d+\]\.PostOfficeInfo\[\d+\]\[0\]$/,
    "investedPoints",
    "bench names-sailing.cjs KINDS; N.js PostOfficeInfo",
  ),
];

/** pieces.cjs `RULES` (step 7 of the plan of 10/11), asked on the code first, then on the name. */
export const RULES: readonly KindRule[] = [
  ...SAILING,
  rule(
    / found \(sushi tier \d+\)$/,
    "condition",
    "bench pieces.cjs RULES rule 54; N.js SushiStuff UniqueSushi",
    "owned",
  ),
  rule(
    /\(sign \d+\)|^Endless win|^Battle \d+ win|\(artifact \d+\)|\(palette \d+\)|^Family Bonus \d+$|^Obols$|^Equinox Symbols$/,
    "rawBonus",
    "bench pieces.cjs RULES",
  ),
  rule(/^× [\d.]+$/, "fixedValue", "bench pieces.cjs RULES"),
  rule(
    /Super Talent \d|trophy slot|chip slot|^EquipmentOrder|^PrayersActive|^Lab\[\d+\]|^PersonalValuesMap\.StarSign/i,
    "choice",
    "bench pieces.cjs RULES",
  ),
  rule(
    /^(SkillLevels|PostOfficeInfo|CurrenciesOwned\.TalentPoints|PlayerDATABASE\[\d+\]\.SkillLevels)|talent points|points invested/i,
    "investedPoints",
    "bench pieces.cjs RULES",
  ),
  rule(
    /^KRbest|\bbest\b|deepest|endless wins/i,
    "record",
    "bench pieces.cjs RULES",
  ),
  rule(
    /^(Sailing\[3\]|StatueG)|rarity|statue tier/i,
    "tier",
    "bench pieces.cjs RULES",
  ),
  rule(
    /^(AchieveReg|WeeklyBoss|QuestComplete)|\(achievement\)|completed/i,
    "condition",
    "bench pieces.cjs RULES",
    "done",
  ),
  rule(
    /^EquipmentMap\[\d+\]\[\d+\]\.\w+$/,
    "rawBonus",
    "bench pieces.cjs RULES AUDIT-F R2b; N.js LoadPlayerInfo",
  ),
  rule(/^FoodSlotsOwned/, "quantity", "bench pieces.cjs RULES AUDIT-F R2b"),
  rule(
    /vote of the week|Ballot vote/i,
    "condition",
    "bench pieces.cjs RULES",
    "equalsValue",
  ),
  rule(
    /connected|is Prisma|equipped/i,
    "condition",
    "bench pieces.cjs RULES",
    "active",
  ),
  rule(
    /^(BundlesReceived|Ninja\[107\]|BribeStatus|Menagerie\[2\]|Spelunk\[0\])|\bowned$|unlocked|bought|built|received/i,
    "condition",
    "bench pieces.cjs RULES AUDIT-F R2",
    "owned",
  ),
  rule(
    /^(Cards\[0\]|Breeding\[\d+\]|EquipmentQuantity|GemItemsPurchased|Bubba\[1\]|FoodSlotsOwned|Tasks|KillsLeft2Advance)|collected|quantity|kills|shiny exp|log factor/i,
    "quantity",
    "bench pieces.cjs RULES",
  ),
  rule(
    /^(Lv0|PlayerDATABASE\[\d+\]\w*\.Lv0|CauldronInfo|CauldronP2W|ArcadeUpg|StampLevel|Grimoire\[|UpgVault|Arcane\[|Atoms|FarmUpg|FarmRank|GuildTasks|Meals|Compass|RoyalG|Holes\[31\]|StatueLevels|Rift\[0\]|Research\[|Dream\[|CookMaster|Spelunk\[5\])| vial$|level|\blv\b/i,
    "level",
    "bench pieces.cjs RULES",
  ),
  rule(
    /^ItemDefinitionsGET\.[^.]+\.(UQ\dval|STR|AGI|WIS|LUK)$/,
    "rawBonus",
    "bench pieces.cjs RULES",
  ),
  rule(
    /^Cards\[3\]\./,
    "rawBonus",
    "bench pieces.cjs RULES PROPOSAL D9-8; N.js CardSetBonuses",
  ),
  rule(
    /^(DNSM\.TotalStatsDM\.UQ\dval|EquipmentMap\[\d+\]\[\d+\]\.(UQ\dval|Weapon_Power|Defence)|Bonus value \d of the item in turn|Worn item \(group \d+ – slot \d+\)( bonus value \d| Weapon Power| Defence)?)$/,
    "rawBonus",
    "bench pieces.cjs RULES PROPOSAL D9-5 and DEEP10; N.js TotalStats",
  ),
  rule(/^Holes\[11\]/, "level", "bench pieces.cjs RULES"),
  rule(
    /^(CustomLists|CustomMaps|RANDOlist|ChipDesc|SigilDesc|GrimoireUpg|NinjaInfo|ResGridSquares|ShrineInfo|ArcaneUpg|TalentDescriptions|ItemDefinitionsGET|GodsInfo|LabMainBonus|JewelDesc|UpgradeVault|MapDetails|MarketExoticInfo|SpelunkUpg)|^Base Amount$/,
    "fixedValue",
    "bench pieces.cjs RULES, the tables of the game",
  ),
];

export interface Kind {
  leaf: Leaf;
  condition: Condition | null;
  why: string | null;
}
const kind = (
  leaf: Leaf,
  condition: Condition | null = null,
  why: string | null = null,
): Kind => ({
  leaf,
  condition,
  why,
});

/** pieces.cjs `classify`: a leaf's type from its code and its name, and the reason when nothing proves it. */
export function classify(n: {
  name: string;
  code: string | null;
  why?: string | null;
}): Kind {
  const code = n.code ?? "";
  const { name } = n;
  const found = (list: readonly KindRule[], text: string) => {
    const r = text ? list.find((x) => x.test.test(text)) : undefined;
    return r && kind(r.leaf, r.condition ?? null);
  };
  // pieces.cjs rename NAMES types the leaf before classify runs, which keeps a type given
  const named = renameKind(code);
  if (named) return kind(named.leaf, named.condition);
  const count = found(COUNT_LEAVES, code);
  if (count) return count;
  // OPUS3-F2b: a leaf already proved to be the progress of a loop keeps its why.
  if (n.why?.startsWith("progress of ")) return kind("unknown", null, n.why);
  if (
    /^(Fixed (value|multi)|Fixed [+×]|Base stars|Base levels|Curve|Requirement)/.test(
      name,
    )
  )
    return kind("fixedValue");
  if (/^(Owned|Not owned)$/.test(name)) return kind("condition", "owned");
  if (name === "Value from an earlier step")
    return kind(
      "unknown",
      null,
      "a value of a step of the game the recording did not link",
    );
  if (/^Part \d+$/.test(name))
    return kind("unknown", null, "a loop turn with no name");
  // deep-7: the role of the slot in the N.js decides, never a word of the name.
  const byPath =
    found(KIND_PATHS, code) ?? found(RULES, code) ?? found(RULES, name);
  if (byPath) return byPath;
  if (/[0-9][^A-Za-z]*[×÷+−]/.test(name) && !code)
    return kind(
      "unknown",
      null,
      "a sum written with numbers: the level is not told apart from the constants yet",
    );
  // (The bench's "progress of the" reason here never runs: such a leaf already returned above.)
  if (code.startsWith("DNSM."))
    return kind("unknown", null, "a cache that comes ready from the game");
  // A block the game called that returns a value with no parts of its own: a raw bonus.
  if (/^[A-Za-z_0-9]+\(/.test(code)) return kind("rawBonus");
  // FR-012a: the path is in `code`; the reason is a sentence for the player.
  return kind("unknown", null, "nothing proves what this is yet");
}
