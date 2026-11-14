// Every rule of the assembly carries its proof as a reference, never as the game's text (spec 008, FR-032, T022): each
// part of a proof names the bench's rule or the game's block ("bench pieces.cjs KIND_PATHS deep-7; N.js RoyalG"), with no
// quote in it.
import { expect, test } from "vitest";
import {
  LOOP_ENTRY_CACHES,
  RUN_TOTALS,
  SKILL_RANKS,
  TURN_KINDS,
} from "./loop-parts.ts";
import { COND_SUBS } from "./conditions.ts";
import { RAW_PASSES } from "./raw-passes.ts";
import {
  CODE_TABLES,
  EARLIER_TOTALS,
  LIST_COUNTS,
  WORN_TOTAL,
} from "./term-passes.ts";
import { GAME_BUGS } from "./game-bugs.ts";
import { COUNT_LEAVES, KIND_PATHS, RULES } from "./kinds.ts";
import { GAME_TABLE } from "./steps.ts";
import { BUBBLE_VALUES, COINCIDENT_READS, TABLE_READ } from "./val-path.ts";

const TABLES = {
  COUNT_LEAVES,
  KIND_PATHS,
  RULES,
  COND_SUBS,
  TABLE_READ,
  GAME_TABLE,
  COINCIDENT_READS,
  BUBBLE_VALUES,
  LOOP_ENTRY_CACHES,
  RUN_TOTALS,
  SKILL_RANKS: [SKILL_RANKS],
  TURN_KINDS,
  RAW_PASSES,
  EARLIER_TOTALS,
  WORN_TOTAL: [WORN_TOTAL],
  LIST_COUNTS,
  CODE_TABLES,
};
const QUOTES = /["'`“”‘’]/;
const PART = /^(?:bench [\w.-]+\.cjs|N\.js \w+)(?: [\w .,()+-]+)?$/;

/** True when the proof is one or more references joined by "; ". */
export function isReference(proof: unknown): boolean {
  return (
    typeof proof === "string" &&
    proof.length <= 160 &&
    !QUOTES.test(proof) &&
    proof.split("; ").every((part) => PART.test(part))
  );
}

test.each(Object.entries(TABLES))(
  "every rule of %s has a proof by reference",
  (_name, rules) => {
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules)
      expect([String(r.test), r.proof]).toEqual([
        String(r.test),
        expect.toSatisfy(isReference),
      ]);
  },
);

// Empty while the bench has no audited rule (game-bugs.ts); each one then needs its proof and an id with no free text.
test("every game-bug rule has a proof by reference and an id of one word", () => {
  for (const r of GAME_BUGS)
    expect([r.id, r.proof]).toEqual([
      expect.stringMatching(/^[a-zA-Z]\w*$/),
      expect.toSatisfy(isReference),
    ]);
});

test.each<[string, unknown]>([
  ["no proof", undefined],
  ["an empty proof", ""],
  ["a quoted text of the game", 'N.js Sailing "Total Boat Upgrade LV"'],
  ["a sentence with no reference", "the boat's levels"],
  [
    "a reference followed by a sentence",
    "bench pieces.cjs RULES; the boat levels",
  ],
])("%s is no reference", (_name, proof) => {
  expect(isReference(proof)).toBe(false);
});
