// The read a value equals (spec 008, T022): the port of pieces.cjs `valPath` and `TABLE_READ` from the bench at
// BASELINE-4. A value with no source of its own is named by the read that holds it: the account's state first, a game
// table only when nothing else has it, never a length, a search of the game or a read that holds it by coincidence.
import type { RecValue } from "../recording.ts";

export type Reads = ReadonlyMap<string, RecValue>;
/** A rule of the bench by the path or call it matches, with its proof by reference. */
export interface Rule {
  test: RegExp;
  proof: string;
}

/** The game's tables: a value is named by one only when no read of the account's state has it. */
export const TABLE_READ: readonly Rule[] = [
  {
    test: /^(CustomLists|CustomMaps|ItemDefinitionsGET|RANDOlist|NinjaInfo|GuildBonuses|SigilDesc|ChipDesc|JewelDesc|GodsInfo|LabMainBonus|ArcaneUpg|GrimoireUpg|UpgradeVault|ArmoryUpg|SpelunkUpg|ResGridSquares|MarketExoticInfo|ShrineInfo|TalentDescriptions)/,
    proof: "bench pieces.cjs TABLE_READ",
  },
];
/** Reads that never name a value: the Arena's wave list took a card's per-star value by coincidence. */
export const COINCIDENT_READS: readonly Rule[] = [
  {
    test: /^(CustomLists\.)?RANDOlist\[53\]/,
    proof: "bench pieces.cjs valPath; N.js TalentCalc",
  },
];
/** A bubble's value: its read opens into the bubble with no ⓘ of the bubble's writer (OPUS4-6). */
export const BUBBLE_VALUES: readonly Rule[] = [
  {
    test: /^DNSM\.AlchBubbles\.\w+$/,
    proof: "bench pieces.cjs rowOfTerm OPUS4-6; N.js CauldronStats",
  },
];
/** Whether one of the rules holds for path `p`. */
export const any = (rules: readonly { test: RegExp }[], p: string): boolean =>
  rules.some((r) => r.test.test(p));

/** The read a value equals (the account's state first, a game table only when nothing else has it), or null. */
export function valPath(v: unknown, reads: Reads): string | null {
  const hits = [...reads].filter(
    ([p, x]) =>
      Math.abs(Number(x) - Number(v)) < 1e-9 &&
      !p.endsWith(".length") &&
      !p.includes(" contains ") &&
      !any(COINCIDENT_READS, p),
  );
  const pick =
    hits.find(([p]) => !any(TABLE_READ, p.replace(/^CustomLists\./, ""))) ??
    hits[0];
  return pick ? pick[0] : null;
}
