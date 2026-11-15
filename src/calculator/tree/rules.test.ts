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
import { BAN_FLAG, COND_SUBS } from "./conditions.ts";
import { OPEN_XF } from "./once.ts";
import { ARENA_TURN, TURN_NAMES } from "./turn-names.ts";
import { RAW_PASSES } from "./raw-passes.ts";
import { GOLD_FOOD } from "./gold-food.ts";
import {
  CODE_TABLES,
  EARLIER_TOTALS,
  LIST_COUNTS,
  PROGRESS_BY_LABEL,
  WORN_TOTAL,
  WORN_TURN,
} from "./term-passes.ts";
import { GAME_BUGS } from "./game-bugs.ts";
import { COUNT_LEAVES, KIND_PATHS, RULES } from "./kinds.ts";
import { SHAPE_NAMES } from "./names.ts";
import { BRANCH_SHAPES } from "./shapes.ts";
import { TABLE_TEXTS } from "./table-names.ts";
import { RENAMES } from "./renames.ts";
import { CARD_STAR, CONTEXT_READS, LEVEL_RENAMES } from "./level-renames.ts";
import {
  BANNED,
  CODE_LEAVES,
  DUNGEON_GATE,
  FISHING_SPOT,
} from "./leaf-passes.ts";
import {
  ABOVE_RENAMES,
  BUBBLE_FACTOR,
  BUBBLE_SCRATCH,
} from "./above-renames.ts";
import { STATIC_NAMES } from "./names-table.ts";
import { FIX_NAMES } from "./kid-names.ts";
import { SYSTEM_TAGS } from "./tags.ts";
import { PARENT_RENAMES } from "./parent-renames.ts";
import { ONE_OF_EACH } from "./one-of-each.ts";
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
  GOLD_FOOD: [GOLD_FOOD],
  EARLIER_TOTALS,
  WORN_TOTAL: [WORN_TOTAL],
  LIST_COUNTS,
  CODE_TABLES,
  SHAPE_NAMES,
  PROGRESS_BY_LABEL,
  WORN_TURN: [WORN_TURN],
  OPEN_XF: [OPEN_XF],
  TURN_NAMES,
  ARENA_TURN: [ARENA_TURN],
  BAN_FLAG: [BAN_FLAG],
  BRANCH_SHAPES,
  TABLE_TEXTS: Object.values(TABLE_TEXTS),
  RENAMES,
  CONTEXT_READS,
  LEVEL_RENAMES,
  CARD_STAR: [CARD_STAR],
  BUBBLE_SCRATCH,
  BUBBLE_FACTOR,
  ABOVE_RENAMES: [
    ABOVE_RENAMES.riftSkills,
    ...ABOVE_RENAMES.fixed,
    ...ABOVE_RENAMES.earlier,
    ABOVE_RENAMES.spelunk,
  ],
  CODE_LEAVES,
  DUNGEON_GATE: [DUNGEON_GATE],
  BANNED: [BANNED],
  FISHING_SPOT: [FISHING_SPOT],
  FIX_NAMES: Object.values(FIX_NAMES),
  SYSTEM_TAGS,
  PARENT_RENAMES: Object.values(PARENT_RENAMES),
  ONE_OF_EACH: [ONE_OF_EACH],
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

/**
 * The names table's proofs (names-008 rule 10): the export's references joined by "; ", each a block or event of the
 * N.js, the bench's tag, the tables or the paths it read by name; never a quote, an "=" or the game's code.
 */
const NAME_PART =
  /^(?:N\.js [\w@]|bench [\w[]|tables [A-Z]|refs [\w@])[\w.,:@()[\]+\-* ]*$/;
export function isNameReference(proof: unknown): boolean {
  return (
    typeof proof === "string" &&
    proof.length <= 200 &&
    !/_customBlock_|getGameAttribute/.test(proof) &&
    proof.split("; ").every((part) => NAME_PART.test(part))
  );
}

test("every static name has a proof by reference", () => {
  expect(STATIC_NAMES.size).toBeGreaterThan(0);
  const bad = [...STATIC_NAMES].filter(([, n]) => !isNameReference(n.proof));
  expect(bad).toEqual([]);
});

test.each<[string, unknown]>([
  ["no proof", undefined],
  ["a quoted text", 'N.js block Boat, case "Upgrade"'],
  ["an equation", "N.js Boat; refs a = b"],
  ["the game's code", "refs _customBlock_Boat"],
  ["a sentence", "the boat's captain"],
  [
    "a reference followed by a sentence",
    "tables CustomLists.Boats; the captain",
  ],
])("%s is no name reference", (_name, proof) => {
  expect(isNameReference(proof)).toBe(false);
});
