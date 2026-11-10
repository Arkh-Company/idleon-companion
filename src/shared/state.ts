// The pieces of the game's state, how they travel in slices, and the numbers calculated from them (spec 004).

/** A top key of the state, a split map and one of its children, or a subkey of a character. */
export type StatePath = [string] | [string, string] | [string, string, string];
export type StateClass = "fast" | "slow";

/** What one read gives and the link carries. `value` is only data for the calculator. */
export interface StateSlice {
  sentinel: { char: string | null; map: number };
  pieces: { path: StatePath; value: unknown }[];
  at: number;
  cycles: { fast: number; all: number };
}

/** Tables the calculator builds from the game's own classes: they never travel. */
export const STATE_EXCLUDED: readonly string[] = [
  "CustomLists",
  "ItemDefinitionsGET",
  "MonsterDefinitionsGET",
  "DialogueDefGET",
  "PixelHelperActor",
  "CustomMaps",
];

/** Maps read child by child, because one child is too big for a slice or has its own class. */
export const STATE_SPLIT: readonly string[] = ["PlayerDATABASE", "DNSM"];

/** The closed list of `_vars`: nothing outside it is ever read out. */
export const VARS_KEYS: readonly string[] = [
  "voteCategories",
  "voteCat2",
  "votePercent",
  "votePercent2",
  "TomePct",
  "TomeOn",
  "ArcGballPCT",
  "ArcadeRotation",
  "ArcadeBonuses",
  "AncientArtiPCT",
  "AncientOddPerIsland",
  "HappyHours",
  "A_friendBons",
  "A_ResXP",
  "GuildRank",
  "ChipRepo",
  "Dungeon_CardMulti",
  "Dungeon_CredMulti",
  "Dungeon_FlurboMulti",
  "GamingFertCostExpA",
  "DivCostAfter3",
  "DustCost",
  "A_MineCost",
  "A_MineHP",
  "A_divArc",
  "KillroySwap",
  "EventActive",
];

/**
 * The numbers the app shows. A feature declares its numbers here, and the catalog check (`catalogProblems`) says which rows
 * to promote to the fast reading. A new number also means measuring the catalog's `todos` rows again: they start to cite
 * it with no measurement.
 */
export const NUMBER_IDS = [
  "damageMax",
  "damageMin",
  "hp",
  "mp",
  "accuracy",
  "str",
  "agi",
  "wis",
  "luk",
  "dropRate",
  "afkGains",
] as const;

/** One number per id; `null` means it could not be calculated. */
export type CalcNumbers = Record<(typeof NUMBER_IDS)[number], number | null>;
