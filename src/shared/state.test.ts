// The pieces of the state and their classes: a class is only a reading priority, no key is left out (research R2).
import { expect, test } from "vitest";
import { classOf, FORMULA_KEYS, STATE_EXCLUDED, VARS_KEYS } from "./state.ts";
import type { StateClass, StatePath } from "./state.ts";

test.each<[string, StatePath, StateClass]>([
  ["a key the formulas read", ["Cards"], "formula"],
  ["a key the formulas do not read", ["ChestMap"], "other"],
  ["the active character", ["PlayerDATABASE", "A"], "formula"],
  ["another character", ["PlayerDATABASE", "B"], "other"],
  ["the companion bonus", ["DNSM", "CompanionBon"], "formula"],
  ["the shiny bonus", ["DNSM", "ShinyBonusS"], "formula"],
  ["another child of DNSM", ["DNSM", "Other"], "other"],
  ["the _vars", ["_vars"], "formula"],
])("%s has its class", (_name, path, expected) => {
  expect(classOf(path, "A")).toBe(expected);
});

test("with no character, no entry of PlayerDATABASE is the active one", () => {
  expect(classOf(["PlayerDATABASE", "A"], null)).toBe("other");
});

test("no excluded key is a formula key", () => {
  expect(STATE_EXCLUDED.filter((k) => FORMULA_KEYS.has(k))).toEqual([]);
});

test("the closed list of _vars has 27 distinct names", () => {
  expect(new Set(VARS_KEYS).size).toBe(27);
  expect(VARS_KEYS).toHaveLength(27);
});
