// [F3-R1] the root is never a silent leaf (tree-of.cjs at BASELINE-4, bench rule 147): a root whose rows are only reads
// of its step, or that has none, shows that step as its ⓘ with one row per read and per argument it uses. Hand-written
// recordings with invented blocks.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { node as windowNode } from "../../renderer/formula-fixture.ts";
import { instrument } from "../instrument.ts";
import type { RecNode, RecWrite } from "../recording.ts";
import { buildTree } from "../tree-build.ts";
import { kidsOf, recordingOf } from "./tree-fixture.ts";

// ops: Prod 0-2 (s.A × s.B), Pow 3-4 (pow(t, 2)), Two 5-6 (s.A × 2), Mod 7-9 (s.A % s.B), Mix 10-16
// ((s.A + s.B − s.C) ÷ s.D), ModMin 17-21 (min(s.A % s.B, s.C)), ModSub 22-26 (s.A % s.B − s.C)
const { ops } = instrument(
  [
    "Blocks._customBlock_Prod = function () { return s.A * s.B; };",
    "Blocks._customBlock_Pow = function (t) { return Math.pow(t, 2); };",
    "Blocks._customBlock_Two = function () { return s.A * 2; };",
    "Blocks._customBlock_Mod = function () { return s.A % s.B; };",
    "Blocks._customBlock_Mix = function () { return (s.A + s.B - s.C) / s.D; };",
    "Blocks._customBlock_ModMin = function () { return Math.min(s.A % s.B, s.C); };",
    "Blocks._customBlock_ModSub = function () { return s.A % s.B - s.C; };",
  ].join(" "),
);
type Spec = Partial<RecNode> & Pick<RecNode, "b">;
const rootOf = (top: Spec, more: Spec[] = [], writes: RecWrite[] = []) =>
  buildTree(
    recordingOf([{ b: "(root)", c: [1] }, top, ...more], writes, { root: 0 }),
    0,
    ops,
  ).root;
const codes = (n: ReturnType<typeof rootOf>) => kidsOf(n).map((k) => k.code);

/** Block `b` whose step log `x` reads each of `reads` (path, value, place in the log) and returns `v`. */
const block = (
  b: string,
  v: number,
  x: [number, number][],
  reads: [string, number, number][],
  more: Partial<RecNode> = {},
): Spec => ({
  b,
  v,
  x,
  rx: reads,
  r: reads.map(([p, rv]) => [p, rv]),
  ...more,
});
/** Prod of A 3 and B 4, returning `v`. */
const prod = (v = 12, more: Partial<RecNode> = {}) =>
  block(
    "Prod",
    v,
    [
      [1, 3],
      [2, 4],
      [0, 12],
    ],
    [
      ["A", 3, 0],
      ["B", 4, 1],
    ],
    more,
  );

test("a root of only the reads of its step shows them, in its one pool; its ⓘ is its step's (spec 009, FR-005), which the main lets through", () => {
  const root = rootOf(prod());
  // one pool needs no ⓘ of pools: the root keeps its step's
  expect(root.formula).toEqual([
    ["A", "×", "B"],
    [3, 4, 12],
  ]);
  expect(kidsOf(root).map((k) => [k.code, k.value])).toEqual([
    ["A", 3],
    ["B", 4],
  ]);
  // the single multipliers share one Multi pool, and each read's share is of the product (revised on 17/11)
  const pools = Array.isArray(root.kids) ? root.kids : [];
  expect(pools.map((p) => [p.role, p.value])).toEqual([["pool", 12]]);
  expect(kidsOf(root).map((k) => k.shareMode)).toEqual(["product", "product"]);
  expect(checkTree(windowNode({ formula: root.formula }), 1)?.formula).toEqual(
    root.formula,
  );
});

