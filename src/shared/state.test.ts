// The shared shapes of the state; the class of a piece comes from the catalog (reading-catalog-rules.test.ts).
import { expect, test } from "vitest";
import { NUMBER_IDS, VARS_KEYS } from "./state.ts";
import type { StatePath } from "./state.ts";

test("a path has 1, 2 or 3 levels", () => {
  const paths: StatePath[] = [
    ["Cards"],
    ["DNSM", "x"],
    ["PlayerDATABASE", "A", "x"],
  ];
  expect(paths.map((p) => p.length)).toEqual([1, 2, 3]);
});

test("the numbers keep their 11 ids in the order of TARGETS", () => {
  expect(NUMBER_IDS).toEqual([
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
});

test("the closed list of _vars has 27 distinct names", () => {
  expect(new Set(VARS_KEYS).size).toBe(27);
  expect(VARS_KEYS).toHaveLength(27);
});
