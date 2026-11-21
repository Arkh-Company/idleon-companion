// The answer key (spec 010, FR-002c, FR-008, FR-009, research R1 and R9): what a recording of the invented game gives
// of a number, read from the root block's steps and writes only. The blocks are fake-game.js's TreeDecl* (T017).
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import type { Recording } from "../recording.ts";
import { bootRecorder } from "../tree-record.ts";
import { answerKey } from "./answer-key.ts";
import type { AnswerKey } from "./answer-key.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});

const record = (block: string): Recording =>
  recorder.record(mosaicOf(), [[block, [0, 0, 0]]], {
    recompute: [],
    builders: [],
  });
function keyOf(block: string): AnswerKey {
  const key = answerKey(record(block), recorder.ops);
  if ("error" in key) throw new Error(key.reason);
  return key;
}
const relDiff = (a: number, b: number) =>
  Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-300);

test("the Drop Rate shape's chain: Additive, Multi, Additive, Multi, the same kind's writes in a row in one pool", () => {
  const key = keyOf("TreeDeclChain");
  expect(key.form).toBe("chain");
  expect(key.root).toBe("TreeDeclChain(0,0,0)");
  expect(key.accumulator).toBe("DNSM.TreeDecl.v");
  expect(key.pools.map((p) => [p.kind, p.steps])).toEqual([
    ["additive", [1, 2]],
    ["multi", [3]],
    ["additive", [4]],
    ["multi", [5, 6]],
  ]);
});

test("each pool closes with its recorded value, and the chain gives the final", () => {
  const key = keyOf("TreeDeclChain");
  for (const p of key.pools) expect(p.error).toBeLessThanOrEqual(1e-6);
  const total = key.pools.reduce(
    (acc: number | null, p) =>
      acc === null
        ? p.value
        : p.kind === "additive"
          ? acc + p.value
          : acc * p.value,
    null,
  );
  expect(relDiff(total ?? 0, key.final)).toBeLessThanOrEqual(1e-6);
  expect(key.pools.at(-1)?.after).toBe(key.final);
});

test("an expression root gives its pools by the operator on top", () => {
  const key = keyOf("TreeDeclExpr");
  expect(key.form).toBe("expression");
  expect(key.accumulator).toBe(null);
  expect(key.final).toBe(567);
  expect(key.pools.map((p) => [p.kind, p.terms.map((t) => t.ref)])).toEqual([
    ["additive", ["TreeReads()", "TreeCapped", "2"]],
    ["multi", ["TreeLoop()", "TreeStats.b"]],
  ]);
  expect(key.pools.map((p) => p.value)).toEqual([90, 6.3]);
  for (const p of key.pools) expect(p.error).toBeLessThanOrEqual(1e-6);
});

test("a root that swaps its running total is refused with its form and the reason", () => {
  const key = answerKey(record("TreeDeclSwap"), recorder.ops);
  expect(key).toMatchObject({ error: "rootForm" });
  expect("reason" in key ? key.reason : "").toMatch(
    /^forma de raiz fora da regra dos pools/,
  );
});

test("scratch writes are ignored, the unnamed accumulator is found by value, passage values are crossed", () => {
  const key = keyOf("TreeDeclChain");
  const first = key.pools[0]?.terms ?? [];
  expect(first.map((t) => [t.ref, t.via])).toEqual([
    ["TreeDeclLuck()", []],
    ["TreeDeclTalent(0)", []],
    ["ArcadeBonus(0)", []],
    ["TreeDeclBest()", ["DNSM.TreeDeclPart.v"]],
    ["TreeCapped", ["DNSM.TreeDeclPart.v"]],
    ["2", []],
  ]);
  expect(key.pollution).toMatchObject({
    scratchWrite: 3,
    unnamedAccumulator: 4,
    readAccumulator: 1,
    passageRead: 1,
  });
});

test("a sum divided by 100 weighs its terms 0.01; a loose constant is a constant term; a two-source term keeps its refs in the code's order", () => {
  const key = keyOf("TreeDeclChain");
  const terms = key.pools.flatMap((p) => p.terms);
  expect(terms.map((t) => [t.kind, t.ref, t.weight])).toEqual([
    ["source", "TreeDeclLuck()", 1],
    ["source", "TreeDeclTalent(0)", 0.01],
    ["source", "ArcadeBonus(0)", 0.01],
    ["source", "TreeDeclBest()", 0.01],
    ["source", "TreeCapped", 0.01],
    ["constant", "2", 1],
    ["source", "TreeLoop()", 1],
    ["constant", "0.5", 1],
    ["source", "TreeStats.b", 1],
    ["constant", "1.2", 1],
  ]);
  const talent = terms[1];
  expect(talent?.refs).toEqual(["TreeDeclTalent(0)", "TreeTwins[0]"]);
  expect(talent?.nodes.map((n) => n === null)).toEqual([false, true]);
  expect(terms[5]).toMatchObject({ refs: [], nodes: [], value: 2 });
});

test("the pollution counts each kind", () => {
  expect(keyOf("TreeDeclChain").pollution).toEqual({
    scratchWrite: 3,
    readAccumulator: 1,
    unnamedAccumulator: 4,
    divideBy100: 1,
    passageRead: 1,
    looseConstant: 3,
    conditionedStep: 3,
    mergedSteps: 2,
  });
});

test("the extraction only reads: the recording is the same after it", () => {
  const rec = record("TreeDeclChain");
  const before = structuredClone(rec);
  const ops = recorder.ops;
  const opsBefore = ops.length;
  answerKey(rec, ops);
  expect(rec).toEqual(before);
  expect(ops.length).toBe(opsBefore);
});
