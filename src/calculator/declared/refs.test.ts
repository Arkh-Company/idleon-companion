// The references of a blueprint (spec 010, FR-003, research R5 and R12): the key that ties a node to the answer key and
// the recording, the character markers, the piece key of spec 008 and the node's id.
import { expect, test } from "vitest";
import {
  hasRawCharacterIndex,
  isPathRead,
  matchRead,
  nodeId,
  pieceKeyOf,
  refKey,
} from "./refs.ts";

test("a call's key is the block and its arguments in JSON, as the prototype wrote it; text 0 is not number 0", () => {
  expect(refKey({ call: "GetTalentNumber", args: [1, 655] }, 0)).toBe(
    "GetTalentNumber(1,655)",
  );
  expect(refKey({ call: "Block", args: ["0"] }, 0)).not.toBe(
    refKey({ call: "Block", args: [0] }, 0),
  );
  expect(refKey({ call: "TotalStats", args: ["Drop_Rarity", 0, 0] }, 2)).toBe(
    'TotalStats("Drop_Rarity",0,0)',
  );
});

test("a read's key is its path, with the tree's character in place of {character}", () => {
  expect(
    refKey({ read: "PlayerDATABASE[{character}].SkillLevels[328]" }, 3),
  ).toBe("PlayerDATABASE[3].SkillLevels[328]");
  expect(refKey({ read: "OptionsListAccount[189]" }, 3)).toBe(
    "OptionsListAccount[189]",
  );
});

test("* matches the first recorded read of any character and counts the matches; none is null, never 0", () => {
  const recorded = [
    "OptionsListAccount[189]",
    "PlayerDATABASE[2].SkillLevels[328]",
    "PlayerDATABASE[0].SkillLevels[328]",
    "PlayerDATABASE[0].SkillLevels[3280]",
  ];
  expect(matchRead("PlayerDATABASE[*].SkillLevels[328]", recorded, 0)).toEqual({
    path: "PlayerDATABASE[2].SkillLevels[328]",
    matches: 2,
  });
  expect(
    matchRead("PlayerDATABASE[{character}].SkillLevels[328]", recorded, 0),
  ).toEqual({ path: "PlayerDATABASE[0].SkillLevels[328]", matches: 1 });
  expect(matchRead("PlayerDATABASE[*].SkillLevels[9]", recorded, 0)).toBe(null);
  expect(matchRead("OptionsListAccount[18]", recorded, 0)).toBe(null);
});

test("the piece key is spec 008's: [character, block, ...args] of a call, [character, path] of a read", () => {
  expect(pieceKeyOf({ call: "GetTalentNumber", args: [1, 655] }, 4)).toBe(
    JSON.stringify([4, "GetTalentNumber", 1, 655]),
  );
  expect(
    pieceKeyOf({ read: "PlayerDATABASE[{character}].SkillLevels[3]" }, 4),
  ).toBe(JSON.stringify([4, "PlayerDATABASE[4].SkillLevels[3]"]));
});

test("a node's id is the number, the pool, the system and the keys, joined by /", () => {
  expect(
    nodeId("stats-drop-rate", 0, "talents", [
      "boss-battle-spillover",
      "talent-points",
    ]),
  ).toBe("stats-drop-rate/0/talents/boss-battle-spillover/talent-points");
});

test("a character's index written out is raw; the markers are not", () => {
  expect(hasRawCharacterIndex("PlayerDATABASE[1].SkillLevels[3]")).toBe(true);
  expect(
    hasRawCharacterIndex("PlayerDATABASE[{character}].SkillLevels[3]"),
  ).toBe(false);
  expect(hasRawCharacterIndex("PlayerDATABASE[*].SkillLevels[3]")).toBe(false);
  expect(hasRawCharacterIndex("OptionsListAccount[1]")).toBe(false);
});

test("a read is a path of names, dots and indices: no operator, parenthesis, quote or space", () => {
  for (const ok of [
    "OptionsListAccount[189]",
    "DNSM.TotStatMAP.Drop_Rarity",
    "PlayerDATABASE[{character}].SkillLevels[328]",
    "PlayerDATABASE[*].SkillLevels[328]",
    "CompanionBon.b1",
  ])
    expect(isPathRead(ok), ok).toBe(true);
  for (const bad of [
    "A[1]+B[2]",
    "A[1]*2",
    "Math.max(A)",
    'A["x"]',
    "A['x']",
    "A [1]",
    "A[1] ",
    "",
    "A[-1]",
    "A[{other}]",
  ])
    expect(isPathRead(bad), bad).toBe(false);
});
