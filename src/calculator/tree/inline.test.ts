// No unnamed step inside a source, whatever its math (spec 009, FR-007, FR-018; audit families 7, 11, 14 and 24): a
// branch with no code and no proven name whose expression is not the level's own (1 + x ÷ 100 inside a product, a
// floor, a power) gives its parts to the row above too, and its ⓘ goes inside that row's ⓘ, in brackets, so it closes.
import { expect, test } from "vitest";
import { token } from "./formulas.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { fixed, placed, read } from "./tree-fixture.ts";

/** The call `Call1()` of value `value` under the root, opening into its level. */
const upper = (value: number): Row => ({
  node: row({ pieceKey: "u", value, code: "Call1()", kids: "lazy" }),
  open: 1,
});
/** 1 + Invented.p ÷ 100, a branch named by its shape only, as tree/shapes.ts names it. */
const percent = (p: number, name = "Multiplier"): Row => ({
  node: row({ pieceKey: null, value: 1 + p / 100, code: null, name }),
  open: null,
  group: [
    fixed("Base 1", 1),
    read("Invented.p", p),
    fixed("Percent to number (÷ 100)", 100),
  ],
  xf: [
    `1 + ${token(`c:Invented.p@${String(p)}`, "Invented.p")} ÷ 100`,
    `1 + ${String(p)} ÷ 100 = ${String(1 + p / 100)}`,
  ],
});
const opened = (level: Row[], value: number) => {
  const t = placed({ 1: level }, [upper(value)]);
  const id = t.rows[0]?.id ?? "";
  return { kids: t.open(id), node: t.expand(id) };
};

test("a step 1 + x ÷ 100 inside a product gives its source to the row above, and its math goes to that row's ⓘ", () => {
  const { kids, node } = opened([read("Invented.a", 4), percent(5)], 4.2);
  expect(kids.map((k) => [k.code, k.value])).toEqual([
    ["Invented.a", 4],
    ["Invented.p", 5],
  ]);
  expect(node?.formula).toEqual([
    ["Invented.a", "×", "(", "1", "+", "Invented.p", "÷", "100", ")"],
    [4, 1, 5, 100, 4.2],
  ]);
});

test("two unnamed steps of the same level each give their parts, and the ⓘ still closes", () => {
  const { kids, node } = opened(
    [percent(5, "Game value"), percent(10, "Game value")],
    1.155,
  );
  expect(kids.map((k) => k.code)).toEqual(["Invented.p", "Invented.p"]);
  expect(node?.formula).toEqual([
    [
      ...["(", "1", "+", "Invented.p", "÷", "100", ")", "×"],
      ...["(", "1", "+", "Invented.p", "÷", "100", ")"],
    ],
    [1, 5, 100, 1, 10, 100, 1.155],
  ]);
});

test("a step whose own ⓘ does not close stays a row, with its parts under it", () => {
  const off: Row = { ...percent(5), xf: undefined };
  const { kids } = opened([read("Invented.a", 4), off], 4.2);
  expect(kids.map((k) => [k.name, k.value])).toEqual([
    [expect.any(String), 4],
    ["Multiplier", 1.05],
  ]);
});

test("a step with a proven name holds its row", () => {
  const { kids } = opened(
    [read("Invented.a", 4), percent(5, "Bonus per kill")],
    4.2,
  );
  expect(kids.map((k) => [k.name, k.value])).toEqual([
    [expect.any(String), 4],
    ["Bonus per kill", 1.05],
  ]);
});
