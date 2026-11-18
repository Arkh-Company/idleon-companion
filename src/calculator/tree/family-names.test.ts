// A family bonus by its class (spec 009 T031, decision of 18/11): the game keeps the family bonus of class c under the
// key 2 × c of FamBonusQTYs (N.js TalentCalc -3; the family bonus screen; FamilyBonsuesREAL), so the key k is named by
// ClassFamilyBonuses[k ÷ 2], by the recipes and by the rule alike. The table holds only the cells read, game text.
import { afterEach, expect, test } from "vitest";
import { nameOf, resolveNames, useGameNames } from "./names.ts";
import { NAME_RECIPES } from "./names-table.ts";
import type { NamePart } from "./names-table.ts";
import { useGameTables } from "./table-names.ts";
import { list } from "./state-fixture.ts";

afterEach(() => {
  useGameTables(new Map());
  useGameNames(new Map());
});

const FAMILY = list({
  2: ["+{_TOTAL_LUK", "1", "5", "intervalAdd"],
  16: ["+{%_DROP_RATE|MULTIPLIER", "10", "800", "decay"],
  20: ["+{%_EXP_WHEN_FIGHT|MONSTERS_ACTIVELY", "6", "100", "decay"],
  33: ["{千@HIGHER_BONUSES|FROM_GOLDEN_FOODS", "0.4", "100", "decayMulti"],
});
const TABLES = new Map<string, unknown>([
  ["CustomLists.ClassFamilyBonuses", FAMILY],
]);
/** A part's raw cell in the tables above. */
const cell = (p: NamePart): string | null => {
  const v = p.index.reduce<unknown>(
    (x, k) => (Array.isArray(x) ? (x as unknown[])[Number(k)] : undefined),
    TABLES.get(p.table),
  );
  return typeof v === "string" ? v : null;
};

test.each([
  ["DNSM.FamBonusQTYs[32]", "DROP RATE MULTIPLIER (family bonus)"],
  ["DNSM.FamBonusQTYs[40]", "EXP WHEN FIGHT MONSTERS ACTIVELY (family bonus)"],
  ["DNSM.FamBonusQTYs[4]", "TOTAL LUK (family bonus)"],
  ["DNSM.FamBonusQTYs[66]", "HIGHER BONUSES FROM GOLDEN FOODS (family bonus)"],
])("%s is the family bonus of the class k ÷ 2: %s", (code, name) => {
  useGameTables(TABLES);
  useGameNames(resolveNames(cell, () => true, NAME_RECIPES));
  expect(nameOf(code)).toBe(name);
});
