// The chain form of the answer key (spec 010, T158): the chains the fourth probe still refused, each as an invented
// block (fake-game.js), with no guess: a layer on a step of the chain, a chain whose last write is the last step, a
// running total whose last write has no step (not a chain), and a total multiplied in place by a curve.
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import { bootRecorder } from "../tree-record.ts";
import { answerKey } from "./answer-key.ts";
import type { AnswerKey, RootShape } from "./answer-key.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});

function keyOf(block: string, shape: RootShape = null): AnswerKey {
  const rec = recorder.record(mosaicOf(), [[block, [0, 0, 0]]], {
    recompute: [],
    builders: [],
  });
  const key = answerKey(rec, recorder.ops, shape);
  if ("error" in key) throw new Error(`${block}: ${key.reason}`);
  return key;
}
const layers = (key: AnswerKey) =>
  key.top.map((l) => [l.kind, l.value ?? null, l.before, l.after]);
const pools = (key: AnswerKey) =>
  key.pools.map((p) => [p.kind, p.terms.map((t) => t.ref)]);

test("a first step of the chain that is a max (Trap collect all, New bubble chance, Arcade ball): its layer, then the pools", () => {
  // max(1, TreeReads() + TreeBase = 12), then × TreeLoop()
  const key = keyOf("TreeChainMaxFirst");
  expect(key.form).toBe("chain");
  expect(layers(key)).toEqual([["floor-min", 1, 12, 12]]);
  expect(pools(key)).toEqual([
    ["additive", ["TreeReads()", "TreeBase"]],
    ["multi", ["TreeLoop()"]],
  ]);
});

test("a chain whose last write is the last step, floored (Legend talent max LV): the chain, with the floor", () => {
  // 0, then floor(3 + TreeLevel / 10) = floor(5.5)
  const key = keyOf("TreeChainFloorLast");
  expect(key.form).toBe("chain");
  expect(layers(key)).toEqual([["floor", null, 5.5, 5]]);
  expect(pools(key)).toEqual([["additive", ["3", "TreeLevel"]]]);
});

test("a running total whose last write no step gave is no chain (Research insight: a counter of 0)", () => {
  // the counter is 0 twice, and the root returns 3 × counter × TreeLoop()
  const key = keyOf("TreeCountNone");
  expect(key.form).toBe("expression");
  expect(key.final).toBe(0);
  expect(pools(key)).toEqual([
    ["multi", ["3", "DNSM.TreeCount.v", "TreeLoop()"]],
  ]);
});

test("a cost multiplied in place by a curve (Bubble cost: 0.75 ^ n): each operand a term, the curve in its ⓘ", () => {
  // TreeCapped × 100, then *= max(0.1, 0.75 ^ TreeTwins[0]), then *= max(0.9, 1 − TreeStats.a / 100), rounded
  const key = keyOf("TreeCostCurve");
  expect(key.form).toBe("chain");
  expect(layers(key)).toEqual([["round", null, 3273.75, 3274]]);
  expect(pools(key)).toEqual([
    ["multi", ["TreeCapped", "100", "TreeTwins[0]", "TreeStats.a"]],
  ]);
  expect(key.pools[0]?.error).toBeLessThanOrEqual(1e-6);
  // the reducer is the part of the two curves
  const part = keyOf("TreeCostCurve", {
    part: ["TreeTwins[0]", "TreeStats.a"],
  });
  expect(part.final).toBeCloseTo(0.421875 * 0.97, 12);
});

// The review of T157 to T160: what each branch of the chain has to do, one case each.
const recordWith = (block: string, attrs: object = {}) =>
  recorder.record(mosaicOf(attrs), [[block, [0, 0, 0]]], {
    recompute: [],
    builders: [],
  });
const refusal = (block: string) => {
  const key = answerKey(recordWith(block), recorder.ops);
  return "error" in key ? key.reason : "no refusal";
};

test("a total set to 0 before its loop too: a write equal to the total before it is never `path *= x`", () => {
  // 0, 0 (the loop's init), the turns, then × TreeBase
  const key = keyOf("TreeLoopZeroTwice");
  expect(key.form).toBe("chain");
  expect(key.pools.map((p) => p.kind)).toEqual(["additive", "multi"]);
});

test("a layer in the middle of the chain that bites: the next pool starts from the value after the layer", () => {
  // max(1, TreeReads() + TreeBase = 0 + 0.5) = 1, then × TreeLoop() = 6
  const key = answerKey(
    recordWith("TreeChainMaxFirst", {
      TreeStats: { $m: { a: 0, b: 0 } },
      TreeBase: 0.5,
    }),
    recorder.ops,
  );
  if ("error" in key) throw new Error(key.reason);
  expect(key.final).toBe(6);
  expect(layers(key)).toEqual([["floor-min", 1, 0.5, 1]]);
  expect(key.top[0]?.step).toBe(0);
  expect(key.pools.map((p) => [p.kind, p.value])).toEqual([
    ["additive", 0.5],
    ["multi", 6],
  ]);
  for (const p of key.pools) expect(p.error).toBeLessThanOrEqual(1e-6);
});

test("a write that the next step both multiplies and adds to the total to give is refused", () => {
  // 3, then *= 1.5: 3 × 1.5 = 3 + 1.5 = 4.5
  expect(refusal("TreeBothWays")).toMatch(/soma e multiplica ao mesmo tempo/);
});

test("`path += x` in place: the operand is an Additive stretch of the chain", () => {
  // TreeReads() × 2 = 16, then += TreeLevel × 3
  const key = keyOf("TreePlusInPlace");
  expect(key.form).toBe("chain");
  expect(pools(key)).toEqual([
    ["multi", ["TreeReads()", "2"]],
    ["additive", ["TreeLevel"]],
  ]);
  expect(key.final).toBe(91);
});

test("a division in a write of the chain is no layer: the step is refused", () => {
  // 12, 24, then the total ÷ 4
  expect(refusal("TreeDivWrite")).toMatch(/o passo 2 não soma nem multiplica/);
});
