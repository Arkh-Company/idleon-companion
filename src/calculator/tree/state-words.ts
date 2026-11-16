// The game state paths named in words (FR-012a, the families of 16/11): what the game's code proves of a path no table
// names, or what its use only suggests, whose proof then says "inferred" (Vinicius, 16/11: an inferred name names the
// row). Each rule by the path's shape, so an index the snapshot did not show is named too; the rules that read a game
// table are in tree/state-names.ts.
import { isNameText } from "./name-text.ts";

export interface StateRule {
  test: RegExp;
  proof: string;
  name: (code: string) => string | null;
}
/** A rule by shape: its name from the match, and only a text the host takes (never one that refuses the tree). */
export const rule = (
  test: RegExp,
  proof: string,
  name: (m: RegExpExecArray) => string | null,
): StateRule => ({
  test,
  proof,
  name: (code) => {
    const m = test.exec(code);
    const out = m ? name(m) : null;
    return out && isNameText(out) ? out : null;
  },
});
export const n = (m: RegExpExecArray, k = 1): number => Number(m[k]);
/** The path of a helper actor's working list, as the recorder writes it. */
export const GEN_INFO = (slot: number, event: number): string =>
  `PixelHelperActor[${String(slot)}].behaviors.getBehavior(ActorEvents_${String(event)})._GenINFO`;
export const escape = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const plus1 = (m: RegExpExecArray, k = 1) => String(n(m, k) + 1);

const ACRONYM = /^(?:AGI|STR|WIS|LUK|XP|EXP|AFK|MC|DMG|ACC|SPD|ATK|HP|MP)$/;
/** A bonus's key in words, its percent kept: `%_ALL_STATS` → `% All Stats`, `%_AGI` → `% AGI`. */
const statWords = (key: string): string =>
  key
    .split("_")
    .filter(Boolean)
    .map((w) =>
      w === "%" || ACRONYM.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase(),
    )
    .join(" ");

