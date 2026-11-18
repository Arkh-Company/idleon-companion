// The data rows of a block (spec 008 T022; spec 009 FR-018, decision of 18/11: every value a system feeds shows that
// system as its child). A game cache that a step of the block reads, when that step does not open into rows, is a row
// too, unless the block wrote it itself: N.js RunCodeOfTypeXforThingY "AllTalentLV" adds the family bonus 68
// (DNSM.FamBonusQTYs[68], which TalentCalc fills) inside a floor(min(…)), and writes its own working values.
import { expect, test } from "vitest";
import { dataRows } from "./data-rows.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr } from "./steps.ts";
import { recNode } from "./tree-fixture.ts";

const readRow = (path: string, value: number): Row => ({
  node: row({ pieceKey: path, value, code: path }),
  open: null,
});
const read = (p: string, v: number): Expr => ({ t: "read", p, v });

const ALL_TAL = recNode(0, "RunCodeOfTypeXforThingY", {
  a: ["AllTalentLV", "99"],
  v: 268,
  r: [
    ["DNSM.FamBonusQTYs[68]", 16.8],
    ["DNSM.AllTalMaxCapFR", 9999],
    ["Dream[12]", 68],
  ],
});
const STEPS = [
  read("DNSM.FamBonusQTYs[68]", 16.8),
  read("DNSM.AllTalMaxCapFR", 9999),
  read("Dream[12]", 68),
];

test("[FR-018] a cache a step that does not open reads is a row, beside the state it reads; one the block wrote is not", () => {
  const rows = dataRows(
    ALL_TAL,
    [],
    STEPS,
    true,
    readRow,
    new Map(),
    () => false,
    new Set(["DNSM.AllTalMaxCapFR"]),
  );
  expect(rows.map((r) => r.node.code)).toEqual([
    "DNSM.FamBonusQTYs[68]",
    "Dream[12]",
  ]);
});

test("a cache of a step that opens into rows stays out, as the step shows it", () => {
  const rows = dataRows(
    ALL_TAL,
    [],
    STEPS,
    false,
    readRow,
    new Map(),
    () => false,
    new Set(),
  );
  expect(rows.map((r) => r.node.code)).toEqual([]);
});
