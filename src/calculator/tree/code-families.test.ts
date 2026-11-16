// The ⓘ of the families whose rows the bench writes by hand (spec 008, T017: pieces.cjs familyFormula), over calls
// written by hand with invented blocks, each one also on its way to the window.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { node as windowNode } from "../../renderer/formula-fixture.ts";
import { formulaLines } from "../../renderer/tree-text.ts";
import type { RecNode } from "../recording.ts";
import { formulaFor, withFormula } from "./formulas.ts";
import type { Pair } from "./formulas.ts";
import {
  at,
  callOf,
  recNode as node,
  read as readRow,
} from "./tree-fixture.ts";

/** A row's ⓘ from the code on its way to the window (its parts found, the main's check, "How it adds up"): its two lines. */
function expectShown(pair: Pair | null): void {
  if (!pair) return;
  const r = at(1, { xf: pair });
  const kids = [readRow("Stats.other", 123456)];
  const tree = checkTree(
    windowNode({ formula: withFormula(r, kids).formula }),
    1,
  );
  const shown = tree?.formula ? formulaLines(tree.formula) : null;
  expect(shown && [shown.names, shown.numbers]).toEqual(formulaFor(r, kids));
}

test.each<[string, RecNode[], [string, string] | null]>([
  [
    "a talent's curve, in a dungeon",
    [
      node(0, "GetTalentNumber", { v: 5, c: [1] }),
      node(1, "ArbitraryCode5Inputs", { a: ["bigBase", 0, 0.1, 50], v: 5 }),
    ],
    ["0 + 0.1 × 50 (in a dungeon)", "0 + 0.1 × 50 = 5"],
  ],
  [
    "a talent with no points",
    [node(0, "GetTalentNumber", { v: 0 })],
    ["0 while Points in the talent ≤ 0", "0 points → 0"],
  ],
  ["a talent with no curve kept", [node(0, "GetTalentNumber", { v: 3 })], null],
  [
    "a stamp type no stamp has",
    [node(0, "StampBonusOfTypeX", { a: ["Food"], v: 0 })],
    ["0: no stamp description has the type Food", "no stamp of this type → 0"],
  ],
  [
    "a stamp type with a value and no stamp read",
    [node(0, "StampBonusOfTypeX", { a: ["Food"], v: 3 })],
    null,
  ],
  [
    "a stamp type with a stamp read",
    [
      node(0, "StampBonusOfTypeX", {
        a: ["Food"],
        v: 0,
        r: [["StampLevel[1][2]", 0]],
      }),
    ],
    null,
  ],
  [
    "the Rift's fifth star",
    [node(0, "RiftStuff", { a: ["5starCards"], v: 1, r: [["Rift[0]", 50]] })],
    ["1 when the Rift level ≥ 45, else 0", "Rift level 50 → 1"],
  ],
  [
    "the Rift's fifth star, no level read",
    [node(0, "RiftStuff", { a: ["5starCards"], v: 0 })],
    ["1 when the Rift level ≥ 45, else 0", "Rift level → 0"],
  ],
  [
    "a buff's talent",
    [
      node(0, "GetBuffBonuses", { a: [12, 3], v: 7, c: [1] }),
      node(1, "GetTalentNumber", { v: 7 }),
    ],
    [
      "The talent's value while buff 12 is on (0 when it is off)",
      "buff on → 7",
    ],
  ],
  [
    "a buff whose talent has another value",
    [
      node(0, "GetBuffBonuses", { a: [12, 3], v: 7, c: [1] }),
      node(1, "GetTalentNumber", { v: 5 }),
    ],
    null,
  ],
  [
    "a buff the game counts apart",
    [
      node(0, "GetBuffBonuses", { a: [615, 3], v: 7, c: [1] }),
      node(1, "GetTalentNumber", { v: 7 }),
    ],
    null,
  ],
  [
    "a talent banned from the all-talent levels",
    [
      node(0, "RunCodeOfTypeXforThingY", {
        a: ["AllTalentLV", 3],
        v: 0,
        c: [1],
      }),
      node(1, "RunCodeOfTypeXforThingY", {
        a: ["TalentBannedforAllLV", 3],
        v: 1,
      }),
    ],
    ["0: this talent is banned from the All-talent levels", "banned → 0"],
  ],
  [
    "a talent not banned from the all-talent levels",
    [
      node(0, "RunCodeOfTypeXforThingY", {
        a: ["AllTalentLV", 3],
        v: 0,
        c: [1],
      }),
      node(1, "RunCodeOfTypeXforThingY", {
        a: ["TalentBannedforAllLV", 3],
        v: 0,
      }),
    ],
    ["0 while Points in the talent ≤ 0.5", "0 points → 0"],
  ],
  [
    "a talent with all-talent levels",
    [node(0, "RunCodeOfTypeXforThingY", { a: ["AllTalentLV", 3], v: 4 })],
    null,
  ],
  [
    "a talent with no all-talent points",
    [node(0, "RunCodeOfTypeXforThingY", { a: ["AllTalentLVz", 3], v: 0 })],
    ["0 while Points in the talent ≤ 0.5", "0 points → 0"],
  ],
  [
    "a prayer in no slot",
    [
      node(0, "prayersReal", {
        a: [4, 0],
        v: 0,
        r: [
          ["PrayersActive[0]", 1],
          ["PrayersActive[1]", -1],
        ],
      }),
    ],
    ["0 while this prayer is in no prayer slot", "slots: 1 → 0"],
  ],
  [
    "a prayer at 0 with no slot read",
    [node(0, "prayersReal", { a: [4, 0], v: 0 })],
    null,
  ],
  [
    "a prayer in a slot",
    [node(0, "prayersReal", { a: [1, 0], v: 0, r: [["PrayersActive[0]", 1]] })],
    null,
  ],
  [
    "the best character's bonus",
    [
      node(0, "getbonus2", { v: 6, c: [1, 2] }),
      node(1, "ArbitraryCode5Inputs", { v: 6 }),
      node(2, "ArbitraryCode5Inputs", { v: 2 }),
    ],
    [
      "max(the bonus of each character: the talent's curve of its level)",
      "max(6, 2) = 6",
    ],
  ],
  [
    "characters' bonuses whose best is not the value",
    [
      node(0, "getbonus2", { v: 5, c: [1, 2] }),
      node(1, "ArbitraryCode5Inputs", { v: 6 }),
      node(2, "ArbitraryCode5Inputs", { v: 2 }),
    ],
    null,
  ],
  [
    "one character's bonus",
    [
      node(0, "getbonus2", { v: 6, c: [1] }),
      node(1, "ArbitraryCode5Inputs", { v: 6 }),
    ],
    null,
  ],
  [
    "a card's level",
    [
      node(0, "RunCodeOfTypeXforThingY", {
        a: ["CardLv", "x"],
        v: 5,
        c: [1, 2],
      }),
      node(1, "RiftStuff", { v: 1 }),
      node(2, "Spelunk", { v: 0 }),
    ],
    [
      "1 + min(Stars passed, Base stars + Rift 5th star + Spelunking 6th star)",
      "1 + min(4, 4 + 1 + 0) = 5",
    ],
  ],
  [
    "a card not collected",
    [node(0, "RunCodeOfTypeXforThingY", { a: ["CardLv", "x"], v: 0 })],
    ["0 while no card is collected", "0 cards → 0"],
  ],
  [
    "a card forced by the account's list",
    [node(0, "RunCodeOfTypeXforThingY", { a: ["CardLv", "x"], v: 7 })],
    ["Forced to 7 by the card list of the account", "→ 7"],
  ],
])("the family of %s", (_name, nodes, formula) => {
  expect(callOf(nodes)).toEqual(formula);
  expectShown(formula);
});
