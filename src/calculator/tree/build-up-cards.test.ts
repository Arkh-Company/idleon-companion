// The cards in the shape of Domeo Magmus (spec 009 T023, FR-018, decision of 18/11): the card's level is the row "Card
// level", the bonus of the card's table is "Bonus per level", read from the card's own row of the table, and the checks
// of the card's stars go to the ⓘ. Rows written by hand, with the shapes the recording gives.
import { expect, test } from "vitest";
import { formulaLines } from "../../renderer/tree-text.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { GEN_INFO } from "./state-words.ts";
import { cond, fixed, kidsOf, placed } from "./tree-fixture.ts";

const lazy = (name: string, open: number, value: number, code: string) => ({
  node: row({ pieceKey: code, value, code, name, kids: "lazy" as const }),
  open,
});
const leaf = (name: string, value: number, code: string, key: string): Row => ({
  node: row({ pieceKey: key, value, code, name, leaf: "fixedValue" }),
  open: null,
});
const branch = (name: string, value: number, group: Row[]): Row => ({
  node: row({ pieceKey: null, value, code: null, name }),
  open: null,
  group,
});
const brief = (kids: readonly CalcTreeNode[]) =>
  kids.map((k) => [k.name, k.value, k.leaf]);
const lines = (n: CalcTreeNode | null | undefined) =>
  n?.formula ? formulaLines(n.formula) : null;
const cardLv = (card: string) => `RunCodeOfTypeXforThingY("CardLv", "${card}")`;

test("[FR-018] an equipped card: its Card level, its Bonus per level from the card's row of the table, its multiplier", () => {
  const { rows } = placed({}, [
    branch("King Doot", 73.5, [
      branch("Multiplier", 1.75, [fixed("Fixed +1", 1), fixed("Bonus", 0.75)]),
      lazy("King Doot", 1, 7, cardLv("babaMummy")),
      leaf(
        "Bonus per star",
        6,
        "DNSM.CardBonusSdl[4]",
        '[8,"DNSM.CardBonusSdl[4]"]',
      ),
    ]),
  ]);
  const [n] = rows;
  // in the game's order of the factors
  expect(brief(kidsOf(n))).toEqual([
    ["Multiplier", 1.75, null],
    ["Card level", 7, null],
    ["Bonus per level", 6, "fixedValue"],
  ]);
  // the card's own row of the table, which the scratch box held while the game added this card: one piece per card
  const table = `${GEN_INFO(6, 312)}[45].babaMummy[4]`;
  expect(kidsOf(n)[2]).toMatchObject({
    code: table,
    pieceKey: JSON.stringify([8, table]),
  });
  expect(lines(n)).toMatchObject({
    names: "Multiplier × Card level × Bonus per level",
    numbers: "1.75 × 7 × 6 = 73.5",
  });
});

test("[FR-018] two cards in one capped sum: each card in the shape of Domeo Magmus, the cap in the ⓘ", () => {
  const { rows, expand } = placed({}, [
    branch("Ancient Golem and Crystal Glunko cards", 70, [
      fixed("× 4", 4),
      lazy("Ancient Golem", 1, 7, cardLv("caveC")),
      fixed("× 6", 6),
      lazy("Crystal Glunko", 2, 7, cardLv("caveD")),
      fixed("Cap 100", 100),
    ]),
  ]);
  const [n] = rows;
  expect(brief(kidsOf(n))).toEqual([
    ["Ancient Golem", 28, null],
    ["Crystal Glunko", 42, null],
  ]);
  expect(lines(n)).toMatchObject({
    names: "min(Ancient Golem + Crystal Glunko, Cap)",
    numbers: "min(28 + 42, 100) = 70",
  });
  const [golem] = kidsOf(n);
  expect(brief(kidsOf(golem))).toEqual([
    ["Card level", 7, null],
    ["Bonus per level", 4, "fixedValue"],
  ]);
  expect(lines(golem)).toMatchObject({
    names: "Bonus per level × Card level",
    numbers: "4 × 7 = 28",
  });
  expect(expand(kidsOf(golem)[0]?.id ?? "")).not.toBeNull();
});

test("[FR-018] the checks of a card's stars are in the ⓘ of its level, never rows", () => {
  const stars = (name: string, yes: boolean): Row => {
    const c = cond(name, yes);
    return { ...c, node: { ...c.node, name } };
  };
  const card: Row = {
    ...lazy("Emperor", 1, 7, cardLv("Boss6A")),
    xf: [
      "1 + min(Stars passed, Base stars + Rift 5th star + Spelunking 6th star)",
      "1 + min(6, 4 + 1 + 1) = 7",
    ],
  };
  const { rows, expand } = placed(
    {
      1: [
        fixed("Base stars", 4),
        stars("Card stars < 7", false),
        stars("Card stars < 6", false),
      ],
    },
    [card],
  );
  const opened = expand(rows[0]?.id ?? "");
  expect(kidsOf(opened).map((k) => k.name)).toEqual(["Base stars"]);
  expect(lines(opened)).toMatchObject({
    names:
      "1 + min(Stars passed, Base stars + Rift 5th star + Spelunking 6th star), at least 7 and 6 by the card lists of the account",
    numbers:
      "1 + min(6, 4 + 1 + 1) = 7 (Card stars < 7: no; Card stars < 6: no)",
  });
});
