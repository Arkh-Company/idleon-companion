// pieces.cjs `tagOf` from the bench at BASELINE-4 (spec 008, T023): the tag a system's call carries, its system's word
// and its number ("Grimoire 5"). The app shows no tag; the name passes read it, as the bench's do: a level above shows
// its system by its name or its tag (tree/kid-names.ts), and the head of a system's member keeps its own name
// (tree/parent-passes.ts). Left out: the tags of the root's own cache reads (the app has no such piece of its own).

const at = (a: readonly unknown[], i: number) => String(a[i]);

/** Each system's call, by its block and its mode (its first argument) written "block mode", with its tag. */
type Tag = (a: readonly unknown[]) => string;
export const SYSTEM_TAGS: readonly {
  test: RegExp;
  tag: Tag;
  proof: string;
}[] = (
  [
    [/^GetTalentNumber /, (a) => `Talent ${at(a, 1)}`],
    [/^Companions /, (a) => `Companion ${at(a, 0)}`],
    [/^CardBonusREAL /, (a) => `Card Type ${at(a, 0)}`],
    [/^CardSetBonuses /, (a) => `Card Set ${at(a, 1)}`],
    [/^Shrine /, (a) => `Shrine ${at(a, 0)}`],
    [/^prayersReal /, (a) => `Prayer ${at(a, 0)}`],
    [/^GuildBonuses /, (a) => `Guild ${at(a, 0)}`],
    [/^ArcadeBonus /, (a) => `Arcade ${at(a, 0)}`],
    [/^StampBonusOfTypeX /, () => "Stamps"],
    [/^ResearchStuff /, (a) => `Grid ${at(a, 1)}`],
    [/^AchieveStatus /, (a) => `Achievement ${at(a, 0)}`],
    [/^GetSetBonus /, () => "Set"],
    [/^EtcBonuses /, (a) => `etcBonus ${at(a, 0)}`],
    [/^RoyalG /, (a) => `Statue ${at(a, 1)}`],
    [/^MenagerieStuff /, (a) => `Boost ${at(a, 1)}`],
    [/^SushiStuff /, (a) => `RoG ${at(a, 1)}`],
    [/^Ninja /, (a) => `Pristine ${at(a, 1)}`],
    [/^Dreamstuff /, (a) => `Dream Challenge ${at(a, 1)}`],
    [/^RunCodeOfTypeXforThingY CardLv$/, (a) => `Card ${at(a, 1)}`],
    [/^Labb SigilBonus$/, (a) => `Sigil ${at(a, 2)}`],
    [/^Breeding /, (a) => `Breeding ${at(a, 2)}`],
    [/^Summoning WinBonus$/, (a) => `Summoning ${at(a, 1)}`],
    [/^Summoning TomeBonus$/, (a) => `Tome ${at(a, 1)}`],
    [/^Summoning OwlBonuses$/, (a) => `Owl ${at(a, 1)}`],
    [/^Summoning VotingBonusz$/, (a) => `Voting ${at(a, 1)}`],
    [/^Summoning GrimoireUpgBonus$/, (a) => `Grimoire ${at(a, 1)}`],
    [/^Summoning VaultUpgBonus$/, (a) => `Vault ${at(a, 1)}`],
    [/^FarmingStuffs LankRankUpgBonus$/, (a) => `Farming rank ${at(a, 1)}`],
    [/^FarmingStuffs CropSCbonus$/, (a) => `Crop Depot ${at(a, 1)}`],
    [/^FarmingStuffs ExoticBonusQTY$/, (a) => `Exotic ${at(a, 1)}`],
    [/^Holes B_UPG$/, (a) => `Cavern upg ${at(a, 1)}`],
    [/^Holes MeasurementBonusTOTAL$/, (a) => `Measurement ${at(a, 1)}`],
    [/^Holes MonumentROGbonuses$/, () => "Monument"],
    [/^Thingies EmperorBon$/, (a) => `Emperor ${at(a, 1)}`],
    [/^Thingies FriendBonusStatz$/, (a) => `Friend ${at(a, 1)}`],
    [/^Thingies LegendPTS_bonus$/, (a) => `Legend ${at(a, 1)}`],
    [/^Spelunk ShopUpgBonus$/, (a) => `Spelunking ${at(a, 1)}`],
    [/^Minehead BonusQTY$/, (a) => `Floor ${at(a, 1)}`],
  ] satisfies [RegExp, Tag][]
).map(([test, tag]) => ({ test, tag, proof: "bench pieces.cjs tagOf" }));

/** The tag of the call written `code` (tree/rows.ts `callText`); "" for any other call, a read or no code. */
export function tagOf(code: string | null): string {
  const m = /^(\w+)\((.*)\)$/s.exec(code ?? "");
  if (!m) return "";
  let a: unknown;
  try {
    a = JSON.parse(`[${m[2] ?? ""}]`);
  } catch {
    return "";
  }
  if (!Array.isArray(a)) return "";
  const key = `${m[1] ?? ""} ${String(a[0])}`;
  return SYSTEM_TAGS.find((t) => t.test.test(key))?.tag(a) ?? "";
}
