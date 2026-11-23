// A step's call is tied by its place in the call's step log (spec 010, T177 r1; CODING_STANDARDS, "The answer key ties
// by the recorded place, never by value alone"): of two calls of one block with the same value, the step takes the one
// that returned where the step recorded it, never the first one of that value. The AGI's talents at 0 gave the % of the
// root the talent of the obol's multiplier. The invented game (fake-game.js, TreeTwoCalls) gives TreeLevel + TreeFlat(2).
import { expect, test } from "vitest";
import { recorded } from "./lock-fixture.ts";

test("a step's call is the one that returned at its place, not the first call of that value", () => {
  const { key } = recorded("TreeTwoCalls");
  expect(key.final).toBe(25);
  expect(key.pools[0]?.terms.map((t) => t.ref)).toEqual([
    "TreeLevel",
    "TreeFlat(2)",
  ]);
});
