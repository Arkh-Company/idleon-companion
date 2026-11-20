// The system of a source (spec 009, FR-003, FR-004, research R2): pieces.cjs `tagOf` of the bench, from the block a
// source calls (written "block mode", as tree/tags.ts reads it) or the path it reads; a cache read with no rule of its
// own goes to the block that writes it. No rule, no system: the caller files the source under "🔹 Other", never by a
// guess. The order and the emoji are the V1's (bench build-v1mold.cjs V1, the site's lib/dropRate/systems.ts).
import { callKey, SYSTEM_TAGS } from "./tags.ts";

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
    ["Arcade", "🕹️"],
    ["Voting", "🗳️"],
    ["Post Office", "📮"],
    ["Shiny Pets", "🐉"],
    ["Tome", "📖"],
    ["Researching", "🔬"],
    // decision of 19/11: 🧩, as the Gem Shop takes 💎
    ["Chips", "🧩"],
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

/**
 * The systems beyond the V1 (T028, from the probe of the 716 trees): after the V1's, in the order the sum gives them
 * (FR-004), "Other" still last.
 */
export const EXTRA_SYSTEMS: readonly System[] = (
  [
    ["Meals", "🍲"],
    ["Bribes", "💰"],
    ["Jelly Operator", "🫧"],
    ["Atom Collider", "⚛️"],
    ["Compass", "🧭"],
    ["Gaming", "🎮"],
    ["Spelunking", "🔦"],
    ["Trapping", "🪤"],
    ["Sailing", "⛵"],
    ["Lab", "🧪"],
    // family 15 of the audit of 19/11, the names and emojis of Vinicius's decision 4
    ["Family Bonuses", "👪"],
    ["Bubba", "🥩"],
    ["Clam", "🐚"],
    ["Rift", "🌀"],
    ["Killroy", "💀"],
    // decision of 19/11: Divinity takes 🕊️, as Prayers has 🙏
    ["Divinity", "🕊️"],
    ["Gem Shop", "💎"],
  ] as const
).map(([name, emoji]) => ({ name, emoji }));

const TAG_OF = "bench pieces.cjs tagOf";

/**
 * The rules beyond the tagged calls (tree/tags.ts SYSTEM_TAGS carries each tagged call's system): the calls with no
 * tag and the reads by path. Each reads a call's "block mode" or a read's path, as pieces.cjs `tagOf` does.
 */
