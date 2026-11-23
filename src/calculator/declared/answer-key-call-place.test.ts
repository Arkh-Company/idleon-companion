// A step's call is tied by its place in the call's step log (spec 010, T177 r1; CODING_STANDARDS, "The answer key ties
// by the recorded place, never by value alone"): of two calls of one block with the same value, the step takes the one
// that returned where the step recorded it, never the first one of that value. The AGI's talents at 0 gave the % of the
// root the talent of the obol's multiplier. The invented game (fake-game.js, TreeTwoCalls) gives TreeLevel + TreeFlat(2).
import { expect, test } from "vitest";
import { recordingOf } from "../fixtures/recording-fixture.ts";
import { instrument } from "../instrument.ts";
import { makeSteps } from "../recorded/steps.ts";
import { answerKeyOfSteps } from "./answer-key.ts";
import { answerKey } from "./answer-key.ts";
import { ambiguousCall } from "./answer-key-turn.ts";
import { inventedRecorder } from "./lock-fixture.ts";
import { mosaicOf } from "../fixtures/fake-mosaic.ts";
import { recorded } from "./lock-fixture.ts";

test("a step's call is the one that returned at its place, not the first call of that value", () => {
  const { key } = recorded("TreeTwoCalls");
  expect(key.final).toBe(25);
  expect(key.pools[0]?.terms.map((t) => t.ref)).toEqual([
    "TreeLevel",
    "TreeFlat(2)",
  ]);
});

test("with no recorded place and two calls of one block with the step's value, the answer key refuses it", () => {
  // `var p = P()` is no step of the code: its call has no place, and both calls of P gave 6
  const { ops } = instrument(
    "Blocks._customBlock_T = function () { var p = Blocks._customBlock_P(1); Blocks._customBlock_P(2); return p * 2; };",
  );
  const leaf = ops.findIndex((o) => o.kind === "leaf");
  const op = ops.findIndex((o) => o.kind === "op");
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      {
        b: "T",
        v: 12,
        c: [2, 3],
        x: [
          [leaf, 6],
          [op, 12],
        ],
      },
      { b: "P", a: [1], v: 6 },
      { b: "P", a: [2], v: 6 },
    ],
    [],
    { root: 0 },
  );
  const key = answerKeyOfSteps(rec, makeSteps(rec, ops).of(1), { ops });
  expect(key).toMatchObject({ error: "rootForm" });
  expect("reason" in key ? key.reason : "").toMatch(
    /a chamada P de valor 6 sai de mais de uma chamada, e o lugar não decide/,
  );
});

// `x = c ? P(1) : Q(2)`, and Q(2) called again with no use: both calls gave 6, and only the ? :'s test says which is x's;
// with `test` undefined, the test has no record at all (the ? : never ran there)
function ternaryOfTwo(test: boolean | null | undefined) {
  const { ops } = instrument(
    "Blocks._customBlock_T = function (c) { var x = c ? Blocks._customBlock_P(1) : Blocks._customBlock_Q(2); Blocks._customBlock_Q(2); return x * 2; };",
  );
  const kind = (k: string) => ops.findIndex((o) => o.kind === k);
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      {
        b: "T",
        a: [1],
        v: 12,
        c: [2, 3],
        x: [
          ...(test === undefined
            ? []
            : [[kind("test"), test] as [number, boolean | null]]),
          [kind("leaf"), 6],
          [kind("op"), 12],
        ],
      },
      { b: "P", a: [1], v: 6 },
      { b: "Q", a: [2], v: 6 },
    ],
    [],
    { root: 0 },
  );
  return makeSteps(rec, ops);
}

test("a variable set by a ? : of two calls takes the call on the side its recorded test took", () => {
  const made = ternaryOfTwo(true);
  expect(made.of(1).steps[0]?.e).toMatchObject({
    t: "op",
    l: { t: "call", id: 2 },
  });
  expect(ambiguousCall(made.ambiguous)).toBeNull();
});

test("a variable set by a ? : whose test has no recorded side is ambiguous, with the reason", () => {
  const made = ternaryOfTwo(null);
  expect(made.of(1).steps[0]?.e).toMatchObject({ l: { t: "val", v: 6 } });
  expect(ambiguousCall(made.ambiguous)).toBe(
    "a chamada P de valor 6 está num ? : cujo lado o lugar não decide",
  );
});

test("a variable set by a ? : whose test was never recorded up to the step takes no side: a loose value, not ambiguous", () => {
  const made = ternaryOfTwo(undefined);
  expect(made.of(1).steps[0]?.e).toMatchObject({ l: { t: "val", v: 6 } });
  expect(ambiguousCall(made.ambiguous)).toBeNull();
});

