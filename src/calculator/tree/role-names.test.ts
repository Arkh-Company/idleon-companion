// A row never sits inside itself (decision of 18/11; audit family 7, decision of 19/11): the row of a source keeps the
// source's name, and the child that says it again takes its role in the math ("Bonus", "Level"), as in cards and
// talents. The code's constants beside it ("Base 1", "÷ 100") stay rows (spec 009 Open Questions, Vinicius 18/11).
import { expect, test } from "vitest";
import { token } from "./formulas.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { fixed, placed } from "./tree-fixture.ts";

const NAME = "Invented source";
/** The source's row, `Call1()`, opening into its level. */
const source = (value: number): Row => ({
  node: row({
    pieceKey: "u",
    value,
    code: "Call1()",
    name: NAME,
    kids: "lazy",
  }),
  open: 1,
});
const own = (value: number, leaf: "level" | null = null): Row => ({
  node: row({
    pieceKey: "Invented.s",
    value,
    code: "Invented.s",
    name: NAME,
    leaf,
  }),
  open: null,
});
/** The game's 1 + bonus ÷ 100 around the source's own read. */
const xf = (p: number): [string, string] => [
  `1 + ${token(`c:Invented.s@${String(p)}`, "Invented.s")} ÷ 100`,
  `1 + ${String(p)} ÷ 100 = ${String(1 + p / 100)}`,
];
const opened = (level: Row[], value: number, f = xf(5)) => {
  const top = { ...source(value), xf: f };
  const t = placed({ 1: level }, [top]);
  const id = t.rows[0]?.id ?? "";
  return { kids: t.open(id), node: t.expand(id) };
};

test("the child that says the source's name again is its Bonus, in the rows and in the ⓘ", () => {
  const { kids, node } = opened(
    [fixed("Base 1", 1), own(5), fixed("Percent to number (÷ 100)", 100)],
    1.05,
  );
  expect(node?.name).toBe(NAME);
  expect(kids.map((k) => [k.name, k.value, k.code])).toEqual([
    ["Base 1", 1, null],
    ["Bonus", 5, "Invented.s"],
    ["Percent to number (÷ 100)", 100, null],
  ]);
  expect(node?.formula).toEqual([
    ["1", "+", "Bonus", "÷", "100"],
    [1, 5, 100, 1.05],
  ]);
});

test("a level the child that says it again is the Level of", () => {
  const { kids } = opened(
    [
      fixed("Base 1", 1),
      own(5, "level"),
      fixed("Percent to number (÷ 100)", 100),
    ],
    1.05,
  );
  expect(kids.map((k) => [k.name, k.leaf])).toEqual([
    ["Base 1", "fixedValue"],
    ["Level", "level"],
    ["Percent to number (÷ 100)", "fixedValue"],
  ]);
});

test("a 1 with no ÷ 100 beside it is a constant of the code too, and stays a row (FR-018)", () => {
  const { kids } = opened([fixed("Base 1", 1), own(5)], 6, [
    `1 + ${token("c:Invented.s@5", "Invented.s")}`,
    "1 + 5 = 6",
  ]);
  expect(kids.map((k) => [k.name, k.value])).toEqual([
    ["Base 1", 1],
    ["Bonus", 5],
  ]);
});
