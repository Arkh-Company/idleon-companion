// Each place that passes the filter of a row that says nothing: a row that only repeats its block (pieces.cjs `tidy`,
// its `parent`) in a cache's step, in a loop's factor and in the root's own step ([F2-TOP]); and the lone call of a
// cache's step (pieces.cjs `cacheStepRows`). The recordings and steps are written by hand, with invented blocks; a
// name from the names table is taken from the table itself.
import { expect, test } from "vitest";
import { instrument } from "../instrument.ts";
import { buildTree } from "../tree-build.ts";
import { makeCaches } from "./caches.ts";
import { makeCodeFormulas } from "./code-formulas.ts";
import { NAMES_BY_LABEL } from "./names.ts";
import { finish } from "./rows.ts";
import type { Step } from "./steps.ts";
import { PROGRESS_BY_LABEL } from "./term-passes.ts";
import { call, nodes, op, read, termsOf } from "./term-fixture.ts";
import { brief, kidsOf, openPath, recordingOf } from "./tree-fixture.ts";

test("a cache's step drops the row that only repeats its writer (terms.ts rowsAt, the block as the parent)", () => {
  // the writer is Invented("SomeMode") of 3; its step adds a read and a call of the same name and value
  const writer = nodes[4];
  if (!writer) throw new Error("no node");
  const e = op("+", read("Stats.a", 2), call(4, 3), 5);
  const { rows } = termsOf(writer).rowsAt(
    { args: [], steps: [{ v: 5, e }], at: 0 },
    e,
    new Map(),
  );
  expect(rows.map((r) => r.node.code)).toEqual(["Stats.a"]);
});

test("a loop's factor drops the row that only repeats its writer (caches.ts entryRows, the writer as the parent)", () => {
  // ops: 0 is t + s.A, 1 and 2 its leaves, 3 is t * the call, 4 and 5 its leaves
  const { ops } = instrument(
    'Blocks._customBlock_W = function () { t = t + s.A; t = t * Blocks._customBlock_Invented("SomeMode", 0, 0); };',
  );
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Top", v: 1, r: [["DNSM.Acc.v", 6, 3]] },
      {
        b: "Invented",
        a: ["SomeMode", 0, 0],
        v: 2,
        c: [3],
        x: [
          [1, 0],
          [2, 1],
          [0, 1],
          [1, 1],
          [2, 2],
          [0, 3],
          [4, 3],
          [5, 2],
          [3, 6],
        ],
        rx: [
          ["A", 1, 1],
          ["A", 2, 4],
        ],
      },
      { b: "Invented", a: ["SomeMode", 0, 0], v: 2, pxi: 7 },
    ],
    [1, 3, 6].map((v, i) => ({
      path: "DNSM.Acc.v",
      node: 2,
      v,
      seq: i + 1,
      xi: 3 * (i + 1),
    })),
    { root: 0 },
  );
  const factor = kidsOf(openPath(buildTree(rec, 0, ops), "DNSM.Acc.v")).at(-1);
  expect([factor?.name, factor?.value, brief(factor)]).toEqual([
    "Multiplier",
    2,
    [],
  ]);
});

test("[F2-TOP] the root's own step drops the row that only repeats the root's call (tree-build.ts, the call as the parent)", () => {
  // a read the names table names by its label, and a block whose mode in words is that same name
  const labels = new Set(PROGRESS_BY_LABEL.map((p) => p.label));
  const [label, name] = NAMES_BY_LABEL.find(
    ([l, n]) => !labels.has(l) && /^[A-Z][a-z ]+$/.test(n),
  ) ?? ["", ""];
  const path = `DNSM.${label}`;
  const { ops } = instrument(
    "Blocks._customBlock_X = function () { return Math.max(s.A, 0); };",
  );
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      {
        b: "X",
        a: [name.replace(/ /g, "_")],
        v: 5,
        r: [[path, 5]],
        rx: [[path, 5, 0]],
        x: [
          [1, 5],
          [0, 5],
        ],
      },
    ],
    [],
    { root: 0 },
  );
  expect(label).not.toBe("");
  expect(brief(buildTree(rec, 0, ops).root)).toEqual([[null, 0]]);
});

/** A cache of 3 that writer Top (of 9) made in its one step, a call of B with no name and nothing under it. */
function loneCallCache(seen: ReadonlySet<number>) {
  const [top, b] = nodes;
  const steps: Step[] = [{ v: 3, e: call(1, 3) }];
  const caches = makeCaches({
    nodes,
    entries: new Map(),
    writerByValue: () => null,
    steps: (id) => (id === top?.id ? steps : []),
    explain: () => [],
    linksOf: () => new Map(),
    terms: (w) => termsOf(w),
    finish,
    formulas: makeCodeFormulas(nodes, () => []),
  });
  expect([top?.v, b?.v]).toEqual([9, 3]);
  return caches.opened(
    { path: "DNSM.Lone.v", value: 3, writer: 0, entry: null, opening: [] },
    0,
    seen,
  )?.rows;
}

test("pieces.cjs cacheStepRows: a cache's lone call that says nothing leaves, read anywhere or inside its writer", () => {
  expect(loneCallCache(new Set())).toEqual([]);
  expect(loneCallCache(new Set([0]))).toEqual([]);
});