test("in a loop's turn, two calls of one block with the step's value and no place refuse the root, never tie to a read", () => {
  // TreeRunTwins: each turn `x = TreeThree(2r); y = TreeThree(2r + 1); t += x * y + TreeGear[r]`: 3 and 3 by the gear 3, then 4 and 5
  const recorder = inventedRecorder();
  const rec = recorder.record(
    mosaicOf({ TreeGear: [3, 3] }),
    [["TreeRunTwins", [0, 0, 0]]],
    { recompute: [], builders: [] },
  );
  const key = answerKey(rec, recorder.ops);
  expect("reason" in key ? key.reason : JSON.stringify(key)).toMatch(
    /a chamada TreeThree de valor 3 sai de mais de uma chamada, e o lugar não decide/,
  );
});

test("a variable set by a call ties by its data flow, never to an earlier read with its value", () => {
  // TreeRunTwinRead: each turn `TreeGear[r] read; x = TreeThree(2r); TreeThree(2r + 1); t += x`: the gear and both calls 3
  const recorder = inventedRecorder();
  const rec = recorder.record(
    mosaicOf({ TreeGear: [3, 3] }),
    [["TreeRunTwinRead", [0, 0, 0]]],
    { recompute: [], builders: [] },
  );
  const key = answerKey(rec, recorder.ops);
  expect("reason" in key ? key.reason : JSON.stringify(key)).toMatch(
    /a chamada TreeThree de valor 3 sai de mais de uma chamada, e o lugar não decide/,
  );
});

test("a variable set by a call no turn holds never ties to a read of the turn with its value", () => {
  // TreeRunEarly: `m = TreeThree(0)` before the loop, the total from 1; each turn reads TreeGear[r], adds m; TreeGear[1] 3
  const recorder = inventedRecorder();
  const rec = recorder.record(
    mosaicOf({ TreeGear: [5, 3] }),
    [["TreeRunEarly", [0, 0, 0]]],
    { recompute: [], builders: [] },
  );
  const key = answerKey(rec, recorder.ops);
  if ("error" in key) throw new Error(key.reason);
  // m, its call in no turn, stays a loose 3 in each turn
  expect(key.final).toBe(32);
  expect(key.pools.flatMap((p) => p.terms.map((t) => t.ref))).toEqual([
    "TreeLevel",
    "3",
    "3",
  ]);
});

test.each(["TreeViaWrapped", "TreeViaChain", "TreeViaTernary"])(
  "%s: a variable set by a block's call through asNumber, another variable or a ? : takes the call, not a read",
  (block) => {
    const { key } = recorded(block, { TreeGear: [5, 3] });
    expect(key.final).toBe(28);
    expect(key.pools.flatMap((p) => p.terms.map((t) => t.ref))).toEqual([
      "TreeLevel",
      "TreeThree(0)",
    ]);
  },
);

test.each(["TreeTernaryDirect", "TreeViaFloor"])(
  "%s: a block's call anywhere in the step's leaf or the variable's expression never ties to an earlier read with its value",
  (block) => {
    // TreeGear[1] (3) read, then `TreeLevel + (TreeLevel > 0 ? TreeThree(0) : 0)` or `x = Math.floor(TreeThree(0))`
    const { key } = recorded(block, { TreeGear: [5, 3] });
    expect(key.final).toBe(28);
    expect(key.pools.flatMap((p) => p.terms.map((t) => t.ref))).toEqual([
      "TreeLevel",
      "TreeThree(0)",
    ]);
  },
);

test("what a variable was before `t += …`, set through another variable by a block's call, is the call, not a read", () => {
  // TreeAddToChain: TreeGear[1] (3) read, then `y = TreeThree(0); t = y; t += TreeLevel; return Math.floor(t)`
  const { key } = recorded("TreeAddToChain", { TreeGear: [5, 3] });
  expect(key.final).toBe(28);
  expect(key.pools.flatMap((p) => p.terms.map((t) => t.ref))).toEqual([
    "TreeThree(0)",
    "TreeLevel",
  ]);
});

test("a block's call through asNumber right in the step takes the call, not an earlier read with its value", () => {
  // TreeWrappedDirect: TreeGear[1] (3) read, then `TreeLevel + asNumber(TreeThree(0))`
  const { key } = recorded("TreeWrappedDirect", { TreeGear: [5, 3] });
  expect(key.final).toBe(28);
  expect(key.pools.flatMap((p) => p.terms.map((t) => t.ref))).toEqual([
    "TreeLevel",
    "TreeThree(0)",
  ]);
});
