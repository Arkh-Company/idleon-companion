// No "Curve:" row, in any level and under any parent (spec 009, FR-018; audit family 1, decision of 19/11): the curve
// goes to the ⓘ of the row above, and its constants and its level stay rows of that row.
import { expect, test } from "vitest";
import { curveRow, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { placed, read } from "./tree-fixture.ts";

/** 2 × level ÷ (level + 200) at level 50: 0.4. */
const curve = (): Row =>
  curveRow(
    ["decay", 2, 200, 50],
    {
      pieceKey: "c",
      code: 'ArbitraryCode5Inputs("decay", 2, 200, 50)',
      value: 0.4,
    },
    read("Invented.lv", 50),
  );
const upper = (value: number): Row => ({
  node: row({ pieceKey: "u", value, code: "Call1()", kids: "lazy" }),
  open: 1,
});

test("a curve added to a source is no row: its constants and level are rows of the row above, the curve its ⓘ", () => {
  const t = placed({ 1: [read("Invented.a", 10), curve()] }, [upper(10.4)]);
  const id = t.rows[0]?.id ?? "";
  expect(t.open(id).map((k) => [k.name, k.code, k.value])).toEqual([
    [expect.any(String), "Invented.a", 10],
    ["Max bonus of the curve", null, 2],
    ["Level at half of the max", null, 200],
    [expect.any(String), "Invented.lv", 50],
  ]);
  expect(t.expand(id)?.formula).toEqual([
    [
      ...["Invented.a", "+", "(", "2", "×", "Invented.lv", "÷"],
      ...["(", "Invented.lv", "+", "200", ")", ")"],
    ],
    [10, 2, 50, 50, 200, 10.4],
  ]);
});
