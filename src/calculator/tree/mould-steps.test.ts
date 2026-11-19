// No unnamed step directly in a pool, whatever its math (spec 009, FR-007, FR-017; audit families 11, 14 and 24): its
// parts move up into the pool, and its ⓘ goes into the pool's, in brackets, so the pool still closes (FR-008). A pool's
// ⓘ names its rows whole, a name with a colon too.
import { expect, test } from "vitest";
import { poolRows } from "./mould.ts";
import type { Pool } from "./pools.ts";
import { row, withShares } from "./rows.ts";
import type { Row } from "./rows.ts";

const src = (name: string, value: number, n: number): Row => ({
  node: row({
    pieceKey: `p${String(n)}`,
    value,
    code: `InventedBlock(${String(n)})`,
    name,
  }),
  open: null,
});
const level = (v: number, rows: Row[]): Row[] =>
  withShares({ name: "", value: v }, null, rows).rows;
const pool = (
  rows: Row[],
  value: number,
  combine: Pool["combine"] = "sum",
): Pool => ({
  kind: combine === "sum" ? "additive" : "multi",
  name: combine === "sum" ? "Additive pool" : "Multi pool",
  value,
  combine,
  rows: level(value, rows),
});
const first = (p: Pool) =>
  poolRows([p], { name: "Total", value: p.value }, () => undefined).rows[0];

test("a pool's ⓘ names a row with a colon whole", () => {
  const p = first(
    pool([src("Shop: Alpha", 2, 1), src("Shop: Beta", 3, 2)], 5),
  );
  expect(p?.node.formula).toEqual([
    ["Shop: Alpha", "+", "Shop: Beta"],
    [2, 3, 5],
  ]);
});

/** 1 + (Beta + Gamma) ÷ 100, a step with no name but its count. */
const step = (): Row => ({
  node: row({
    pieceKey: null,
    value: 1.3,
    code: null,
    name: "Multiplier from 2 sources",
  }),
  open: null,
  group: [src("Beta", 10, 2), src("Gamma", 20, 3)],
  f: ["1 + (Beta + Gamma) ÷ 100", "1 + (10 + 20) ÷ 100 = 1.3"],
});

test("a step of other math directly in a pool gives the pool its parts and its ⓘ in brackets", () => {
  const p = first(pool([src("Alpha", 2, 1), step()], 2.6, "product"));
  expect((p?.group ?? []).map((r) => r.node.name)).toEqual([
    "Alpha",
    "Beta",
    "Gamma",
  ]);
  expect(p?.node.formula).toEqual([
    [
      ...["Alpha", "×", "(", "1", "+", "(", "Beta", "+", "Gamma"],
      ...[")", "÷", "100", ")"],
    ],
    [2, 1, 10, 20, 100, 2.6],
  ]);
});

test("a step whose ⓘ does not give its value stays in the pool", () => {
  const off = { ...step(), node: { ...step().node, value: 1.5 } };
  const p = first(pool([src("Alpha", 2, 1), off], 3, "product"));
  expect((p?.group ?? []).map((r) => r.node.name)).toEqual([
    "Alpha",
    "Multiplier from 2 sources",
  ]);
});
