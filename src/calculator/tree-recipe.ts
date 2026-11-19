// The recording recipe of the real game (spec 008, T021): only names of caches, blocks and helper events, as the bench
// keeps them at BASELINE-4 (build-tree.cjs, step 4: `RECOMPUTE` and `BUILDERS`). Proof by reference, never game text:
// each cache was rebuilt offline and compared entry by entry with the running game's on the bench (test of 10/11).
import type { Recipe } from "./recording.ts";
import type { FollowCall } from "./tree-record.ts";
import type { TreeRoot } from "./tree-roots.ts";

const block = (name: string, ...args: (string | number)[]) => ({
  block: name,
  args,
});

export const TREE_RECIPE: Recipe = {
  // Each one rebuilt offline keeps the Drop Rate identical (build-tree.cjs, step 4, the measure of 10/11).
  recompute: [
    "OwlBonus",
    "SetBonusTOTz",
    "StampBonuses_Map_Of_Val",
    "SummWinBonus",
    "UNQ_sushi",
    "EmperorBon",
    "FountBonT",
    "GalleryTrophyBonTOT",
    "GalleryNametagBonTOT",
    "PremHatBonTOT",
    "CapeVineBonTOT",
    "PaletteBonz",
    "FrendBonzStatz",
    "SpelunkyUpgTOT",
    "TotKngdSt",
    "PrayNonEq",
    "GlimboTOT",
    "ChipBbonusz",
  ],
  // The game's own call that builds each cache (build-tree.cjs, step 4, `BUILDERS`; `KEEP_LIVE` in step 6b).
  builders: [
    { cache: "AlchVials", run: block("TalentCalc", -2), keepLive: true },
    { cache: "AlchBubbles", run: block("TalentCalc", -2), keepLive: true },
    { cache: "FamBonusQTYs", run: block("TalentCalc", -3) },
    { cache: "MealBonusesS", run: block("TalentCalc", -6) },
    { cache: "SailzArtiBonusL", run: block("TalentCalc", -9) },
    {
      cache: "TotalStatsETCmap",
      run: block("TotalStats", "calcEtcBonuses", 0, 0),
    },
    {
      cache: "LabMFbonuses",
      run: block("TalentCalc", -7),
      // The Lab helper's own event, step "d", fills the Lab's connections first (step 6b, probe-lab2.cjs).
      before: {
        slot: 22,
        behavior: "ActorEvents_548",
        set: ["_TRIGGEREDtext", "d"],
        event: "_customEvent_Lab",
      },
    },
    {
      cache: "ShinyBonusS",
      run: block("Breeding", "ShinyBonusS", "Nah", 0, -1),
    },
    { cache: "StarSigns", run: block("StarSigns", 0) },
    { cache: "LoreEpiBon", run: block("Thingies", "LoreEpiBon", -1, 0) },
    {
      cache: "VaultKillzTOT",
      run: block("Summoning", "VaultKillzTotal", 0, 0),
    },
    { cache: "skillLvRanks", run: block("RiftStuff", "skillLvRanks", 0) },
    {
      cache: "ExoticFarmBon",
      run: block("FarmingStuffs", "ExoticBonusQTY", -1, 0),
    },
    {
      cache: "TomeQTY",
      run: {
        slot: 4,
        behavior: "ActorEvents_229",
        event: "_customEvent_TomeQTY",
        args: [],
      },
    },
    { cache: "BigFishBon", run: block("Spelunk", "BigFishBonuses", -1, 0) },
  ],
};

/**
 * The calls the recording makes beside every tree's root (spec 009, FR-018: every value a system feeds shows that
 * system, even at 0): N.js Summoning2 MeritocBonusz skips the Meritocracy bonus multiplier while the vote is not the
 * week's, so the recording calls it itself (tree/build-up-vote.ts). The tree's root stays the first call.
 */
export const EXTRA_ROOTS: readonly TreeRoot[] = [
  ["Summoning", ["MeritocBonuszMulti", 0, 0]],
];

/**
 * The follow-up calls after the roots (tree-record.ts `FollowCall`): the max level of each Legend Talent whose bonus the
 * roots called (N.js Thingies "LegendTalent_MaxLV", which the game's screen shows as the talent's points out of its max;
 * tree/build-up-talents.ts).
 */
export const FOLLOW_CALLS: readonly FollowCall[] = [
  ["Thingies", "LegendPTS_bonus", "Thingies", "LegendTalent_MaxLV"],
];
