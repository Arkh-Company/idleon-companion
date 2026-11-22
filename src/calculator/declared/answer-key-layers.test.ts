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

test("T151: a step of a running total written as a condition stays a chain, with the terms of the path that ran", () => {
  const no = keyOf("TreeGateChain");
  expect(no.form).toBe("chain");
  // TreeReads() + TreeBase, then × TreeTwins[0]
  expect(pools(no.pools)).toEqual([
    [
      "additive",
      [
        ["TreeReads()", 1],
        ["TreeBase", 1],
      ],
    ],
    ["multi", [["TreeTwins[0]", 1]]],
  ]);
  const yes = keyOf("TreeGateChain", { TreeOwned: 1 });
  expect(yes.form).toBe("chain");
  // TreeReads() + TreeBase, then × 2
  expect(pools(yes.pools)).toEqual([
    [
      "additive",
      [
        ["TreeReads()", 1],
        ["TreeBase", 1],
      ],
    ],
    ["multi", [["2", 1]]],
  ]);
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

const refusal = (block: string) => {
  const rec = recorder.record(mosaicOf(), [[block, [0, 0, 0]]], {
    recompute: [],
    builders: [],
  });
  const key = answerKey(rec, recorder.ops);
  return "error" in key ? key.reason : "no refusal";
};
const limitOf = (layer: AnswerKey["top"][number] | undefined) =>
  layer?.limit && [
    layer.limit.kind,
    layer.limit.terms.map((t) => [t.ref, t.weight]),
  ];

test("a min or a max with no constant whose value and limit cannot be told apart is refused, never chosen by order", () => {
  // neither side comes from what the root wrote: min(TreeReads() + TreeBase, TreeCapped / 10)
  expect(refusal("TreeCapAny")).toMatch(
    /o limite do min\/max não se distingue do valor/,
  );
  expect(refusal("TreeCapNested")).toMatch(
    /o limite do min\/max não se distingue do valor/,
  );
});

test("a Cap whose value is the running total and whose limit is a sum with a call (the Multi-Ore): the limit is a line", () => {
  const key = keyOf("TreeCapAcc");
  // min(300 + TreeLoop() = 306, the running total (TreeReads() + TreeBase) × 2 = 24)
  expect(key.final).toBe(24);
  expect(layers(key)).toEqual([["cap", 306, 24, 24]]);
  expect(limitOf(key.top[0])).toEqual([
    "additive",
    [
      ["300", 1],
      ["TreeLoop()", 1],
    ],
  ]);
  expect(key.top[0]?.limit?.error).toBeLessThanOrEqual(1e-6);
  expect(key.form).toBe("chain");
  expect(pools(key.pools)).toEqual([
    [
      "additive",
      [
        ["TreeReads()", 1],
        ["TreeBase", 1],
      ],
    ],
    ["multi", [["2", 1]]],
  ]);
});

test("a Floor over that Cap: a layer each, from outside in, each with its limit as a line", () => {
  const key = keyOf("TreeCapAccNested");
  // max(min(306, 24) = 24, TreeLevel 25) = 25
  expect(key.final).toBe(25);
  expect(layers(key)).toEqual([
    ["floor-min", 25, 24, 25],
    ["cap", 306, 24, 24],
  ]);
  expect(key.top.map(limitOf)).toEqual([
    ["multi", [["TreeLevel", 1]]],
    [
      "additive",
      [
        ["300", 1],
        ["TreeLoop()", 1],
      ],
    ],
  ]);
  expect(key.form).toBe("chain");
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

test("a running total whose last write has a layer over the total is a chain with that layer, never a leaf", () => {
  // 12, 24, then min(24, 5): the cap bites; since T158 a layer on a step of the chain is a line of the root
  const cap = keyOf("TreeCapWrite");
  expect(cap.form).toBe("chain");
  expect(layers(cap)).toEqual([["cap", 5, 24, 5]]);
  expect(cap.pools.map((p) => p.kind)).toEqual(["additive", "multi"]);
  // the Drop Rate shape keeps its chain
  const chain = keyOf("TreeDeclChain");
  expect(chain.form).toBe("chain");
  expect(chain.pools.map((p) => p.kind)).toEqual([
    "additive",
    "multi",
    "additive",
    "multi",
  ]);
});

test("a layer over an expression of the total that keeps the last write's value is ambiguous with the chain, and refused", () => {
  // 12, 24, then floor(24 × (1 + TreeOwned 0 / 100)) = 24: the chain and the last step give the same value
  expect(refusal("TreeLayerOnExpr")).toMatch(
    /a corrente e o último passo dão o mesmo valor/,
  );
  // a layer over the total itself stays the chain's (the cap that bites) or its layer (the Multi-Ore)
  expect(keyOf("TreeCapWrite").form).toBe("chain");
  expect(keyOf("TreeCapAcc").form).toBe("chain");
});

// Spec 010, T157 (spec, Open Questions 22/11): with no side from what the root wrote, the cap is the side that starts
// with a constant of the code; both or neither starting with one is refused.
test("the cap is the side that starts with a constant: 90 + …, or 10000 × …", () => {
  const plus = keyOf("TreeCapConstPlus");
  // min(TreeReads() × 2 = 16, 90 + TreeLevel 25 = 115)
  expect(layers(plus)).toEqual([["cap", 115, 16, 16]]);
  expect(limitOf(plus.top[0])).toEqual([
    "additive",
    [
      ["90", 1],
      ["TreeLevel", 1],
    ],
  ]);
  expect(pools(plus.pools)).toEqual([
    [
      "multi",
      [
        ["TreeReads()", 1],
        ["2", 1],
      ],
    ],
  ]);
  const times = keyOf("TreeCapConstTimes");
  // min(10000 × TreeTwins[0] = 30000, TreeLoop() + TreeCapped = 86)
  expect(layers(times)).toEqual([["cap", 30000, 86, 86]]);
  expect(limitOf(times.top[0])).toEqual([
    "multi",
    [
      ["10000", 1],
      ["TreeTwins[0]", 1],
    ],
  ]);
});

test("both sides starting with a constant, or neither, is refused", () => {
  expect(refusal("TreeCapConstBoth")).toMatch(
    /o limite do min\/max não se distingue do valor/,
  );
  expect(refusal("TreeCapAny")).toMatch(
    /o limite do min\/max não se distingue do valor/,
  );
});
