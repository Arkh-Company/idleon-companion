// A card as a factor of a row not named as the card (audit family 23, the rest; decision of 18/11): the card's level and
// the one constant that multiplies it are a branch with the card's name, "Card level" × "Bonus per level", as in Domeo
// Magmus, when the level is their product with the other rows (FR-008: the row's value still closes). Invented names
// and values.
import { expect, test } from "vitest";
import { formulaLines } from "../../renderer/tree-text.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { fixed, leaf, named, placed } from "./tree-fixture.ts";

const kids = (n: CalcTreeNode | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];
const CARD = 'RunCodeOfTypeXforThingY("CardLv", "w9b")';

test("a card's level times its constant under a row with another name is a branch with the card's name", () => {
  const [up] = placed({}, [
    named("Invented upgrade level", 84, [
      leaf("Invented upgrade", 2, "Stats.upgrade", "level"),
      leaf("Invented Crab", 7, CARD, null),
      fixed("× 6", 6),
    ]),
  ]).rows;
  const [, card] = kids(up);
  expect(kids(up).map((k) => [k.name, k.value])).toEqual([
    ["Invented upgrade", 2],
    ["Invented Crab", 42],
  ]);
  expect(kids(card).map((k) => [k.name, k.value])).toEqual([
    ["Card level", 7],
    ["Bonus per level", 6],
  ]);
  expect(card?.formula && formulaLines(card.formula).names).toBe(
    "Card level × Bonus per level",
  );
});

test("a card's level and a constant in a sum are no product: they stay as they are", () => {
  const [up] = placed({}, [
    named("Invented upgrade level", 15, [
      leaf("Invented upgrade", 2, "Stats.upgrade", "level"),
      leaf("Invented Crab", 7, CARD, null),
      fixed("× 6", 6),
    ]),
  ]).rows;
  expect(kids(up).map((k) => k.name)).not.toContain("Card level");
});
