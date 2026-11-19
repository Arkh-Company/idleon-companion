// The rows a block's steps give (pieces.cjs explainRaw, rowOfTerm, exprRow, stepRef, tidy, dataRows, condRows and
// mergeTests at BASELINE-4), over the invented game's recording: each term of the block's last sum or product is a row.
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { buildTree } from "../tree-build.ts";
import { bootRecorder } from "../tree-record.ts";
import { kidsOf, recordingOf } from "./tree-fixture.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});

const NONE = { recompute: [], builders: [] };
const treeOf = (block: string, args: number[] = [0, 0, 0]) =>
  buildTree(recorder.record(mosaicOf(), [[block, args]], NONE), 0, recorder.ops)
    .root;
/** Each row as [code, value, its rows or "lazy"]. */
const brief = (n: CalcTreeNode): unknown[] => [
  n.code,
  n.value,
  n.kids === "lazy" ? "lazy" : n.kids.map(brief),
];

test("the terms of the block's last sum are its rows; a product of two calls is a branch of both", () => {
  expect(kidsOf(treeOf("TreeSources")).map(brief)).toEqual([
    [
      null,
      48,
      [
        ["TreeReads()", 8, "lazy"],
        ["TreeLoop()", 6, "lazy"],
      ],
    ],
    ["TreeBase", 4, []],
  ]);
});

/** The root's pools, each as [name, value, its rows]: a root of a chain of steps has one per run (spec 009, FR-005). */
const poolsOf = (root: CalcTreeNode): unknown[] =>
  (Array.isArray(root.kids) ? root.kids : []).map((p) => [
    p.name,
    p.value,
    kidsOf(p).map(brief),
  ]);

test("a number of the code is a fixed value named by its place in the step", () => {
  // the earlier step's terms are the chain's first pool (spec 009, rule Y of 17/11)
  const root = treeOf("TreeStepRef");
  const [, value] = kidsOf(Array.isArray(root.kids) ? root.kids[0] : null);
  expect(value).toMatchObject({
    name: "Fixed ×3",
    value: 3,
    leaf: "fixedValue",
    flags: {},
  });
});

test("a value from an earlier step of the block opens into that step, its pool in the chain", () => {
  // TreeBase × 3, then + TreeLevel: the earlier step opens into its terms in the Multi pool (spec 009, rule Y)
  expect(poolsOf(treeOf("TreeStepRef"))).toEqual([
    [
      "Multi pool",
      12,
      [
        ["TreeBase", 4, []],
        [null, 3, []],
      ],
    ],
    ["Additive pool", 25, [["TreeLevel", 25, []]]],
  ]);
});

test("a check on the player's state is a Condition row with its answer, beside the read it tested", () => {
  const rows = kidsOf(treeOf("TreeConditionNo"));
  expect(rows.find((r) => r.leaf === "condition")).toMatchObject({
    value: 0,
    condition: "owned",
    flags: { unnamed: true },
  });
});

test("a yes/no read tested for 1 is one Condition row with the read's path", () => {
  const rows = kidsOf(treeOf("TreeFlag"));
  expect(rows.map((r) => [r.code, r.value, r.leaf])).toEqual([
    ["TreeBase", 4, "unknown"],
    [null, 2, "unknown"],
    ["TreeFlagOn", 1, "condition"],
  ]);
  expect(rows[1]?.why).toBe(
    "a value of a step of the game the recording did not link",
  );
});

test("a number the calling block passed is a fixed value", () => {
  expect(kidsOf(treeOf("TreeArg", [3]))[1]).toMatchObject({
    name: "Value passed by the calling block: 3",
    value: 3,
    leaf: "fixedValue",
  });
});

test("the first argument after the mode is the entry asked of the call", () => {
  expect(kidsOf(treeOf("TreeEntry", [0, 3]))[1]).toMatchObject({
    name: "Entry asked of the call (argument 1)",
    value: 3,
    leaf: "choice",
  });
});

test("a yes/no read is no data row, and a read the step already shows is not shown again", () => {
  expect(kidsOf(treeOf("TreeSearch")).map((r) => [r.code, r.value])).toEqual([
    [null, 1],
    ["TreeBase", 4],
  ]);
});

test("a block whose last step is no sum or product shows the reads of that step", () => {
  expect(kidsOf(treeOf("TreeDecay")).map((r) => [r.code, r.value])).toEqual([
    ["TreeLevel", 25],
  ]);
});

test("a last step that is the index of the table cell the block returns is no formula: the cell is the row", () => {
  expect(kidsOf(treeOf("TreeIndex")).map((r) => [r.code, r.value])).toEqual([
    ["TreeList[2]", 3],
  ]);
});

test("data rows: the last value of a path read twice; no table, length or the block's own result in a cache", () => {
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      {
        b: "Top",
        v: 7,
        c: [2],
        r: [
          ["DNSM.Self.v", 7],
          ["Lv", 1],
          ["CustomLists.T[1]", 5],
          ["List.length", 2],
        ],
        rx: [
          ["Lv", 1, 0],
          ["Lv", 4, 0],
        ],
      },
      { b: "Part", v: 3 },
    ],
    [],
    { root: 0 },
  );
  expect(kidsOf(buildTree(rec, 0).root).map((r) => [r.code, r.value])).toEqual([
    ["Part()", 3],
    ["Lv", 4],
  ]);
});
