// The type of a leaf, rule by rule in the bench's order (spec 008, T017, FR-013; pieces.cjs `classify`): the slot's
// path first, then the rules on the code, then the same rules on the name. Every path and name here is invented or a
// path the rule names; no text of the game.
import { expect, test } from "vitest";
import { classify } from "./kinds.ts";

const of = (
  code: string | null,
  name = "Game value",
  why: string | null = null,
) => classify({ name, code, why });

test.each<[string, string | null, string, string, string | null]>([
  [
    "a count the N.js proves, before anything",
    "Holes[9][2]",
    "Game value",
    "quantity",
    null,
  ],
  [
    "a path rule before a word of the name",
    "OptionsListAccount[232]",
    "Masteries completed",
    "quantity",
    null,
  ],
  [
    "a path rule with its subtype",
    "AchieveReg[3]",
    "Game value",
    "condition",
    "done",
  ],
  [
    "the Sailing rules before the others",
    "Research[9][2]",
    "Game value",
    "quantity",
    null,
  ],
  ["a rule on the code", "StampLevel[0][1]", "Game value", "level", null],
  [
    "the code before the name",
    "CustomLists.Invented[1]",
    "Invented level",
    "fixedValue",
    null,
  ],
  [
    "a rule on the name when the code says nothing",
    "Invented[1]",
    "Golden thing level",
    "level",
    null,
  ],
  [
    "a name rule with its subtype",
    null,
    "Invented gem connected",
    "condition",
    "active",
  ],
  [
    "a raw bonus by its name",
    null,
    "Invented source (sign 14)",
    "rawBonus",
    null,
  ],
  [
    "a fixed value by its name",
    "Invented[1]",
    "Fixed value",
    "fixedValue",
    null,
  ],
  [
    "owned by its name, before the code",
    "StampLevel[0][1]",
    "Owned",
    "condition",
    "owned",
  ],
  [
    "a path rule before a rule on the code",
    "RoyalG[3][2]",
    "Game value",
    "choice",
    null,
  ],
  [
    "a call with no parts of its own",
    'InventedBlock("sub", 0)',
    "Game value",
    "rawBonus",
    null,
  ],
])("%s", (_name, code, name, leaf, condition) => {
  expect(of(code, name)).toMatchObject({ leaf, condition });
});

test.each<[string, string | null, string, string]>([
  [
    "a step value the recording did not link",
    null,
    "Value from an earlier step",
    "a value of a step of the game the recording did not link",
  ],
  ["a loop turn with no name", null, "Part 3", "a loop turn with no name"],
  [
    "a sum written with numbers",
    null,
    "4 × 2",
    "a sum written with numbers: the level is not told apart from the constants yet",
  ],
  [
    "a cache that comes ready",
    "DNSM.Invented.v",
    "Game value",
    "a cache that comes ready from the game",
  ],
  [
    "nothing that proves it",
    "Invented[1]",
    "Game value",
    "nothing proves what this is yet",
  ],
])("%s is unknown, with the reason", (_name, code, name, why) => {
  expect(of(code, name)).toEqual({ leaf: "unknown", condition: null, why });
});

test("a leaf already proved to be a loop's progress keeps its reason", () => {
  const why = "progress of the invented loop";
  expect(of("StampLevel[0][1]", "Game value", why)).toEqual({
    leaf: "unknown",
    condition: null,
    why,
  });
});
