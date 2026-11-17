// The system of a source (spec 009, FR-003, FR-004): the block it calls, or the block that writes the cache it reads,
// gives its system by a rule with proof; an unknown block gives none (the caller files it under "🔹 Other"). The V1
// order is the bench's (build-v1mold.cjs V1). Invented blocks and paths, apart from the game's own block names the
// rules read.
import { expect, test } from "vitest";
import { isNameText } from "./names.ts";
import { SYSTEM_TAGS } from "./tags.ts";
import {
  SYSTEM_ORDER,
  SYSTEM_RULES,
  systemLabel,
  systemOf,
  V1_SYSTEMS,
} from "./systems.ts";

test.each<[string, string | null, string | undefined, string | null]>([
  ["a card's call", "CardBonusREAL(10, 0)", undefined, "🃏 Cards"],
  ["a talent's call", "GetTalentNumber(1, 207)", undefined, "🎯 Talents"],
  [
    "a block known by its mode",
    'Summoning("VotingBonusz", 27)',
    undefined,
    "🗳️ Voting",
  ],
  [
    "a cache read with an Alchemy writer",
    "DNSM.InventedCache",
    'CauldronStats("InventedMode", 0)',
    "⚗️ Alchemy",
  ],
  [
    "a read the bench files by its path",
    "DNSM.AlchBubbles.InventedBubble",
    undefined,
    "⚗️ Alchemy",
  ],
  ["an unknown block", 'InventedBlock("Mode", 0)', undefined, null],
  [
    "a known block in a mode no rule names",
    'Summoning("InventedMode", 0)',
    undefined,
    null,
  ],
  ["a read with no writer", "DNSM.InventedCache", undefined, null],
  [
    "a read whose writer is unknown",
    "DNSM.InventedCache",
    'InventedBlock("Mode")',
    null,
  ],
  ["no code", null, undefined, null],
])("%s", (_name, code, writer, label) => {
  const s = systemOf(code, writer);
  expect(s && systemLabel(s)).toBe(label);
});

test("the order is the V1's, Other last", () => {
  expect(SYSTEM_ORDER).toEqual([
    "LUK / Stats",
    "Talents",
    "Cards",
    "Star Signs",
    "Achievements",
    "Companions",
    "Friends",
    "Stamps",
    "Alchemy",
    "Sigils",
    "Prayers",
    "Shrines",
    "Guild",
    "Arcade",
    "Voting",
    "Post Office",
    "Shiny Pets",
    "Tome",
    "Researching",
    "Chips",
    "Dreams",
    "Cloud Bonus",
    "Owl",
    "Grimoire",
    "Vault",
    "Farming",
    "Holes",
    "Emperor",
    "Legend Talents",
    "Spelunk Shop",
    "Sushi",
    "Minehead",
    "Menagerie",
    "Arcane Map",
    "Glimbo",
    "Equipment",
    "Obols",
    "Gallery",
    "Hatrack",
    "Cape Vine",
    "Golden Food",
    "Set Bonuses",
    "Bundles",
    "Pristine Charms",
    "Sneaking Mastery",
    "Summoning",
    "Royal Guardian",
    "Other",
  ]);
});

test("every system's label is a name the host takes, with its emoji first", () => {
  expect(V1_SYSTEMS.map((s) => s.name)).toEqual(SYSTEM_ORDER);
  for (const s of V1_SYSTEMS) {
    const label = systemLabel(s);
    expect([label, isNameText(label)]).toEqual([`${s.emoji} ${s.name}`, true]);
  }
  expect(V1_SYSTEMS.at(-1)).toEqual({ name: "Other", emoji: "🔹" });
});

test("every system a rule gives is in the V1 list", () => {
  for (const r of SYSTEM_RULES)
    expect([String(r.test), SYSTEM_ORDER.includes(r.system)]).toEqual([
      String(r.test),
      true,
    ]);
});

test("every system a tagged call gives is in the V1 list", () => {
  for (const t of SYSTEM_TAGS)
    expect([String(t.test), SYSTEM_ORDER.includes(t.system)]).toEqual([
      String(t.test),
      true,
    ]);
});
