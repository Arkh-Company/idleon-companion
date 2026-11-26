// A call in a loop's turn by its recorded place (spec 010, T226; r1 of part W): in an author's write's turn, by the
// write each call began after (`seq`), its window's first write in and its own write out; two calls of one key in the
// window, which the place does not part, tie to none, never to the first; the call leaf of the level's expression is
// its own place and decides.
import { expect, test } from "vitest";
import type { RecNode, Recording } from "../recording.ts";
import type { Expr, LoopTurn } from "../recorded/steps.ts";
import { levelContext, present } from "./lock-fixture.ts";
import { callAt, callIn, kidOf } from "./lock-values.ts";

const call = (id: number, pxi: number, seq: number): RecNode => ({
  id,
  b: "TreeTurnAt",
  a: [],
  c: [],
  p: 0,
  pxi,
  seq,
  v: id * 2,
});
// the scope called TreeTurnAt() twice, after the writes 1 and 3
const rec: Recording = {
  nodes: [
    { id: 0, b: "TreeScope", a: [], c: [1, 2], p: null, pxi: 0, seq: 0 },
    call(1, 1, 1),
    call(2, 3, 3),
  ],
  writes: [],
  spliced: [],
  bpStart: null,
  setup: null,
  root: 0,
  builders: null,
  fromGame: [],
};
const ctx = levelContext(rec, [], "invented");
const scope = present(rec.nodes[0], "scope");
const ref = { call: "TreeTurnAt", args: [] };
const turn = (from: number, to: number): LoopTurn => ({
  from: 0,
  to: 9,
  seq: { from, to },
});
const leaf: Expr = { t: "call", id: 2, v: 4 };

test("two calls of one key in a turn's window tie to none, never to the first (r1 of part W)", () => {
  expect(kidOf(scope, "TreeTurnAt()", ctx, turn(1, 4))).toBeNull();
  expect(callIn(ref, scope, [], ctx, undefined, turn(1, 4))).toBeUndefined();
});

test("the level's call leaf is its own place: it decides between two calls of one key in the turn (r1 of part W)", () => {
  expect(callIn(ref, scope, [leaf], ctx, undefined, turn(1, 4))?.id).toBe(2);
});

test("a turn's window holds the call begun after its first write, not the one begun after its own (r1 of part W)", () => {
  expect(kidOf(scope, "TreeTurnAt()", ctx, turn(3, 4))?.id).toBe(2);
  expect(kidOf(scope, "TreeTurnAt()", ctx, turn(1, 3))?.id).toBe(1);
});

test("a turn's item with two call leaves of one key ties to none at its line's head, never to the first (T230)", () => {
  const first: Expr = { t: "call", id: 1, v: 2 };
  expect(callAt([first, leaf], "TreeTurnAt()", scope, ctx, turn(1, 4))).toBe(
    null,
  );
  // one call leaf is its own place: the second call, the order's last
  expect(callAt([leaf], "TreeTurnAt()", scope, ctx, turn(1, 4))?.id).toBe(2);
});
