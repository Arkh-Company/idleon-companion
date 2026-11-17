// The system of a source (spec 009, FR-003, FR-004, research R2): pieces.cjs `tagOf` of the bench, from the block a
// source calls (written "block mode", as tree/tags.ts reads it) or the path it reads; a cache read with no rule of its
// own goes to the block that writes it. No rule, no system: the caller files the source under "🔹 Other", never by a
// guess. The order and the emoji are the V1's (bench build-v1mold.cjs V1, the site's lib/dropRate/systems.ts).
import { callKey } from "./tags.ts";

export interface System {
  name: string;
  emoji: string;
}

/** The V1 systems, in the V1 order, "Other" last. */
export const V1_SYSTEMS: readonly System[] = (
  [
    ["LUK / Stats", "🍀"],
    ["Talents", "🎯"],
    ["Cards", "🃏"],
    ["Star Signs", "⭐"],
    ["Achievements", "🏆"],
    ["Companions", "🐾"],
    ["Friends", "🤝"],
    ["Stamps", "📜"],
    ["Alchemy", "⚗️"],
    ["Sigils", "🔮"],
    ["Prayers", "🙏"],
    ["Shrines", "⛩️"],
    ["Guild", "🛡️"],
    ["Arcade", "🎮"],
    ["Voting", "🗳️"],
    ["Post Office", "📮"],
    ["Shiny Pets", "🐉"],
    ["Tome", "📖"],
    ["Researching", "🔬"],
    ["Chips", "💎"],
    ["Dreams", "💭"],
    ["Cloud Bonus", "☁️"],
    ["Owl", "🦉"],
    ["Grimoire", "📕"],
    ["Vault", "🏦"],
    ["Farming", "🌾"],
    ["Holes", "🕳️"],
    ["Emperor", "👑"],
    ["Legend Talents", "⚔️"],
    ["Spelunk Shop", "🪨"],
    ["Sushi", "🍣"],
    ["Minehead", "⛏️"],
    ["Menagerie", "🪼"],
    ["Arcane Map", "🗺️"],
    ["Glimbo", "🎲"],
    ["Equipment", "🎽"],
    ["Obols", "🪙"],
    ["Gallery", "🖼️"],
    ["Hatrack", "🎩"],
    ["Cape Vine", "🧣"],
    ["Golden Food", "🍔"],
    ["Set Bonuses", "🧰"],
    ["Bundles", "🎁"],
    ["Pristine Charms", "🌟"],
    ["Sneaking Mastery", "🥷"],
    ["Summoning", "🐲"],
    ["Royal Guardian", "🏰"],
    ["Other", "🔹"],
  ] as const
).map(([name, emoji]) => ({ name, emoji }));

export const SYSTEM_ORDER: readonly string[] = V1_SYSTEMS.map((s) => s.name);

const TAG_OF = "bench pieces.cjs tagOf";

/** Each rule reads a call's "block mode" or a read's path, as pieces.cjs `tagOf` does; the first that matches decides. */
export const SYSTEM_RULES: readonly {
  test: RegExp;
  system: string;
  proof: string;
  /** A rule on a read's path, never on a call. */
  read?: true;
}[] = [
  ...(
    [
      [/^GetTalentNumber /, "Talents"],
      [/^Companions /, "Companions"],
      [/^CardBonusREAL /, "Cards"],
      [/^CardSetBonuses /, "Cards"],
      [/^RunCodeOfTypeXforThingY CardLv$/, "Cards"],
      [/^Shrine /, "Shrines"],
      [/^prayersReal /, "Prayers"],
      [/^GuildBonuses /, "Guild"],
      [/^ArcadeBonus /, "Arcade"],
      [/^StampBonusOfTypeX /, "Stamps"],
      [/^ResearchStuff /, "Researching"],
      [/^AchieveStatus /, "Achievements"],
      [/^GetSetBonus /, "Set Bonuses"],
      [/^EtcBonuses /, "Equipment"],
      [/^GoldFoodBonuses /, "Golden Food"],
      [/^ArcaneType /, "Arcane Map"],
      [/^RoyalG /, "Royal Guardian"],
      [/^MenagerieStuff /, "Menagerie"],
      [/^SushiStuff /, "Sushi"],
      [/^Ninja /, "Pristine Charms"],
      [/^Dreamstuff /, "Dreams"],
      [/^Labb SigilBonus$/, "Sigils"],
      [/^Breeding /, "Shiny Pets"],
      [/^Summoning WinBonus$/, "Summoning"],
      [/^Summoning TomeBonus$/, "Tome"],
      [/^Summoning OwlBonuses$/, "Owl"],
      [/^Summoning VotingBonusz$/, "Voting"],
      [/^Summoning GrimoireUpgBonus$/, "Grimoire"],
      [/^Summoning VaultUpgBonus$/, "Vault"],
      [
        /^FarmingStuffs (?:LankRankUpgBonus|CropSCbonus|ExoticBonusQTY)$/,
        "Farming",
      ],
      [/^Holes (?:B_UPG|MeasurementBonusTOTAL|MonumentROGbonuses)$/, "Holes"],
      [/^Thingies EmperorBon$/, "Emperor"],
      [/^Thingies FriendBonusStatz$/, "Friends"],
      [/^Thingies LegendPTS_bonus$/, "Legend Talents"],
      [/^Spelunk ShopUpgBonus$/, "Spelunk Shop"],
      [/^Minehead GlimboDRmulti$/, "Glimbo"],
      [/^Minehead BonusQTY$/, "Minehead"],
    ] as const
  ).map(([test, system]) => ({ test, system, proof: TAG_OF })),
  // the bubbles' cache is written by the cauldron's block, Alchemy's (tree/loop-parts.ts LOOP_ENTRY_CACHES)
  {
    test: /^CauldronStats /,
    system: "Alchemy",
    proof:
      "bench pieces.cjs tagOf; bench pieces.cjs cacheRows OPUS4-4; N.js CauldronStats",
  },
  ...(
    [
      [/BoxRewards/, "Post Office"],
      [/AlchBubbles/, "Alchemy"],
      [/AlchVials/, "Alchemy"],
      [/StarSigns/, "Star Signs"],
      [/FamBonusQTYs\[32\]/, "Royal Guardian"],
    ] as const
  ).map(([test, system]) => ({
    test,
    system,
    proof: TAG_OF,
    read: true as const,
  })),
];

const BY_NAME = new Map(V1_SYSTEMS.map((s) => [s.name, s]));

/**
 * The system of the source written `code` (tree/rows.ts `callText`, or a read's path); a read with no rule of its own
 * takes its writer's (`writerBlock`, the writer's call written as `code`). Null when no rule names it.
 */
export function systemOf(
  code: string | null,
  writerBlock?: string,
): System | null {
  if (code === null) return null;
  const call = callKey(code);
  const rule = SYSTEM_RULES.find((r) =>
    call ? !r.read && r.test.test(call.key) : r.read && r.test.test(code),
  );
  if (rule) return BY_NAME.get(rule.system) ?? null;
  return call || writerBlock === undefined ? null : systemOf(writerBlock);
}

/** The group's name: its emoji, then its system ("⚗️ Alchemy"). */
export const systemLabel = (s: System): string => `${s.emoji} ${s.name}`;
