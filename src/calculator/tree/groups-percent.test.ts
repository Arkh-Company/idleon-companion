// The groups in % of a pool (spec 009, FR-001, FR-004, FR-006; deferred A34): a system's group in % comes right after
// the system's own group, for the systems beyond the V1 too, in the order of the sum; and when every source is in
// "Other", the % do not force a group: the rows stay as they are, each bonus in % as its +N%. Invented arguments, apart
// from the game's own block names the rules read.
import { expect, test } from "vitest";
import { bySystem } from "./mould.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";

const src = (code: string, value: number, percent = false): Row => ({
  node: row({ pieceKey: code, value, code }),
  open: null,
  ...(percent ? { percent: true as const } : {}),
});
const writerOf = () => undefined;
const level = (rows: readonly Row[]) =>
  rows.map((r) => [
    r.node.role === "system" ? r.node.name : r.node.code,
    r.node.combine ?? null,
  ]);

test("a group in % of a system beyond the V1 comes right after the system's own group", () => {
  const out = bySystem(
    [
      src('Sailing("Invented", 1, 0)', 1),
      src('Sailing("Invented", 2, 0)', 2),
      src('GetBribeBonus("1")', 3),
      src('GetBribeBonus("2")', 4),
      src('Sailing("Invented", 3, 0)', 30, true),
      src('Sailing("Invented", 4, 0)', 40, true),
      src('GetBribeBonus("3")', 50, true),
      src('GetBribeBonus("4")', 60, true),
    ],
    "sum",
    writerOf,
  );
  expect(level(out)).toEqual([
    ["⛵ Sailing", "sum"],
    ["⛵ Sailing", "percent"],
    ["💰 Bribes", "sum"],
    ["💰 Bribes", "percent"],
  ]);
});

test("when every source is in Other, the % force no group: the rows stay, each bonus in % as its +N%", () => {
  const rows = [
    src("InventedBlock(1)", 1),
    src("InventedBlock(2)", 20, true),
    src("InventedBlock(3)", 30, true),
  ];
  const out = bySystem(rows, "sum", writerOf);
  expect(out.map((r) => [r.node.code, r.node.fmt ?? null])).toEqual([
    ["InventedBlock(1)", null],
    ["InventedBlock(2)", "%"],
    ["InventedBlock(3)", "%"],
  ]);
});
