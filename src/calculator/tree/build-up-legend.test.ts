// A Legend Talent's max level, the game's own call (spec 009, FR-018, decision of 18/11: "Esses pontos maximos devem ter
// em algum lugar do N.js"): N.js Thingies "LegendTalent_MaxLV" is the table's max (LegendTalents[t][1]), with the
// Research grid bonus (ResearchStuff "Grid_Bonus") and 3 more with the Menagerie's unlock (MenagerieStuff "UnlockOwned")
// where the game adds them; each system it calls is a row. Rows written by hand, with the recording's shapes.
import { expect, test } from "vitest";
import { formulaLines } from "../../renderer/tree-text.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { kidsOf, placed, recNode } from "./tree-fixture.ts";

const lazy = (
  name: string,
  value: number,
  code: string,
  open: number,
): Row => ({
  node: row({ pieceKey: code, value, code, name, kids: "lazy" }),
  open,
});
const MENAGERIE = 'MenagerieStuff("UnlockOwned", 19, 0)';
const GRID = 'ResearchStuff("Grid_Bonus", 130, 1)';

/** The max level of talent `t` opened: the call's value `v`, the table's `base`, and the calls it made, as rows. */
function maxOf(t: number, v: number, base: number, rows: Row[]) {
  const { rows: top, expand } = placed(
    { 1: rows, 2: [], 3: [] },
    [
      lazy(
        "Max points",
        v,
        `Thingies("LegendTalent_MaxLV", ${String(t)}, 0)`,
        1,
      ),
    ],
    [
      recNode(0, "None"),
      recNode(1, "Thingies", {
        a: ["LegendTalent_MaxLV", t, 0],
        v,
        r: [[`CustomLists.LegendTalents[${String(t)}][1]`, String(base)]],
      }),
    ],
  );
  return expand(top[0]?.id ?? "");
}

test("[FR-018] a Legend Talent's max the Menagerie raises: the table's max and the unlock, the game's sum in its ⓘ", () => {
  const n = maxOf(36, 8, 5, [lazy("Menagerie unlock 19", 1, MENAGERIE, 2)]);
  expect(kidsOf(n).map((k) => [k.name, k.value, k.code])).toEqual([
    ["Max points of the table", 5, "CustomLists.LegendTalents[36][1]"],
    ["Menagerie unlock 19", 1, MENAGERIE],
  ]);
  expect(n?.formula && formulaLines(n.formula).names).toBe(
    "Max points of the table + 3 × Menagerie unlock 19",
  );
});

test("[FR-018] a Legend Talent's max a Research grid bonus raises: the grid bonus rounded down", () => {
  const n = maxOf(2, 6, 4, [lazy("Grid bonus 130", 2.5, GRID, 3)]);
  expect(kidsOf(n).map((k) => k.name)).toEqual([
    "Max points of the table",
    "Grid bonus 130",
  ]);
  expect(n?.formula && formulaLines(n.formula).names).toBe(
    "Max points of the table + floor(Grid bonus 130)",
  );
});

test("[FR-018] a max whose parts do not give its value keeps its rows", () => {
  const n = maxOf(36, 9, 5, [lazy("Menagerie unlock 19", 1, MENAGERIE, 2)]);
  expect(kidsOf(n).map((k) => k.name)).toEqual(["Menagerie unlock 19"]);
});
