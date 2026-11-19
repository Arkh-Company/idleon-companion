// A read of a scratch box opens into the writes up to its own, never into a later write's (spec 009 T023, decision of
// 18/11: a row is never a child of itself). The game's Arcade doubler starts its box at 1, then doubles it twice: read
// at 1, the box opened into the two doublings, and the doubling's own read of the box showed inside itself. The cache's
// opening is driven here directly, over a writer whose turns are written by hand.
import { expect, test } from "vitest";
import { makeCaches } from "./caches.ts";
import { makeCodeFormulas } from "./code-formulas.ts";
import type { Entry } from "./entries.ts";
import { row } from "./rows.ts";
import { num, op, read, termsOf } from "./term-fixture.ts";
import { recNode } from "./tree-fixture.ts";

// Doubler starts the box at 1 (no turn: nothing was computed before it), then each of its two turns doubles it
const nodes = [
  recNode(0, "Doubler", { v: 4, c: [1, 2] }),
  recNode(1, "Twice", { v: 2 }),
  recNode(2, "Twice", { a: [1], v: 4 }),
];
// each turn: box = 2 × box, its step reading the value before it
const turn = (v: number, k: number): Entry => ({
  v,
  s: [{ v, e: op("*", num(2), read("DNSM.Box", v / 2), v) }],
  k: [k],
  r: [],
});
const caches = makeCaches({
  nodes,
  entries: new Map([["0|DNSM.Box", [turn(2, 1), turn(4, 2)]]]),
  writerByValue: () => null,
  steps: () => [],
  explain: (id) => [
    {
      node: row({ pieceKey: `call ${String(id)}`, value: 2, code: "Stats.x" }),
      open: null,
    },
  ],
  linksOf: () => new Map(),
  terms: () => termsOf(),
  finish: (_v, rows) => rows,
  formulas: makeCodeFormulas(nodes, () => []),
});
const rowsAt = (value: number) =>
  caches.opened(
    { path: "DNSM.Box", value, writer: 0, entry: null, opening: [] },
    1,
    new Set(),
  )?.rows ?? [];

test("the value a writer starts its box with opens into none of its later writes", () => {
  expect(rowsAt(1)).toEqual([]);
});

test("a read of an earlier turn opens into the turns up to it; the last value, into every turn", () => {
  const parts = (v: number) => rowsAt(v).map((r) => [r.node.value, r.node.fmt]);
  // the first turn alone: the later doubling is another write's
  expect(parts(2)).not.toContainEqual([2, "x"]);
  expect(parts(2).length).toBeGreaterThan(0);
  expect(parts(4)).toEqual([
    [2, "+"],
    [2, "x"],
  ]);
});
