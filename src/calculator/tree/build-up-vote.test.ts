// A Meritocracy vote's bonus (spec 009, FR-018, decision of 18/11: every value a system feeds shows that system as its
// child, even at 0). N.js Summoning2 "MeritocBonusz": while the vote t is the week's, the table's bonus of the vote
// (NinjaInfo[41][1 + 3t]) × the Meritocracy bonus multiplier (Summoning "MeritocBonuszMulti"), else 0; the recording
// keeps the multiplier as a call of its own. Rows written by hand, the table with the game's text.
import { afterEach, expect, test } from "vitest";
import { formulaLines } from "../../renderer/tree-text.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { list } from "./state-fixture.ts";
import { useGameTables } from "./table-names.ts";
import { cond, placed, recNode } from "./tree-fixture.ts";

afterEach(() => {
  useGameTables(new Map());
});

const kidsOf = (n: CalcTreeNode | null | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];
const lazy = (
  name: string,
  open: number,
  value: number,
  code: string,
): Row => ({
  node: row({ pieceKey: code, value, code, name, kids: "lazy" }),
  open,
});
const NODES = [
  recNode(0, "Summoning2", { a: ["MeritocBonusz", 21, 0], v: 0 }),
  recNode(1, "Summoning", { a: ["MeritocBonuszMulti", 0, 0], v: 1.85 }),
];
const week = (vote: number): Row[] => [
  {
    ...cond("Meritocracy vote of the week", true, "OptionsListAccount[453]"),
    node: {
      ...cond("", true).node,
      name: "Meritocracy vote of the week",
      code: "OptionsListAccount[453]",
      value: vote,
    },
  },
  {
    ...cond("Meritocracy vote of the week = 21", false),
    node: {
      ...cond("", false).node,
      name: "Meritocracy vote of the week = 21",
    },
  },
];
const TABLES = new Map<string, unknown>([
  [
    "CustomLists.NinjaInfo",
    list({
      41: list({
        63: "All_of_your_Sigils_give_}x_higher_bonuses_than_normal",
        64: "40",
        65: "0",
      }),
    }),
  ],
]);

test("[FR-018] a vote that is not the week's shows the vote's bonus and the Meritocracy multiplier, its ⓘ why it is 0", () => {
  useGameTables(TABLES);
  const { rows, expand } = placed(
    { 0: week(1), 1: [] },
    [
      lazy(
        "All of your Sigils give x higher bonuses than normal",
        0,
        0,
        'Summoning2("MeritocBonusz", 21, 0)',
      ),
    ],
    NODES,
  );
  const n = expand(rows[0]?.id ?? "");
  expect(kidsOf(n).map((k) => [k.name, k.value, k.code])).toEqual([
    ["Vote bonus", 40, "CustomLists.NinjaInfo[41][64]"],
    [
      "Meritocracy bonus multiplier",
      1.85,
      'Summoning("MeritocBonuszMulti", 0, 0)',
    ],
    ["Meritocracy vote of the week", 1, "OptionsListAccount[453]"],
  ]);
  expect(kidsOf(n)[1]?.kids).toBe("lazy");
  expect(n?.formula && formulaLines(n.formula)).toMatchObject({
    names:
      "Vote bonus × Meritocracy bonus multiplier while the vote of the week is 21, else 0",
    numbers: "the vote of the week is 1 → 0",
  });
});

test("a vote with no Meritocracy multiplier in the recording keeps its rows", () => {
  useGameTables(TABLES);
  const { rows, expand } = placed(
    { 0: week(1) },
    [
      lazy(
        "All of your Sigils give x higher bonuses than normal",
        0,
        0,
        'Summoning2("MeritocBonusz", 21, 0)',
      ),
    ],
    [NODES[0] ?? recNode(0, "None")],
  );
  expect(kidsOf(expand(rows[0]?.id ?? "")).map((k) => k.name)).toEqual([
    "Meritocracy vote of the week",
    "Meritocracy vote of the week = 21",
  ]);
});
