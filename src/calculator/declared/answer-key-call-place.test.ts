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
  // TreeRunTwinRead: each turn `g = TreeGear[r]; x = TreeThree(2r); TreeThree(2r + 1); t += x`: the gear and both calls 3
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
  const refs =
    "error" in key
      ? []
      : key.pools.flatMap((p) => p.terms.flatMap((t) => t.refs));
  expect(refs).not.toContain("TreeGear[1]");
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
