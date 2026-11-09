// The numbers the calculator asks for: [id, block of the game, argument of the block].
export const TARGETS = [
  ["damageMax", "DamageDealed", "Max"],
  ["damageMin", "DamageDealed", "Min"],
  ["hp", "PlayerHPmax", 0],
  ["mp", "PlayerMPmax", 0],
  ["accuracy", "PlayerAccTot", 0],
  ["str", "TotalStats", "STR"],
  ["agi", "TotalStats", "AGI"],
  ["wis", "TotalStats", "WIS"],
  ["luk", "TotalStats", "LUK"],
  ["dropRate", "TotalStats", "Drop_Rarity"],
  ["afkGains", "AFKgainrates", "Fighting"],
] as const;

/** One number per id; `null` means it could not be calculated. Same ids as `NUMBER_IDS` (a test checks): imports stay local. */
export type CalcNumbers = Record<(typeof TARGETS)[number][0], number | null>;
