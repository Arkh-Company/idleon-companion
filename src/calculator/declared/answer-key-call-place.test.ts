// A step's call is tied by its place in the call's step log (spec 010, T177 r1; CODING_STANDARDS, "The answer key ties
// by the recorded place, never by value alone"): of two calls of one block with the same value, the step takes the one
// that returned where the step recorded it, never the first one of that value. The AGI's talents at 0 gave the % of the
// root the talent of the obol's multiplier. The invented game (fake-game.js, TreeTwoCalls) gives TreeLevel + TreeFlat(2).
import { expect, test } from "vitest";
import { recordingOf } from "../fixtures/recording-fixture.ts";
import { instrument } from "../instrument.ts";
import { makeSteps } from "../recorded/steps.ts";
import { answerKeyOfSteps } from "./answer-key.ts";
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
