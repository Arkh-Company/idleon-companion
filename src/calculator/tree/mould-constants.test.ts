// A constant of the game's math in a pool (spec 009, T027, after the probe of the 716 trees): no source, so no system;
// it stays its own row after the groups, and the level still closes. Invented blocks, apart from the game's own block
// names the system rules read.
import { expect, test } from "vitest";
import { bySystem } from "./mould.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { fixed } from "./tree-fixture.ts";

const src = (code: string, value: number): Row => ({
  node: row({ pieceKey: code, value, code }),
  open: null,
});
const card = (v: number, n = 10) => src(`CardBonusREAL(${String(n)}, 0)`, v);
const other = (v: number, n = 1) => src(`InventedBlock(${String(n)})`, v);
const writerOf = () => undefined;
/** A level as [the group's name, or the source's code; its value]. */
const level = (rows: readonly Row[]) =>
  rows.map((r) => [
    r.node.role === "system" ? r.node.name : r.node.code,
    r.node.value,
  ]);

test("a constant of the game's math is never a source of a group: it stays its own row in its pool, after the groups (T027)", () => {
  const rows = [
    card(3),
    fixed("Fixed ×2", 2),
    other(5),
    card(2, 11),
    fixed("Fixed ×6", 6),
    other(7, 2),
  ];
  const out = bySystem(rows, "product", writerOf);
  // a source of no system stands as its row after the groups, before the constants, never in a group "🔹 Other"
  // (Vinicius, 19/11)
  expect(level(out)).toEqual([
    ["🃏 Cards", 6],
    ["InventedBlock(1)", 5],
    ["InventedBlock(2)", 7],
    [null, 2],
    [null, 6],
  ]);
  expect(out.map((r) => r.node.name)).toEqual([
    "🃏 Cards",
    other(5).node.name,
    other(7, 2).node.name,
    "Fixed ×2",
    "Fixed ×6",
  ]);
  // every level multiplies to its parent, and nothing leaves
  expect(out.reduce((p, r) => p * Number(r.node.value), 1)).toBe(
    rows.reduce((p, r) => p * Number(r.node.value), 1),
  );
  // a branch of constants only is a constant too
  const [, k] = bySystem(
    [
      card(3),
      {
        node: row({ pieceKey: null, value: 4, code: null }),
        open: null,
        group: [fixed("× 2", 2), fixed("× 2", 2)],
      },
      card(1, 11),
    ],
    "product",
    writerOf,
  );
  expect([k?.node.role, k?.node.value]).toEqual(["piece", 4]);
  // a constant in % adds a hundredth of its value: it stands as its +N%, its pool's ⓘ dividing it by 100, never in a group
  // "🔹 Other" (Vinicius, 19/11); a named system's lone bonus in % is its group in % (fix tree-shape-091, rule 1)
  const pct = bySystem(
    [
      { ...card(30), percent: true },
      { ...fixed("Fixed +3", 3), percent: true },
      { ...fixed("Fixed +4", 4), percent: true },
    ],
    "sum",
    writerOf,
  );
  expect(
    pct.map((r) => [r.node.name, r.node.combine, r.node.fmt, r.node.value]),
  ).toEqual([
    ["🃏 Cards", "percent", "%", 0.3],
    ["Fixed +3", undefined, "%", 3],
    ["Fixed +4", undefined, "%", 4],
  ]);
  // the card in its group, its name and its value
  expect(pct[0]?.group?.map((k) => [k.node.name, k.node.value])).toEqual([
    [card(30).node.name, 30],
  ]);
});
