// The answer key (spec 010, FR-002c, FR-008, FR-009, research R1 and R9): what a recording of the invented game gives
// of a number, read from the root block's steps and writes only. The blocks are fake-game.js's TreeDecl* (T017).
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import type { Recording } from "../recording.ts";
import { bootRecorder } from "../tree-record.ts";
import { recordingOf } from "../fixtures/recording-fixture.ts";
import type { Expr } from "../recorded/steps.ts";
import { answerKey, answerKeyOfSteps } from "./answer-key.ts";
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

test("a passage copied by a step that keeps its value still reaches the child call it came from, and the step's own constant counts once", () => {
  // the root wrote a child call's 80 to DNSM.q with `=` (no step), then a step reads it back `+ 0`
  const termsOf = (
    writes: { path: string; v: number }[],
    steps: { v: number; e: Expr }[],
  ) => {
    const rec = recordingOf(
      [
        { b: "(root)", c: [1] },
        { b: "InventedRoot", a: [0, 0, 0], v: 84, c: [2] },
        { b: "InventedTalent", a: [3], v: 80 },
      ],
      writes.map((w, i) => ({ ...w, node: 1, seq: i + 1 })),
      { root: 0 },
    );
    const key = answerKeyOfSteps(rec, { steps, checks: [] });
    if ("error" in key) throw new Error(key.reason);
    return key.pools.flatMap((p) => p.terms);
  };
  const q: Expr = { t: "read", p: "DNSM.q", v: 80 };
  const copy = {
    v: 80,
    e: { t: "op", o: "+", l: q, r: { t: "num", v: 0 }, v: 80 } as Expr,
  };
  const plus4 = (l: Expr) => ({
    v: 84,
    e: { t: "op", o: "+", l, r: { t: "num", v: 4 }, v: 84 } as Expr,
  });
  // a later step (the root's expression) reads the passage
  const later = termsOf([{ path: "DNSM.q", v: 80 }], [copy, plus4(q)]);
  expect(later.flatMap((t) => t.refs)).toContain("InventedTalent(3)");
  expect(
    later.filter((t) => t.ref === "0").map((t) => [t.kind, t.value]),
  ).toEqual([["constant", 0]]);
  // the copy is the chain's first step, opened by the chain: never again inside itself
  const acc = { t: "read", p: "DNSM.acc", v: 80 } as Expr;
  const itself = termsOf(
    [
      { path: "DNSM.q", v: 80 },
      { path: "DNSM.acc", v: 80 },
      { path: "DNSM.acc", v: 84 },
    ],
    [copy, plus4(acc)],
  );
  expect(itself.map((t) => [t.kind, t.ref])).toEqual([
    ["source", "InventedTalent(3)"],
    ["constant", "0"],
    ["constant", "4"],
  ]);
});

test("a passage whose step leads back to itself ends: the passage already crossed stays its value (the root probe, T026)", () => {
  // two steps with the value a passage holds, each one holding that value with no name: crossing it again never ends
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "InventedLoopy", a: [0, 0, 0], v: 84 },
    ],
    [
      { path: "DNSM.Loopy.p", node: 1, v: 80, seq: 1 },
      { path: "DNSM.Loopy.p", node: 1, v: 80, seq: 2 },
    ],
    { root: 0 },
  );
  const val: Expr = { t: "val", v: 80 };
  const op = (o: string, l: Expr, r: Expr, v: number): Expr => ({
    t: "op",
    o,
    l,
    r,
    v,
  });
  const steps = [
    { v: 80, e: op("+", val, { t: "num", v: 0 }, 80) },
    { v: 80, e: op("*", val, { t: "num", v: 1 }, 80) },
    {
      v: 84,
      e: op(
        "+",
        { t: "read", p: "TreeBase", v: 4 },
        { t: "read", p: "DNSM.Loopy.p", v: 80 },
        84,
      ),
    },
  ];
  const key = answerKeyOfSteps(rec, { steps, checks: [] });
  if ("error" in key) throw new Error(key.reason);
  expect(key.form).toBe("expression");
  expect(key.pools.map((p) => [p.kind, p.value])).toEqual([["additive", 84]]);
  expect(key.pools[0]?.error).toBeLessThanOrEqual(1e-6);
  expect(key.pollution.passageCycle).toBeGreaterThan(0);
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

// Spec 010, T143: a top layer above the pools (spec, Open Questions 21/11), from outside in, as the code writes it.
const layers = (key: AnswerKey) =>
  key.top.map((l) => [l.kind, l.value ?? null, l.before, l.after]);

test("round(min(C, a × b)): the layer [round, cap C] over one Multi pool", () => {
  const key = keyOf("TreeLayerRound");
  expect(key.final).toBe(20);
  expect(layers(key)).toEqual([
    ["round", null, 20, 20],
    ["cap", 20, 26.400000000000002, 20],
  ]);
  expect(key.form).toBe("expression");
  expect(key.pools.map((p) => [p.kind, p.terms.map((t) => t.ref)])).toEqual([
    ["multi", ["TreeReads()", "TreeTwins[0]", "1.1"]],
  ]);
  expect(key.pools[0]?.after).toBe(26.400000000000002);
  expect(key.pools[0]?.error).toBeLessThanOrEqual(1e-6);
});

