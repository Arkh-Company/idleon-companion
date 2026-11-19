// An account's talent (spec 009, FR-018; audit families 1 and 8; N.js getbonus2(1, talent, -1)): the best of the
// characters' curves, with no "Curve:" row and no curve per character: the talent's ⓘ is the curve of its Talent level,
// whose rows are each character's Points invested (by its number, never its name) and the All-talent levels. Rows
// written by hand, with the shape the recording gives.
import { expect, test } from "vitest";
import { formulaLines } from "../../renderer/tree-text.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { curveRow, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { placed, recNode } from "./tree-fixture.ts";

const lazy = (name: string, value: number, code: string): Row => ({
  node: row({ pieceKey: code, value, code, name, kids: "lazy" }),
  open: 9,
});
const points = (i: number, value: number): Row => {
  const code = `PlayerDATABASE[${String(i)}].SkillLevels[99]`;
  return {
    node: row({
      pieceKey: code,
      value,
      code,
      name: `Character ${String(i + 1)}: Invented talent level`,
      leaf: "investedPoints",
    }),
    open: null,
  };
};
/** The game's curve 2 × L ÷ (L + 200) of one character, at its level L. */
const curve = (level: number): Row => {
  const v = (2 * level) / (level + 200);
  return curveRow(
    ["decay", 2, 200, level],
    {
      pieceKey: `c${String(level)}`,
      code: `ArbitraryCode5Inputs("decay", 2, 200, ${String(level)}, 0, 0)`,
      value: v,
    },
    null,
  );
};
const kidsOf = (n: CalcTreeNode | null | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];

/** The talent 99 of the account, the first of three characters with 409 points, the All-talent levels at 393. */
function account(v: number) {
  const nodes = Array.from({ length: 10 }, (_, i) => recNode(i, "Other"));
  nodes[1] = recNode(1, "getbonus2", { a: [1, 99, -1], v });
  const { rows, expand } = placed(
    {
      1: [
        lazy(
          "All-talent levels",
          393,
          'RunCodeOfTypeXforThingY("AllTalentLVz", "99|0")',
        ),
        curve(802),
        curve(0),
        curve(0),
        points(0, 409),
        points(1, 0),
        points(2, 0),
      ],
    },
    [
      {
        node: row({
          pieceKey: "t",
          value: v,
          code: "getbonus2(1, 99, -1)",
          name: "Invented Talent",
          kids: "lazy",
        }),
        open: 1,
      },
    ],
    nodes,
  );
  return expand(rows[0]?.id ?? "");
}

test("[FR-018] an account's talent is the curve of its Talent level, with no curve row", () => {
  const n = account((2 * 802) / 1002);
  expect(kidsOf(n).map((k) => [k.name, k.value])).toEqual([
    ["Talent level", 802],
    ["Max bonus", 2],
    ["Level at half", 200],
  ]);
  expect(n?.formula && formulaLines(n.formula).names).toBe(
    "Max bonus × Talent level ÷ (Talent level + Level at half)",
  );
});

test("[FR-018] an account's Talent level is the best of its characters' points plus the All-talent levels", () => {
  const level = kidsOf(account((2 * 802) / 1002))[0];
  expect(kidsOf(level).map((k) => [k.name, k.value])).toEqual([
    ["Character 1: Invented talent level", 409],
    ["Character 2: Invented talent level", 0],
    ["Character 3: Invented talent level", 0],
    ["All-talent levels", 393],
  ]);
  expect(level?.formula && formulaLines(level.formula).numbers).toBe(
    "max(409, 0, 0) + 393 = 802",
  );
});

test("[FR-018] an account's talent whose curves do not give its value keeps its rows", () => {
  const n = account(1.9);
  expect(kidsOf(n).map((k) => k.name)).toContain(
    "Character 2: Invented talent level",
  );
});
