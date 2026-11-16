// The name each catalog number shows (spec 008, Open Questions of 16/11, Vinicius's option A): the proven name of its
// root in the names table, else the name the bench's P2 rule gives its call (the mode in words); never the game's raw
// id. The names are kept in number-catalog.json, since the window cannot import the calculator; this test pins them.
import { expect, test } from "vitest";
import { TREE_CATALOG } from "../shared/index.ts";
import { isNameText, SHAPE_NAMES } from "./tree/names.ts";
import { STATIC_NAMES } from "./tree/names-table.ts";
import { TREE_ROOTS } from "./tree-roots.ts";

/** The Stats numbers keep the names of their Stats rows (design.md C9). */
const STATS = new Set([
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
]);

/** Option A: the names table's proven name, else the P2 rule's (the first shape rule that names a call). */
function ruleName(id: string): string | null {
  const [block, args] = TREE_ROOTS[id] ?? ["", []];
  const code = `${block}(${args.map((a) => JSON.stringify(a)).join(", ")})`;
  const known = STATIC_NAMES.get(code);
  if (known) return known.name;
  const rule = SHAPE_NAMES.find((r) => r.test.test(code) && !r.generic);
  return rule?.name(code, [block, [...args]]) ?? null;
}

test("each catalog number has the name of its root by the names table, else by the P2 rule", () => {
  // A root neither names comes with the bench's name (BENCH_NAMES below).
  const wrong = TREE_CATALOG.filter((n) => {
    const rule = ruleName(n.id);
    return !STATS.has(n.id) && rule !== null && n.name !== rule;
  }).map((n) => [n.id, n.name, ruleName(n.id)]);
  expect(wrong).toEqual([]);
});

const TITLE = "bench [F5-ROOT] tree title";
/**
 * The roots neither the names table nor the P2 rule names (Vinicius, 16/11): the bench's tree title (any/pages of
 * BASELINE-4) or, where the bench only has the block, the block in words as the P2 rule writes it. Each with its proof.
 */
const BENCH_NAMES: readonly (readonly [
  id: string,
  name: string,
  proof: string,
])[] = [
  ["playerReach", "Player reach", "P2 in words (block)"],
  ["talentCalc_146", "Apocalypse Chow", TITLE],
  ["talentCalc_616", "Beginner Best Class", TITLE],
  ["talentCalc_620", "Will Of The Eldest", TITLE],
  ["talentCalc_645", "Overaccurate Crit", TITLE],
  ["talentCalc_650", "Rando Event Looty", TITLE],
  ["talentCalc_m2", "Vials and bubbles (all)", TITLE],
  ["talentCalc_m3", "Family bonuses (all)", TITLE],
  ["talentCalc_m4", "Talent bonuses (all)", TITLE],
  ["talentCalc_m6", "All meal bonuses", TITLE],
  ["talentCalc_m7", "Lab bonuses (all)", TITLE],
  ["talentCalc_m9", "Sailing artifacts (all)", TITLE],
  // The bench names both "Drop Rate Multiplier"; the second argument picks the family row's first or second bonus.
  [
    "familyBonsuesREAL_16_0_2019",
    "Drop Rate Multiplier (family bonus 1)",
    `${TITLE}, the argument in words`,
  ],
  [
    "familyBonsuesREAL_16_1_2019",
    "Drop Rate Multiplier (family bonus 2)",
    `${TITLE}, the argument in words`,
  ],
  ["forgeStats_2", "Forge stats 2", "P2 in words (block)"],
  ["forgeStats_5", "Forge stats 5", "P2 in words (block)"],
];

test("the roots no rule names have the bench's names, each with its proof", () => {
  for (const [id, name, proof] of BENCH_NAMES) {
    expect(ruleName(id)).toBe(null);
    expect(TREE_CATALOG.find((n) => n.id === id)?.name).toBe(name);
    expect(proof).not.toBe("");
  }
});

test("no catalog number is left without a name, and each name passes the barrier of names", () => {
  const nameless = TREE_CATALOG.filter((n) => !n.name).map((n) => n.id);
  expect(nameless).toEqual([]);
  for (const { id, name } of TREE_CATALOG) {
    expect(isNameText(name)).toBe(true);
    expect(name).not.toBe(id);
  }
});
