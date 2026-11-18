// The game state paths named by a game table (FR-012a, the families of 16/11; research R14): each family a rule by the
// path's shape, whose text is read over the installed game's table the boot checked by its hash (tree/table-names.ts),
// so a table that changed names nothing. The Tome's rule is one rule: the path the game keeps in DNSM.TomeQTY[k] has the
// name of the Tome's line k. A character is only its slot. The rules in words are in tree/state-words.ts. A name that
// already exists wins (tree/names.ts): an item's bonus value keeps the rename's, now that the item's table is checked.
import { tableRows, tableText } from "./table-names.ts";
import { escape, GEN_INFO, n, rule, WORD_RULES } from "./state-words.ts";
import type { StateRule } from "./state-words.ts";

const OLA = (i: number) => `OptionsListAccount[${String(i)}]`;

/** N.js _customEvent_TomeQTY: the paths the Tome keeps as they are, by the Tome's line. */
export const TOME_PATHS: ReadonlyMap<string, number> = new Map([
  ["Research[7][9]", 121],
  ["Research[7][4]", 110],
  ["Research[11].length", 111],
  ["Spelunk[46].length", 109],
  ["Spelunk[6].length", 104],
  [OLA(594), 117],
  [OLA(369), 95],
  [OLA(498), 113],
  [OLA(443), 106],
  [OLA(262), 85],
  [OLA(279), 86],
  [OLA(356), 90],
  [OLA(221), 78],
  [OLA(222), 79],
  [OLA(445), 100],
  [OLA(446), 101],
  ["GamingSprout[32][1]", 63],
  ["GamingSprout[28][1]", 59],
  [`${GEN_INFO(8, 481)}[106]`, 0],
  [`${GEN_INFO(9, 498)}[12]`, 17],
  [`${GEN_INFO(24, 623)}[143][9]`, 71],
]);

/** `text` in `form`, or null with no text. */
const with_ = (text: string | null, form: (t: string) => string) =>
  text === null ? null : form(text);
const FISH = [
  "",
  "Weight",
  "Yellow Depth",
  "Red Depth",
  "Purple Depth",
  "EXP",
  "Speed",
  "POW",
];
const COLUMNS = ["", "cost base", "cost growth", "bonus per level"];
/** AtomInfo's columns: the bonus per level is the fourth. */
const ATOM = ["", "cost base", "cost growth", "", "bonus per level"];