test("the same with floor, ceil, and max(c, x) as a floor", () => {
  const kinds = (block: string) =>
    keyOf(block).top.map((l) => [l.kind, l.value ?? null]);
  expect(kinds("TreeLayerFloor")).toEqual([
    ["floor", null],
    ["cap", 50],
  ]);
  expect(kinds("TreeLayerCeil")).toEqual([
    ["ceil", null],
    ["cap", 50],
  ]);
  const max = keyOf("TreeLayerMax");
  expect(layers(max)).toEqual([
    ["floor", null, 30, 30],
    ["floor-min", 30, 26.400000000000002, 30],
  ]);
  expect(max.pools.map((p) => p.kind)).toEqual(["multi"]);
});

test("cond ? 0 : a + b (a gate): the layer [cond] over one Additive pool; the path that did not run has no value", () => {
  const key = keyOf("TreeLayerGate");
  expect(layers(key)).toEqual([["cond", 0, 88, 88]]);
  expect(key.pools.map((p) => [p.kind, p.terms.map((t) => t.ref)])).toEqual([
    ["additive", ["TreeReads()", "TreeCapped"]],
  ]);
});

test("K ÷ (1 + Σ ÷ 100): the constant K and a divisor with the sources", () => {
  const key = keyOf("TreeLayerDiv");
  expect(layers(key)).toEqual([["div", 100, 1.88, key.final]]);
  // the divisor is a ➗ line, never a pool (T154); the constant numerator has no pool
  expect(key.pools).toEqual([]);
  expect(
    key.divisors.map((p) => [p.kind, p.terms.map((t) => [t.ref, t.weight])]),
  ).toEqual([
    [
      "additive",
      [
        ["1", 1],
        ["TreeReads()", 0.01],
        ["TreeCapped", 0.01],
      ],
    ],
  ]);
});

test("a root that only reads a value or gives a constant is a leaf, with no pool", () => {
  for (const block of ["TreeLayerRead", "TreeLayerConstant"]) {
    const key = keyOf(block);
    expect([key.form, key.pools, key.top]).toEqual(["leaf", [], []]);
  }
});

test("a root with no step is no leaf without proof: a text turned into a number, or a call passed on as it is", () => {
  const recordAt = (block: string, attrs: object) =>
    recorder.record(mosaicOf(attrs), [[block, [0, 0, 0]]], {
      recompute: [],
      builders: [],
    });
  const number = answerKey(
    recordAt("TreeLayerNumber", { TreeLabelNum: "12" }),
    recorder.ops,
  );
  expect(number).toMatchObject({ error: "rootForm" });
  expect("reason" in number ? number.reason : "").toMatch(
    /nenhum passo dá o valor final/,
  );
  const pass = answerKey(record("TreeLayerPass"), recorder.ops);
  expect(pass).toMatchObject({ error: "rootForm" });
  expect("reason" in pass ? pass.reason : "").toMatch(
    /a raiz só repassa uma chamada/,
  );
});

test("a read and a child call with the final value: the call wins, the root only passes it on (T150)", () => {
  const rec = recorder.record(
    mosaicOf({ TreeSeven: 7 }),
    [["TreeLayerReadPass", [0, 0, 0]]],
    { recompute: [], builders: [] },
  );
  const key = answerKey(rec, recorder.ops);
  expect(key).toMatchObject({ error: "rootForm" });
  expect("reason" in key ? key.reason : "").toMatch(
    /a raiz só repassa uma chamada/,
  );
});

// Spec 010, T148: the running total set to 0 in a for loop's init (arcade-ball-bonus, research-insight-rate).
test("a running total set to 0 in a for loop's init is a chain, not out of the rule", () => {
  const key = keyOf("TreeLoopZero");
  expect(key.form).toBe("chain");
  expect(key.accumulator).toBe("DNSM.TreeLoopZero.v");
  expect(key.pools.map((p) => p.kind)).toEqual(["additive", "multi"]);
  expect(key.final).toBe(48);
});

// Spec 010, T151: a condition and its two paths outside the return (Mining and Chop Speed, Multi-Ore, Gilded Stamp
// Chance): the path that ran is opened, and the condition is a ❓ layer.
test("x = cond ? a : b; return x * k: the path that ran opens into its sources, and the condition is a layer", () => {
  for (const block of ["TreeGateVar", "TreeGateInline"]) {
    const key = keyOf(block);
    expect(key.final, block).toBe(315);
    expect(layers(key), block).toEqual([["cond", 0, 105, 105]]);
    expect(
      key.pools.map((p) => [p.kind, p.terms.map((t) => t.ref)]),
      block,
    ).toEqual([
      ["additive", ["TreeCapped", "TreeLevel"]],
      ["multi", ["TreeTwins[0]"]],
    ]);
    for (const p of key.pools) expect(p.error, block).toBeLessThanOrEqual(1e-6);
  }
});
