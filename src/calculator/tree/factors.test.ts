// Two multipliers a source takes from another system, wherever they are (spec 009, FR-018; audit families 22 and 23):
// - every 1 + vote bonus ÷ 100 is the row "Meritocracy multi", the code's 1 and ÷ 100 in its ⓘ only (spec 009 Open
//   Questions, Vinicius 18/11: the one case outside the mockup where they leave the rows), opening into the vote;
// - a card's level read inside the row with the card's name is "Card level", and the constant that multiplies it is
//   "Bonus per level", as in Domeo Magmus (decision of 18/11).
import { expect, test } from "vitest";
import { formulaLines } from "../../renderer/tree-text.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { fixed, lazy, leaf, named, placed } from "./tree-fixture.ts";

const kids = (n: CalcTreeNode | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];
const VOTE = "All of your Vials give x higher bonuses than normal";

test("[FR-018] a 1 + vote bonus ÷ 100 in any source is the Meritocracy multi, opening into the vote", () => {
  const [vial] = placed({}, [
    named("Invented vial", 12, [
      leaf("Vial bonus", 10, "Stats.vial", "rawBonus"),
      named("Multiplier", 1.2, [
        fixed("Base 1", 1),
        lazy(VOTE, 20, 'Summoning2("MeritocBonusz", 5, 0)'),
        fixed("Percent to number (÷ 100)", 100),
      ]),
    ]),
  ]).rows;
  const [, multi] = kids(vial);
  expect(kids(vial).map((k) => k.name)).toEqual([
    "Vial bonus",
    "Meritocracy multi",
  ]);
  expect(kids(multi).map((k) => k.name)).toEqual([VOTE]);
  expect(multi?.formula && formulaLines(multi.formula).names).toBe(
    `1 + ${VOTE} ÷ 100`,
  );
});

test("[FR-018] a card's level as a factor inside the row with the card's name is its Card level, its constant the Bonus per level", () => {
  const [card] = placed({}, [
    named("Invented Card", 1.35, [
      fixed("Base 1", 1),
      leaf(
        "Invented Card",
        7,
        'RunCodeOfTypeXforThingY("CardLv", "w9a")',
        null,
      ),
      fixed("× 5", 5),
      fixed("Percent to number (÷ 100)", 100),
    ]),
  ]).rows;
  // the code's other constants stay rows (spec 009 Open Questions, Vinicius 18/11)
  expect(kids(card).map((k) => [k.name, k.value])).toEqual([
    ["Base 1", 1],
    ["Card level", 7],
    ["Bonus per level", 5],
    ["Percent to number (÷ 100)", 100],
  ]);
});