/** The rules by a table, the first that matches decides. */
const TABLE_RULES: readonly StateRule[] = [
  rule(
    new RegExp(`^(?:${[...TOME_PATHS.keys()].map(escape).join("|")})$`),
    "N.js _customEvent_TomeQTY",
    (m) => tableText("tome", TOME_PATHS.get(m[0]) ?? -1),
  ),
  rule(
    /^DNSM\.CalcTalentMAP\[(\d+)\]$/,
    "bench pieces.cjs CalcTalentMAP",
    (m) => with_(tableText("talent", n(m)), (t) => `${t} (talent calc)`),
  ),
  rule(/^Research\[17\]\[(\d+)\]$/, "N.js JellyOperation UpgradeQTY", (m) =>
    with_(tableText("jelly", n(m)), (t) => `${t} LV`),
  ),
  rule(
    /^PlayerDATABASE\[(\d+)\]\.Lv0\[(\d+)\]$/,
    "bench names-sailing.cjs Lv0; N.js _customEvent_TomeQTY",
    (m) => {
      const slot = `Character ${String(n(m) + 1)}:`;
      if (n(m, 2) === 0) return `${slot} Class level`;
      const skill = tableText("skill", n(m, 2) - 1);
      // a skill the list holds as a number is no skill's name
      return skill === null || /^\d+$/.test(skill)
        ? null
        : `${slot} ${skill} level`;
    },
  ),
  rule(
    /^CustomLists\.CompassUpg\[(\d+)\]\[5\]$/,
    "N.js Windwalker CompassBonus",
    (m) => with_(tableText("compass", n(m)), (t) => `${t} bonus per level`),
  ),
  rule(
    /^OptionsListAccount\[(467|468)\]$/,
    "N.js ActorEvents_481 Click2; N.js RandomEvent KillroyBonuses",
    (m) =>
      with_(
        tableText("killroyShop", n(m) - 452),
        (t) => `Killroy Shop: ${t} (times bought)`,
      ),
  ),
  rule(
    /^OptionsListAccount\[(196|197)\]$/,
    "N.js _DropType Quest83, Quest84",
    (m) =>
      with_(
        tableText("item", `Quest${String(n(m) - 113)}`),
        (t) => `${t} added to the Tome`,
      ),
  ),
  rule(
    /^OptionsListAccount\[(23[3-9]|24[0-2])\]$/,
    "N.js Ninja GemstoneBonus",
    (m) =>
      with_(
        tableText("ninjaItem", `NjGem${String(n(m) - 233)}`),
        (t) => `${t} gemstone LV`,
      ),
  ),
  rule(
    /^Spelunk\[49\]\[(\d+)\]$/,
    "bench pieces.cjs PaletteBonus; N.js GamingStatType",
    (m) => with_(tableText("colour", n(m)), (t) => `${t} black star`),
  ),
  rule(
    /^CustomLists\.FishToolkitInfo\[([01])\]\[(\d+)\]\[1\]$/,
    "N.js FishingToolkit mode D0, inferred",
    (m) => with_(tableText("fishToolkit", n(m), n(m, 2)), (t) => `${t} Weight`),
  ),
  rule(
    /^CustomLists\.FishToolkitInfo\[([01])\]\[(\d+)\]\[([2-7])\]$/,
    "N.js FishingToolkit; N.js ActorEvents_229",
    (m) =>
      with_(
        tableText("fishToolkit", n(m), n(m, 2)),
        (t) => `${t} ${FISH[n(m, 3)] ?? ""}`,
      ),
  ),
  rule(
    new RegExp(`^${escape(GEN_INFO(22, 548))}\\[92\\]\\[(\\d+)\\]$`),
    "N.js MainframeBonus",
    (m) => with_(tableText("lab", n(m)), (t) => `${t} connected`),
  ),
  // spec 009 T030: a Cosmo upgrade's level, which CosmoBonusQTY(t, i) multiplies by the upgrade's own bonus
  rule(/^Holes\[([4-6])\]\[(\d+)\]$/, "N.js Holes CosmoBonusQTY", (m) =>
    with_(tableText("cosmo", n(m) - 4, n(m, 2)), (t) => `${t} level`),
  ),
  rule(/^Dream\[(\d+)\]$/, "N.js Dreamstuff; N.js TotalStats", (m) =>
    with_(tableText("dream", n(m) - 2), (t) => `${t} LV`),
  ),
  rule(
    /^CustomLists\.SummonEnemies\[10\]\[(\d+)\]$/,
    "N.js Summoning WinBonus; N.js ActorEvents_623",
    (m) => {
      const kind = Number(tableText("summonWin", n(m) % 40) ?? NaN);
      return with_(
        Number.isInteger(kind) ? tableText("summonWinText", kind - 1) : null,
        (t) =>
          `Summoning win ${String(n(m) + 1)} bonus: ${t.replace(/^<x\s*/, "")}`,
      );
    },
  ),
  rule(/^FarmRank\[2\]\[(\d+)\]$/, "N.js FarmingStuffs LankRankUpgBonus", (m) =>
    with_(tableText("landRankUpgrade", n(m)), (t) => `${t} LV`),
  ),
  rule(
    /^KRbest\.(?!SummzTrz)(\w+)$/,
    "N.js ActorEvents_481 DungHHandRift; N.js Stuff2 PrimeKillroyTOT",
    (m) =>
      with_(
        tableText("monster", m[1] ?? ""),
        (t) => `Killroy Prime best: ${t}`,
      ),
  ),
  rule(/^Bubba\[2\]\[(\d+)\]$/, "N.js Bubbastuff RealLV", (m) =>
    with_(tableText("bubba", n(m)), (t) => `${t} bonus LV`),
  ),
  rule(/^CustomLists\.MealINFO\[(\d+)\]\[2\]$/, "N.js MealBonus", (m) =>
    with_(tableText("meal", n(m)), (t) => `${t} meal bonus per level`),
  ),
  rule(
    /^Refinery\[(\d+)\]\[1\]$/,
    "N.js ActorEvents_340 1sec; N.js _customEvent_TomeQTY",
    (m) =>
      n(m) < 3
        ? null
        : with_(
            tableText("item", `Refinery${String(n(m) - 2)}`),
            (t) => `${t} rank`,
          ),
  ),
  rule(
    /^CustomLists\.SummonUPG\[(\d+)\]\[6\]$/,
    "N.js Summoning SummUpgBonus",
    (m) =>
      with_(
        tableText("summonUpgradeName", n(m)),
        (t) => `${t} bonus per level`,
      ),
  ),
  rule(
    /^CustomLists\.Research\[58\]\[(\d+)\]$/,
    "N.js MenagerieStuff BoostQTY",
    (m) =>
      with_(
        tableText("research", 57, n(m)),
        (t) => `Menagerie Boost: ${t} (per level)`,
      ),
  ),
  rule(
    /^CustomLists\.Research\[25\]\[(\d+)\]$/,
    "N.js FarmingStuffs StickerBonus",
    (m) =>
      with_(tableText("research", 23, n(m)), (t) => `${t} (bonus per sticker)`),
  ),
  rule(
    /^CustomLists\.AtomInfo\[(\d+)\]\[([124])\]$/,
    "N.js AtomCollider",
    (m) => with_(tableText("atom", n(m)), (t) => `${t} ${ATOM[n(m, 2)] ?? ""}`),
  ),
  rule(
    /^CustomLists\.AtomInfo\[(\d+)\]\[3\]$/,
    "N.js AtomCollider cost, inferred",
    (m) => with_(tableText("atom", n(m)), (t) => `${t} max LV`),
  ),
  rule(
    /^CustomMaps\.NjEQ\.(\w+)\[(3|5)\]$/,
    "N.js Ninja GemstoneBonus, inferred for the other items",
    (m) =>
      with_(
        tableText("ninjaItem", m[1] ?? ""),
        (t) => `${t} ${n(m, 2) === 3 ? "base bonus" : "bonus growth"}`,
      ),
  ),
  rule(
    /^Sailing\[3\]\[(\d+)\]$/,
    "bench names-sailing.cjs; N.js Sailing ArtifactBonus",
    (m) => {
      const rows = tableRows("artifact");
      if (rows === null) return null;
      return n(m) < rows
        ? with_(tableText("artifact", n(m)), (t) => `${t} rarity`)
        : `Artifact slot ${String(n(m) + 1)} rarity (no artifact yet)`;
    },
  ),
  rule(
    /^CustomLists\.BubbaUpg\[(\d+)\]\[([1-3])\]$/,
    "N.js Bubbastuff TotUpgBonus",
    (m) =>
      with_(tableText("bubba", n(m)), (t) => `${t} ${COLUMNS[n(m, 2)] ?? ""}`),
  ),
  rule(
    /^QuestComplete\.([A-Za-z_]+?)(\d+)$/,
    "N.js QuestComplete by the NPC of DIAL",
    (m) =>
      `${(m[1] ?? "").replace(/_/g, " ")} quest ${String(n(m, 2))} completed`,
  ),
  // spec 009 T031: a star sign's own total, the sign's bonus added once for each set of signs it is in (N.js StarSigns,
  // while the list of equipped signs holds it), by its bonus's words and its name
  rule(/^DNSM\.StarSigns\[(\d+)\]$/, "N.js StarSigns cache by sign", (m) =>
    with_(tableText("sign", n(m)), (sign) =>
      with_(tableText("signBonus", n(m)), (bonus) => {
        const more = tableText("signBonusMore", n(m));
        const words = `${bonus.replace(/^[+-]?[\d.]+%?\s*/, "")}${more ? ` ${more}` : ""}`;
        return `${words} (${sign})`;
      }),
    ),
  ),
  // the family bonus k of FamBonusQTYs is the class k ÷ 2's (N.js TalentCalc -3 keys it by twice the class, plus 0 or
  // 1; the family bonus screen shows FamBonusQTYs of twice the class with ClassFamilyBonuses of the class)
  rule(
    /^DNSM\.FamBonusQTYs\[(\d+)\]$/,
    "N.js TalentCalc FamBonusQTYs; N.js FamilyBonsuesREAL",
    (m) =>
      with_(
        tableText("family", Math.floor(n(m) / 2)),
        (t) => `${t.replace(/^@\s*/, "")} (family bonus)`,
      ),
  ),
];

/** The rules of the game state paths: by a table first, then in words. */
export const STATE_NAMES: readonly StateRule[] = [
  ...TABLE_RULES,
  ...WORD_RULES,
];
