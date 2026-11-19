// pieces.cjs `tagOf` from the bench at BASELINE-4 (spec 008, T023): the tag a system's call carries, its system's word
// and its number ("Grimoire 5"). The app shows no tag; the name passes read it, as the bench's do: a level above shows
// its system by its name or its tag (tree/kid-names.ts), and the head of a system's member keeps its own name
// (tree/parent-passes.ts). Left out: the tags of the root's own cache reads (the app has no such piece of its own).

const at = (a: readonly unknown[], i: number) => String(a[i]);

/**
 * Each system's call, by its block and its mode (its first argument) written "block mode", with its system (spec 009,
 * tree/systems.ts, the V1 name) and its tag.
 */
type Tag = (a: readonly unknown[]) => string;
export const SYSTEM_TAGS: readonly {
  test: RegExp;
  system: string;
  tag: Tag;
  proof: string;
}[] = (
  [
    [/^GetTalentNumber /, "Talents", (a) => `Talent ${at(a, 1)}`],
    [/^Companions /, "Companions", (a) => `Companion ${at(a, 0)}`],
    [/^CardBonusREAL /, "Cards", (a) => `Card Type ${at(a, 0)}`],
    [/^CardSetBonuses /, "Cards", (a) => `Card Set ${at(a, 1)}`],
    [/^Shrine /, "Shrines", (a) => `Shrine ${at(a, 0)}`],
    [/^prayersReal /, "Prayers", (a) => `Prayer ${at(a, 0)}`],
    [/^GuildBonuses /, "Guild", (a) => `Guild ${at(a, 0)}`],
    [/^ArcadeBonus /, "Arcade", (a) => `Arcade ${at(a, 0)}`],
    [/^StampBonusOfTypeX /, "Stamps", () => "Stamps"],
    [/^ResearchStuff /, "Researching", (a) => `Grid ${at(a, 1)}`],
    [/^AchieveStatus /, "Achievements", (a) => `Achievement ${at(a, 0)}`],
    [/^GetSetBonus /, "Set Bonuses", () => "Set"],
    [/^EtcBonuses /, "Equipment", (a) => `etcBonus ${at(a, 0)}`],
    [/^RoyalG /, "Royal Guardian", (a) => `Statue ${at(a, 1)}`],
    [/^MenagerieStuff /, "Menagerie", (a) => `Boost ${at(a, 1)}`],
    [/^SushiStuff /, "Sushi", (a) => `RoG ${at(a, 1)}`],
    [/^Ninja /, "Pristine Charms", (a) => `Pristine ${at(a, 1)}`],
    [/^Dreamstuff /, "Dreams", (a) => `Dream Challenge ${at(a, 1)}`],
    [/^RunCodeOfTypeXforThingY CardLv$/, "Cards", (a) => `Card ${at(a, 1)}`],
    [/^Labb SigilBonus$/, "Sigils", (a) => `Sigil ${at(a, 2)}`],
    [/^Breeding /, "Shiny Pets", (a) => `Breeding ${at(a, 2)}`],
    [/^Summoning WinBonus$/, "Summoning", (a) => `Summoning ${at(a, 1)}`],
    [/^Summoning TomeBonus$/, "Tome", (a) => `Tome ${at(a, 1)}`],
    [/^Summoning OwlBonuses$/, "Owl", (a) => `Owl ${at(a, 1)}`],
    [/^Summoning VotingBonusz$/, "Voting", (a) => `Voting ${at(a, 1)}`],
    [/^Summoning GrimoireUpgBonus$/, "Grimoire", (a) => `Grimoire ${at(a, 1)}`],
    [/^Summoning VaultUpgBonus$/, "Vault", (a) => `Vault ${at(a, 1)}`],
    [
      /^FarmingStuffs LankRankUpgBonus$/,
      "Farming",
      (a) => `Farming rank ${at(a, 1)}`,
    ],
    [/^FarmingStuffs CropSCbonus$/, "Farming", (a) => `Crop Depot ${at(a, 1)}`],
    [/^FarmingStuffs ExoticBonusQTY$/, "Farming", (a) => `Exotic ${at(a, 1)}`],
    [/^Holes B_UPG$/, "Holes", (a) => `Cavern upg ${at(a, 1)}`],
    [
      /^Holes MeasurementBonusTOTAL$/,
      "Holes",
      (a) => `Measurement ${at(a, 1)}`,
    ],
    [/^Holes MonumentROGbonuses$/, "Holes", () => "Monument"],
    [/^Thingies EmperorBon$/, "Emperor", (a) => `Emperor ${at(a, 1)}`],
    [/^Thingies FriendBonusStatz$/, "Friends", (a) => `Friend ${at(a, 1)}`],
    [
      /^Thingies LegendPTS_bonus$/,
      "Legend Talents",
      (a) => `Legend ${at(a, 1)}`,
    ],
    [/^Spelunk ShopUpgBonus$/, "Spelunk Shop", (a) => `Spelunking ${at(a, 1)}`],
    [/^Minehead BonusQTY$/, "Minehead", (a) => `Floor ${at(a, 1)}`],
  ] satisfies [RegExp, string, Tag][]
).map(([test, system, tag]) => ({
  test,
  system,
  tag,
  proof: "bench pieces.cjs tagOf",
}));

/** The call written `code` (tree/rows.ts `callText`) as its key "block mode" and its arguments; null for a read or no code. */
export function callKey(
  code: string | null,
): { key: string; args: unknown[] } | null {
  const m = /^(\w+)\((.*)\)$/s.exec(code ?? "");
  if (!m) return null;
  let a: unknown;
  try {
    a = JSON.parse(`[${m[2] ?? ""}]`);
  } catch {
    return null;
  }
  if (!Array.isArray(a)) return null;
  return { key: `${m[1] ?? ""} ${String(a[0])}`, args: a };
}

/** The tag of the call written `code` (tree/rows.ts `callText`); "" for any other call, a read or no code. */
export function tagOf(code: string | null): string {
  const c = callKey(code);
  if (!c) return "";
  return SYSTEM_TAGS.find((t) => t.test.test(c.key))?.tag(c.args) ?? "";
}
