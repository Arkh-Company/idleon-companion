// The general top layer of the answer key (spec 010, T151, T154; spec, Open Questions 21 and 22/11): a condition with
// its two paths outside the return, both paths; a division with any numerator, each factor of the divisor a ➗ line; a
// Cap or a Floor whose limit is no constant, nested ones a layer each; a curve (pow) as a term, never a pool of its own.
// Over the invented game (fake-game.js).
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import { bootRecorder } from "../tree-record.ts";
import { answerKey } from "./answer-key.ts";
import type { AnswerKey } from "./answer-key.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});

function keyOf(block: string, attrs: object = {}): AnswerKey {
  const rec = recorder.record(mosaicOf(attrs), [[block, [0, 0, 0]]], {
    recompute: [],
    builders: [],
  });
  const key = answerKey(rec, recorder.ops);
  if ("error" in key) throw new Error(`${block}: ${key.reason}`);
  return key;
}
const layers = (key: AnswerKey) =>
  key.top.map((l) => [l.kind, l.value ?? null, l.before, l.after]);
const pools = (ps: AnswerKey["pools"]) =>
  ps.map((p) => [p.kind, p.terms.map((t) => [t.ref, t.weight])]);

test("T151, the path yes too: x = cond ? a : b opens the path that ran, and the condition is a layer", () => {
  for (const block of ["TreeGateVar", "TreeGateInline"]) {
    const key = keyOf(block, { TreeOwned: 1 });
    // TreeBase + 1 = 5, × TreeTwins[0] 3
    expect(key.final, block).toBe(15);
    expect(layers(key), block).toEqual([["cond", 1, 5, 5]]);
    expect(pools(key.pools), block).toEqual([
      [
        "additive",
        [
          ["TreeBase", 1],
          ["1", 1],
        ],
      ],
      ["multi", [["TreeTwins[0]", 1]]],
    ]);
  }
});

test("T151: a step of a running total written as a condition stays a chain", () => {
  const key = keyOf("TreeGateChain");
  expect(key.form).toBe("chain");
  expect(key.pools.map((p) => p.kind)).toEqual(["additive", "multi"]);
});

test("A ÷ B with any numerator: the numerator's pools, and each factor of B a ➗ line with its sources", () => {
  const key = keyOf("TreeDivAny");
  // (TreeCapped − TreeReads()) ÷ ((1 + TreeStats.b / 100) × TreeLoop()) = 72 ÷ 6.3
  expect(key.final).toBeCloseTo(72 / 6.3, 12);
  expect(key.top.map((l) => [l.kind, l.value ?? null, l.after])).toEqual([
    ["div", null, key.final],
  ]);
  expect(key.top[0]?.before).toBeCloseTo(6.3, 12);
  expect(pools(key.pools)).toEqual([
    [
      "additive",
      [
        ["TreeCapped", 1],
        ["TreeReads()", -1],
      ],
    ],
  ]);
  // a lone b / 100 is one term (only a whole sum divided by 100 weighs its terms 0.01)
  expect(pools(key.divisors)).toEqual([
    [
      "additive",
      [
        ["1", 1],
        ["TreeStats.b", 1],
      ],
    ],
    ["multi", [["TreeLoop()", 1]]],
  ]);
});

test("a Cap whose limit is no constant: the limit is a line that opens into its sources", () => {
  const key = keyOf("TreeCapAny");
  // min(TreeReads() + TreeBase = 12, TreeCapped / 10 = 8)
  expect(key.final).toBe(8);
  expect(layers(key)).toEqual([["cap", 8, 12, 8]]);
  expect(key.top[0]?.limit?.map((t) => t.ref)).toEqual(["TreeCapped"]);
  expect(pools(key.pools)).toEqual([
    [
      "additive",
      [
        ["TreeReads()", 1],
        ["TreeBase", 1],
      ],
    ],
  ]);
});

test("a Floor over a Cap, both with a limit that is no constant: a layer each, from outside in", () => {
  const key = keyOf("TreeCapNested");
  // max(min(TreeReads() × 2 = 16, TreeCapped 80) = 16, TreeLevel 25) = 25
  expect(key.final).toBe(25);
  expect(layers(key)).toEqual([
    ["floor-min", 25, 16, 25],
    ["cap", 80, 16, 16],
  ]);
  expect(key.top.map((l) => l.limit?.map((t) => t.ref))).toEqual([
    ["TreeLevel"],
    ["TreeCapped"],
  ]);
  expect(pools(key.pools)).toEqual([
    [
      "multi",
      [
        ["TreeReads()", 1],
        ["2", 1],
      ],
    ],
  ]);
});

test("pow with a constant is a curve: a term of its pool (its ⓘ), never a pool of its own", () => {
  const alone = keyOf("TreePowTop");
  expect(alone.final).toBe(8);
  expect(alone.pools.map((p) => p.terms.map((t) => [t.ref, t.value]))).toEqual([
    [["TreeTwins[0]", 8]],
  ]);
  const term = keyOf("TreePowTerm");
  // 10 × TreeLevel ^ 0.5 × (1 + 5 / 100)
  expect(term.final).toBeCloseTo(52.5, 12);
  expect(term.pools.map((p) => [p.kind, p.terms.map((t) => t.ref)])).toEqual([
    ["multi", ["10", "TreeLevel", "TreeStats.b"]],
  ]);
});