test("each operation of the step is written with its sign", () => {
  const mix = block(
    "Mix",
    3,
    [
      [13, 6],
      [14, 4],
      [12, 10],
      [15, 1],
      [11, 9],
      [16, 3],
      [10, 3],
    ],
    [
      ["A", 6, 0],
      ["B", 4, 1],
      ["C", 1, 3],
      ["D", 3, 5],
    ],
  );
  expect(rootOf(mix).formula).toEqual([
    ["(", "(", "A", "+", "B", ")", "−", "C", ")", "÷", "D"],
    [6, 4, 1, 3, 3],
  ]);
  // the parts weigh through that ⓘ
  expect(kidsOf(rootOf(mix)).map((k) => k.shareMode)).toEqual(
    Array(4).fill("mixed"),
  );
});

test("a root with no row shows each argument its step uses as a choice", () => {
  const pow = (a: number | string) =>
    rootOf({
      b: "Pow",
      a: [a],
      v: 9,
      x: [
        [4, 3],
        [3, 9],
      ],
    });
  expect(pow(3).formula).toEqual([
    ["pow", "(", "Argument 1 of the call", ",", "2", ")"],
    [3, 2, 9],
  ]);
  expect(kidsOf(pow(3)).map((k) => [k.name, k.value, k.leaf, k.why])).toEqual([
    [
      "Argument 1 of the call",
      3,
      "choice",
      "the screen that asks for this number chooses it",
    ],
  ]);
  // a number of the step that is no argument is the code's: no row, and no ⓘ without one
  expect([pow(5).formula, kidsOf(pow(5))]).toEqual([null, []]);
  // a text argument is no number of the step
  expect([pow("3").formula, kidsOf(pow("3"))]).toEqual([null, []]);
});

test("a root with a row that is no read of its step, or that opens, keeps its rows and has no ⓘ of its step: only its pools' (spec 009, FR-005)", () => {
  const two = rootOf(
    block(
      "Two",
      6,
      [
        [6, 3],
        [5, 6],
      ],
      [["A", 3, 0]],
    ),
  );
  // one Multi pool of both factors (revised on 17/11): no ⓘ of pools, and none of the step
  expect([two.formula, codes(two)]).toEqual([null, ["A", null]]);
  const extra = rootOf(
    prod(12, {
      r: [
        ["A", 3],
        ["B", 4],
        ["C", 5],
      ],
    }),
  );
  expect([extra.formula, codes(extra)]).toEqual([null, ["A", "B", "C"]]);
  // B is a cache its writer computed from a read
  const cached = prod(12, {
    rx: [
      ["A", 3, 0],
      ["DNSM.B.v", 4, 1],
    ],
    r: [
      ["A", 3],
      ["DNSM.B.v", 4, 1],
    ],
  });
  const opens = rootOf(
    cached,
    [{ b: "W", v: 4, r: [["Lv", 4]] }],
    [{ path: "DNSM.B.v", node: 2, v: 4, seq: 1, xi: 0 }],
  );
  expect([opens.formula, codes(opens)]).toEqual([null, ["A", "DNSM.B.v"]]);
});

test("a root whose step has another value has no ⓘ", () => {
  expect(rootOf(prod(99)).formula).toBeNull();
});

test("a root whose step has an operation an ⓘ cannot write, at any depth, keeps its rows", () => {
  const reads: [string, number, number][] = [
    ["A", 7, 0],
    ["B", 4, 1],
    ["C", 5, 3],
  ];
  const mod = rootOf(
    block(
      "Mod",
      3,
      [
        [8, 7],
        [9, 4],
        [7, 3],
      ],
      reads.slice(0, 2),
    ),
  );
  expect([mod.formula, codes(mod)]).toEqual([null, ["A", "B"]]);
  const inFn = block(
    "ModMin",
    3,
    [
      [19, 7],
      [20, 4],
      [18, 3],
      [21, 5],
      [17, 3],
    ],
    reads,
  );
  const inOp = block(
    "ModSub",
    -2,
    [
      [24, 7],
      [25, 4],
      [23, 3],
      [26, 5],
      [22, -2],
    ],
    reads,
  );
  for (const b of [inFn, inOp])
    expect([rootOf(b).formula, codes(rootOf(b))]).toEqual([
      null,
      ["A", "B", "C"],
    ]);
});
