// The systems beyond the V1 and the helper blocks in a pool (spec 009, FR-004, T028, after the probe of the 716 trees):
// a system beyond the V1 comes after the V1's, in the order of the sum, "Other" last; a helper (a curve, a log) takes
// the system of the sources in it, or none. Invented arguments, apart from the game's own block names the rules read.
import { expect, test } from "vitest";
import { bySystem } from "./mould.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";

const src = (code: string, value: number, group?: Row[]): Row => ({
  node: row({ pieceKey: code, value, code }),
  open: null,
  ...(group ? { group } : {}),
});
const writerOf = () => undefined;
const level = (rows: readonly Row[]) =>
  rows.map((r) => [
    r.node.role === "system" ? r.node.name : r.node.code,
    r.node.value,
  ]);

test("a system beyond the V1 comes after the V1's, in the order of the sum, and Other last", () => {
  const out = bySystem(
    [
      src("InventedBlock(1)", 1),
      src('Sailing("Invented", 1, 0)', 2),
      src('GetBribeBonus("1")', 3),
      src("CardBonusREAL(10, 0)", 4),
      src('Sailing("Invented", 2, 0)', 5),
      src('GetBribeBonus("2")', 6),
      src("InventedBlock(2)", 7),
      src("CardBonusREAL(11, 0)", 8),
    ],
    "sum",
    writerOf,
  );
  expect(level(out)).toEqual([
    ["🃏 Cards", 12],
    ["⛵ Sailing", 7],
    ["💰 Bribes", 9],
    ["🔹 Other", 8],
  ]);
});

test("a helper takes the system of the sources in it; with none, it stands as its own row after the groups", () => {
  const out = bySystem(
    [
      src("CardBonusREAL(10, 0)", 4),
      src('ArbitraryCode5Inputs("decay", 10, 100, 101, 0, 0)', 5, [
        src("CardBonusREAL(12, 0)", 101),
      ]),
      src('ArbitraryCode5Inputs("add", 1, 0, 101, 0, 0)', 3),
      src("InventedBlock(1)", 1),
      src("InventedBlock(2)", 2),
    ],
    "sum",
    writerOf,
  );
  expect(level(out)).toEqual([
    ["🃏 Cards", 9],
    ["🔹 Other", 3],
    ['ArbitraryCode5Inputs("add", 1, 0, 101, 0, 0)', 3],
  ]);
});

test("a talent multiplied by a count goes to the talent's system (009 T029, decision of 18/11)", () => {
  const times = (value: number, group: Row[]): Row => ({
    node: row({ pieceKey: null, value, code: null }),
    open: null,
    group,
    op: "*",
  });
  const out = bySystem(
    [
      src("GetTalentNumber(1, 207)", 4),
      times(62.5, [
        src("GetTalentNumber(1, 655)", 12.5),
        src("OptionsListAccount[189]", 5),
      ]),
      times(0, [
        src("GetTalentNumber(1, 239)", 0),
        src('RoyalG("TotalStatz", 0, 0)', 4044),
      ]),
      src("InventedBlock(1)", 1),
      src("InventedBlock(2)", 2),
    ],
    "sum",
    writerOf,
  );
  expect(level(out)).toEqual([
    ["🎯 Talents", 66.5],
    ["🔹 Other", 3],
  ]);
});
