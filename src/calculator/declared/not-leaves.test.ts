// The parts that enter a sum without being a row (spec 010, FR-016, research R6): a curve, a log, the context, a loop
// counter and a read of another character. The lock lets them through; the screen shows them only in the ⓘ.
import { expect, test } from "vitest";
import { NOT_LEAVES, notLeafOf } from "./not-leaves.ts";

test.each([
  ['ArbitraryCode5Inputs("decay",25,100,7)', "curve"],
  ["getLOG(1250)", "log"],
  ["Dungon()", "context"],
  ["CurrentMap", "context"],
  ['GurtBonuzz("x",3)', "loopCounter"],
  ["PlayerDATABASE[4].SkillLevels[328]", "otherCharacter"],
])("%s is a %s", (key, role) => {
  expect(notLeafOf(key)?.role).toBe(role);
});

test.each([
  "GetTalentNumber(1,655)",
  'ArbitraryCode5Inputs("add",1,2,3)',
  "OptionsListAccount[189]",
  "CurrentMapDone",
  "getLOGX(3)",
])("an ordinary part does not match: %s", (key) => {
  expect(notLeafOf(key)).toBe(null);
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
