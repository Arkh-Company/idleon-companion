// The parts that enter a sum without being a row (spec 010, FR-016, research R6): a curve, a log, the context, a loop
// counter and a read of another character. The lock lets them through; the screen shows them only in the ⓘ.
import { expect, test } from "vitest";
import { NOT_LEAVES, notLeafOf } from "./not-leaves.ts";

test.each([
  ['ArbitraryCode5Inputs("decay",25,100,7)', "curve"],
  // every talent curve mode is a curve, as the decay (T182): the level and the table's numbers are the rows
  ['ArbitraryCode5Inputs("add",1,2,3)', "curve"],
  ['ArbitraryCode5Inputs("intervalAdd",1,5,12)', "curve"],
  ['ArbitraryCode5Inputs("decayMulti",1,100,40)', "curve"],
  ["getLOG(1250)", "log"],
  ["Dungon()", "context"],
  ["CurrentMap", "context"],
  ['GurtBonuzz("x",3)', "loopCounter"],
  ["PlayerDATABASE[4].SkillLevels[328]", "otherCharacter"],
])("%s is a %s", (key, role) => {
  expect(notLeafOf(key, 0)?.role).toBe(role);
});

test.each([
  "GetTalentNumber(1,655)",
  // a mode that is no talent curve stays an ordinary part
  'ArbitraryCode5Inputs("notACurve",1,2,3)',
  "OptionsListAccount[189]",
  "CurrentMapDone",
  "getLOGX(3)",
])("an ordinary part does not match: %s", (key) => {
  expect(notLeafOf(key, 0)).toBe(null);
});

test("a read of the tree's own character is no other character's: it is a part to declare", () => {
  expect(notLeafOf("PlayerDATABASE[4].SkillLevels[328]", 4)).toBe(null);
  expect(notLeafOf("PlayerDATABASE[4].SkillLevels[328]", 3)?.role).toBe(
    "otherCharacter",
  );
  expect(notLeafOf("PlayerDATABASE[14].SkillLevels[328]", 4)?.role).toBe(
    "otherCharacter",
  );
});

test("every entry has a reason, and none is a text of the game", () => {
  for (const n of NOT_LEAVES) {
    expect(n.reason.length).toBeGreaterThan(10);
    const ref = "call" in n.match ? n.match.call : n.match.read;
    expect(ref).toMatch(/^[A-Za-z_$][\w$]*(?:\[\*\])?$/);
    if ("call" in n.match && n.match.mode !== undefined)
      expect(n.match.mode).toMatch(/^\w+$/);
  }
});