export const SYSTEM_RULES: readonly {
  test: RegExp;
  system: string;
  proof: string;
  /** A rule on a read's path, never on a call. */
  read?: true;
}[] = [
  ...(
    [
      [/^GoldFoodBonuses /, "Golden Food"],
      [/^ArcaneType /, "Arcane Map"],
      [/^Minehead GlimboDRmulti$/, "Glimbo"],
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
  // Dream[2 + i] is the level of Equinox upgrade i: the V1 files 5 × Dream[10] (Faux Jewels) under Dreams
  {
    test: /^Dream\[\d+\]$/,
    system: "Dreams",
    proof: "bench build-v1mold.cjs adds (Faux Jewels, Equinox upgrade 8)",
    read: true,
  },
  // T028, the probe's "Other" list: a call of the system's own block, by its name in the game's code
  ...(
    [
      [/^CompLV2 /, "Companions", "N.js CompLV2 (reads CompanionLVz)"],
      [/^FarmingStuffs /, "Farming", "N.js FarmingStuffs"],
      [/^MealBonus /, "Meals", "N.js MealBonus"],
      [/^GetBribeBonus /, "Bribes", "N.js GetBribeBonus"],
      [/^JellyOperation /, "Jelly Operator", "N.js JellyOperation"],
      [/^AtomCollider /, "Atom Collider", "N.js AtomCollider"],
      [/^Windwalker Compass/, "Compass", "N.js Windwalker CompassBonus"],
      [/^GamingStatType /, "Gaming", "N.js GamingStatType"],
      [/^TrappingStuffs /, "Trapping", "N.js TrappingStuffs"],
      [/^Sailing /, "Sailing", "N.js Sailing"],
      [/^MainframeBonus /, "Lab", "N.js MainframeBonus"],
      [/^chipBonuses /, "Chips", "N.js chipBonuses"],
      [/^CaptBonusCalc /, "Sailing", "N.js Sailing (calls CaptBonusCalc)"],
    ] as const
  ).map(([test, system, proof]) => ({ test, system, proof })),
  // T028: a read of the table or cache the system's block reads or writes
  ...(
    [
      [/^Research\[/, "Researching", "N.js ResearchStuff (reads Research)"],
      [
        /Stamp_TOTAL_bonus_of_type_X/,
        "Stamps",
        "N.js StampBonusOfTypeX (writes Stamp_TOTAL_bonus_of_type_X)",
      ],
      [/^Menagerie\[/, "Menagerie", "N.js MenagerieStuff (reads Menagerie)"],
      [/Owlz/, "Owl", "N.js Summoning (reads CustomLists.Owlz)"],
      [/MealBonusesS/, "Meals", "N.js MealBonus (reads MealBonusesS)"],
      [/^Spelunk\[/, "Spelunking", "N.js Spelunk (reads Spelunk)"],
      [/^Sailing\[/, "Sailing", "N.js Sailing (reads Sailing)"],
      [/^Atoms\[/, "Atom Collider", "N.js AtomCollider (reads Atoms)"],
    ] as const
  ).map(([test, system, proof]) => ({
    test,
    system,
    proof,
    read: true as const,
  })),
  // Family 15 (audit of 19/11): every source with the game's code takes its system by the block it calls, the mode
  // only where the block hosts more than one system (Thingies, RandomEvent, Minehead); the tagged modes above win
  ...(
    [
      [/^Bubbastuff /, "Bubba", "N.js Bubbastuff (reads Bubba)"],
      [
        /^Thingies Clam/,
        "Clam",
        "N.js Thingies ClamWorkBonus, Clam_Cost, ClamBonuses",
      ],
      [/^Divinity /, "Divinity", "N.js Divinity"],
      [
        /^RiftStuff /,
        "Rift",
        "N.js RiftStuff (each mode is 0 below a Rift level)",
      ],
      [
        /^RandomEvent KillroyBonuses$/,
        "Killroy",
        "N.js RandomEvent KillroyBonuses (the text of the Killroy shop)",
      ],
      [/^TalentCalc /, "Talents", "N.js TalentCalc (the math of a talent)"],
      [
        /^Thingies Have_b[ao]n_/,
        "Bundles",
        "N.js Thingies Have_ban_i (reads BundlesReceived)",
      ],
      [/^Holes2? /, "Holes", "N.js Holes; N.js Holes2"],
      [
        /^Minehead (GlimboTotalTrades|Glimbo_Cost)$/,
        "Glimbo",
        "N.js Minehead GlimboTotalTrades",
      ],
      [/^Minehead /, "Minehead", "N.js Minehead"],
      [
        /^Summoning SummUpgBonus$/,
        "Summoning",
        "N.js Summoning SummUpgBonus (the Summoning upgrades)",
      ],
      [/^Labb /, "Lab", "N.js Labb (reads Lab)"],
      [/^TotalStats /, "LUK / Stats", "N.js TotalStats"],
    ] as const
  ).map(([test, system, proof]) => ({ test, system, proof })),
  ...(
    [
      // FamBonusQTYs[32] is Royal Guardian's (the rule above wins); every other index is a class's family bonus
      [
        /FamBonusQTYs\[/,
        "Family Bonuses",
        "N.js FamBonusQTYs (the family bonus of each class)",
      ],
      [/^Bubba\[|^DNSM\.Bubba_/, "Bubba", "N.js Bubbastuff (reads Bubba)"],
      [
        /^DNSM\.CalcTalentMAP/,
        "Talents",
        "N.js TalentCalc (writes CalcTalentMAP)",
      ],
      [/^DNSM\.ArcadBonDNz/, "Arcade", "N.js ArcadeBonus (writes ArcadBonDNz)"],
      [/^BundlesReceived\./, "Bundles", "N.js BundlesReceived"],
      [/^Lab\[/, "Lab", "N.js Labb (reads Lab)"],
      // fix tree-shape-091, round 1: no source in a group Other (Vinicius, 19/11)
      [
        /^OptionsListAccount\[232\]$/,
        "Sneaking Mastery",
        "names-static OptionsListAccount[232] (bench [K0-NAME232]): the count of the sneaking masteries completed",
      ],
      [
        /^GemItemsPurchased\[/,
        "Gem Shop",
        "N.js GemItemsPurchased (the purchases of the gem shop)",
      ],
    ] as const
  ).map(([test, system, proof]) => ({
    test,
    system,
    proof,
    read: true as const,
  })),
];

/**
 * The blocks the game calls as a helper of its caller's math, a curve or a log, of no system of their own (T028): such a
 * call takes the system of the sources in it (tree/mould.ts), or none.
 */
const HELPERS = new Set(["ArbitraryCode5Inputs", "getLOG", "Log2"]);
export const isHelper = (code: string): boolean =>
  HELPERS.has(callKey(code)?.key.split(" ")[0] ?? "");

const BY_NAME = new Map(
  [...V1_SYSTEMS, ...EXTRA_SYSTEMS].map((s) => [s.name, s]),
);

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
  const rule = [...SYSTEM_TAGS, ...SYSTEM_RULES].find((r) =>
    call
      ? !("read" in r) && r.test.test(call.key)
      : "read" in r && r.test.test(code),
  );
  if (rule) return BY_NAME.get(rule.system) ?? null;
  return call || writerBlock === undefined ? null : systemOf(writerBlock);
}

/**
 * The one talent of a product's parts (spec 009 T029, decision of 18/11): a talent multiplied by a count is the talent's,
 * its name and its system, as in the V1 (bench build-v1mold.cjs: a term is its first source's); else null.
 */
export function scaledTalent<T extends { node: { code: string | null } }>(
  parts: readonly T[],
): T | null {
  const talents = parts.filter(
    (k) => k.node.code !== null && systemOf(k.node.code)?.name === "Talents",
  );
  const [only] = talents;
  return parts.length > 1 && talents.length === 1 ? (only ?? null) : null;
}

/** The group's name: its emoji, then its system ("⚗️ Alchemy"). */
export const systemLabel = (s: System): string => `${s.emoji} ${s.name}`;