/** A key in words by its own table of words, else its parts split. */
const inWords = (words: Readonly<Record<string, string>>, key: string) =>
  Object.hasOwn(words, key)
    ? (words[key] ?? key)
    : key
        .replace(/[_]+/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .trim();

const GALLERY: Readonly<Record<string, string>> = {
  GalleryTrophyBonTOT: "Gallery Trophies",
  GalleryNametagBonTOT: "Gallery Nametags",
  PremHatBonTOT: "Hat Rack",
  CapeVineBonTOT: "Cape Vine",
};
const STAR_SIGNS: Readonly<Record<string, string>> = {
  WorshEff: "Worship Efficiency",
  AccPct: "Accuracy %",
  Drop: "Drop Rate",
  TrapEff: "Trapping Efficiency",
  SkillEXP: "Skill EXP",
  Minigame: "Minigame",
};
/** The caches by the block's mode that fills them (the 007 index's writers). */
const CACHES: Readonly<Record<string, string>> = {
  SumUpgMoltoz: "Summoning upgrade bonus multiplier",
  HoleozDN: "Cavern villagers owned",
  HoleozDNm: "Measurements found (cached)",
  skillLvRanksDN2: "Skill LV ranks (cached)",
  BlessyBunDN: "Blessing bonus (cached)",
  GrimoireTotLV: "Total Grimoire upgrade LV",
  ArcaneTotLV: "Total Tesseract upgrade LV",
  CompassTotLV: "Total Compass upgrade LV",
  TKnS_DN: "Royal total stats (cached)",
  SpelunkyChDN: "Spelunk chapter bonus (cached)",
  DreamDN1: "Dream bar fill requirement (cached)",
  RooDN1: "Roo cost and shiny multiplier (cached)",
  RooDN3: "Roo reset bonus 3 (cached)",
  RooDN4: "Roo reset bonus 4 (cached)",
  DropRateLUK: "Drop Rate from LUK",
  DropRateLUK2: "Drop Rate from LUK, second part",
  CaptnBonuz: "Captain Slabbo bonus (cached)",
  GfoodBonus: "Golden food bonus (cached)",
  GfoodBonusMULTI: "Golden food bonus multiplier",
  StatueOnyxOwned: "Onyx Statues owned",
  StatueZenithOwned: "Zenith Statues owned",
  Bubba_Dice: "Bubba dice multiplier",
  Bubba_SM: "Bubba smoked meat multiplier",
  PaletteDNz: "Palette bonus (cached)",
  ProdAGIspd: "Production speed bonus from AGI",
  STw6tr: "Has the World 6 trophy",
};
const SCRATCH: Readonly<Record<string, string>> = {
  TotalStatsDN: "Total Stats",
  SkillStatsDN: "Skill Stats",
  PlayerACCDN: "Accuracy",
  DamageDealtLIST: "Damage",
  DDoTdn: "Damage over time",
  PlayerHPmaxLIST: "Max HP",
  PlayerHPmaxDN: "Max HP",
  PlayerMPmaxLIST: "Max MP",
};
const DEPTHS = ["Weight", "Yellow Depth", "Red Depth", "Purple Depth"];
const CAVERNS = ["Motherlode", "Eternal Hive", "Evertree Cavern", "4th cavern"];

/** The rules in words, the first that matches decides. */
export const WORD_RULES: readonly StateRule[] = [
  rule(
    /^DNSM\.FishTKdl\[([1-3])\]$/,
    "N.js FishingToolkit modes D1, D2, D3, the depths of IDforETCbonus",
    (m) => `Fishing Toolkit ${DEPTHS[n(m)] ?? ""} (weight + line)`,
  ),
  rule(
    /^DNSM\.FishTKdl\[0\]$/,
    "N.js FishingToolkit mode D0, inferred",
    () => "Fishing Toolkit Weight (weight + line)",
  ),
  rule(
    /^DNSM\.(GalleryTrophyBonTOT|GalleryNametagBonTOT|PremHatBonTOT|CapeVineBonTOT)\.(.+)$/,
    "N.js Gallery; N.js TotalStats",
    (m) => `${GALLERY[m[1] ?? ""] ?? ""}: ${statWords(m[2] ?? "")}`,
  ),
  rule(
    /^DNSM\.TotalStatsDM\.UQ([12])val$/,
    "bench pieces.cjs TotalStatsDM; N.js TotalStats",
    (m) => `Bonus value ${String(n(m))} of the item in turn`,
  ),
  rule(
    /^DNSM\.StarSigns\.([A-Za-z]\w*)$/,
    "N.js StarSigns cache, inferred",
    (m) => `Star Signs total: ${inWords(STAR_SIGNS, m[1] ?? "")}`,
  ),
  rule(
    new RegExp(`^DNSM\\.(${Object.keys(CACHES).join("|")})$`),
    "N.js caches by the mode of their block, inferred",
    (m) => CACHES[m[1] ?? ""] ?? null,
  ),
  rule(
    /^Research\[4\]\[(\d+)\]$/,
    "N.js ResearchStuff TotalObsLVs, inferred",
    (m) => `Observation ${plus1(m)} LV`,
  ),
  rule(
    /^Research\[2\]\[(\d+)\]$/,
    "N.js ResearchStuff OccurrencesToBeFound, inferred",
    (m) => `Observation ${plus1(m)} found`,
  ),
  rule(
    /^Research\[7\]\[14\]$/,
    "N.js JellyOperation BloodcellDaily, inferred",
    () => "Jelly Operator daily Bloodcell bonus (%)",
  ),
  rule(
    /^PlayerDATABASE\[(\d+)\]\.CharacterClass$/,
    "bench names-sailing.cjs; N.js LoadPlayerInfo",
    (m) => `Character ${plus1(m)}: Class`,
  ),
  rule(
    /^Spelunk\[4\]\[(1|10)\]$/,
    "N.js Spelunk OverstimBonus; N.js ActorEvents_713",
    // [4][8] keeps the names table's own name
    (m) => (n(m) === 1 ? "Overstim LV" : "Manic Mode on"),
  ),
  rule(
    /^Spelunk\[14\]\[(\d+)\]$/,
    "N.js Thingies SneakSymbolBon, inferred",
    (m) => `Sneaking symbol ${String(n(m))} LV`,
  ),
  rule(
    new RegExp(`^${escape(GEN_INFO(24, 623))}\\[(146|132)\\]$`),
    "N.js Summoning2 battle, inferred",
    (m) =>
      n(m) === 146
        ? "Summoning battle type in progress"
        : "Summoning opponent in progress",
  ),
  rule(
    /^Boats\[(\d+)\]\[(3|5)\]$/,
    "bench names-sailing.cjs; N.js Sailing BoatValue, BoatSpeed",
    (m) => `Boat ${plus1(m)} ${n(m, 2) === 3 ? "loot" : "speed"} upgrade level`,
  ),
  rule(
    /^FarmRank\[0\]\[(\d+)\]$/,
    "N.js _customEvent_TomeQTY; N.js FarmingStuffs",
    (m) => `Farming plot ${plus1(m)} Land Rank`,
  ),
  rule(
    /^Holes\[11\]\[(1|3|5|7)\]$/,
    "N.js _customEvent_TomeQTY Holes sum, the order of the caverns inferred",
    (m) => `${CAVERNS[(n(m) - 1) / 2] ?? ""}: Resource Layers Destroyed`,
  ),
  rule(
    /^Holes\[11\]\[55\]$/,
    "bench pieces.cjs G6b; N.js MonsterKill",
    () => "Ancient Golem sanctums cleared",
  ),
  rule(
    /^Bubba\[4\]\[(\d+)\]$/,
    "N.js Bubbastuff Dice_Multi, inferred",
    (m) => `Bubba die ${plus1(m)} value`,
  ),
  rule(
    /^Bubba\[5\]\[(\d+)\]$/,
    "N.js Bubbastuff SmokeMeat_Multi, inferred",
    (m) => `Smoked meat type ${plus1(m)} (Bubba)`,
  ),
  rule(
    /^PlayerStuff\[1\]$/,
    "N.js LoadAllData TalPresetLISTS, inferred",
    () => "Talent preset in use",
  ),
  rule(
    // only the scratch numbers whose block is known: another keeps the generic name
    new RegExp(
      `^DummyNumbersStatManager\\.(${Object.keys(SCRATCH).join("|")})(?:\\[(\\d+)\\])?$`,
    ),
    "bench build-tree.cjs inputOf, the scratch numbers by their block, inferred",
    (m) =>
      `${SCRATCH[m[1] ?? ""] ?? ""} working value${
        m[2] === undefined ? "" : `, part ${plus1(m, 2)}`
      }`,
  ),
  rule(
    /^Menagerie\[0\]\[(8|11|12|13|14)\]$/,
    "N.js MenagerieStuff ScurgeEXP_Req, ConstBuildBONUSES, inferred",
    (m) =>
      n(m) === 8
        ? "Scurge level"
        : `Construction build bonus ${String(n(m) - 10)} stacks`,
  ),
  rule(
    /^EquipmentMap\[(\d+)\]\[(\d+)\]\.UQ([12])val$/,
    "bench pieces.cjs EquipmentMap; N.js TotalStats",
    (m) =>
      `Worn item (group ${String(n(m))} – slot ${String(n(m, 2))}) bonus value ${String(n(m, 3))}`,
  ),
];
