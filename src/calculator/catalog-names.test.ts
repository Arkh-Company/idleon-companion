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
  // A root neither names comes with the bench's name, checked below like any other.
  const wrong = TREE_CATALOG.filter((n) => {
    const rule = ruleName(n.id);
    return !STATS.has(n.id) && rule !== null && n.name !== rule;
  }).map((n) => [n.id, n.name, ruleName(n.id)]);
  expect(wrong).toEqual([]);
});

/**
 * The roots neither the names table nor the P2 rule names: they wait for the bench's names (Vinicius, 16/11). Any other
 * number without a name fails; the list empties when the bench's names come.
 */
const WAITING_FOR_THE_BENCH = [
  "playerReach",
  "talentCalc_146",
  "talentCalc_616",
  "talentCalc_620",
  "talentCalc_645",
  "talentCalc_650",
  "talentCalc_m2",
  "talentCalc_m3",
  "talentCalc_m4",
  "talentCalc_m6",
  "talentCalc_m7",
  "talentCalc_m9",
  "familyBonsuesREAL_16_0_2019",
  "familyBonsuesREAL_16_1_2019",
  "forgeStats_2",
  "forgeStats_5",
];

test("no catalog number is left without a name, and each name passes the barrier of names", () => {
  const nameless = TREE_CATALOG.filter((n) => n.name === null).map((n) => n.id);
  expect(nameless).toEqual(WAITING_FOR_THE_BENCH);
  for (const { id, name } of TREE_CATALOG) {
    if (name === null) continue;
    expect(isNameText(name)).toBe(true);
    expect(name).not.toBe(id);
  }
});
