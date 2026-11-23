// A running total kept in a counter of the game (spec 010, T177; the LUK's DummyNumbersStatManager.TotalStatsDN): the
// call adds to it in its own steps, a loop's turns among them, and its last step reads it. The total opens through its
// writes, each at its place, one line per turn of the loop, in place of a loose constant; the loop's index, written but
// never added to itself, stays a counter. The invented game (fake-game.js, TreeRunTotal) gives floor(TreeLevel + RunDN).
import { expect, test } from "vitest";
import { recorded } from "./lock-fixture.ts";

const run = () =>
  recorded("TreeRunTotal", {
    TreeGear: [5, 7, 9],
    TreeGallery: 11,
    TreeHat: 2,
  }).key;

test("a running total in a counter of the game opens through its writes: a line per turn of the loop, then the rest", () => {
  const key = run();
  expect(key.final).toBe(59);
  expect(key.top.map((l) => l.kind)).toEqual(["floor"]);
  expect(key.pools.map((p) => p.kind)).toEqual(["additive"]);
  expect(key.pools[0]?.terms.map((t) => [t.ref, t.value])).toEqual([
    ["TreeLevel", 25],
    ["TreeGear[0]", 5],
    ["TreeGear[1]", 7],
    ["TreeGear[2]", 9],
    ["TreeGallery", 11],
    ["TreeHat", 2],
  ]);
});

test("the loop's index, never added to itself, stays out of the terms", () => {
  const refs = run().pools.flatMap((p) => p.terms.flatMap((t) => t.refs));
  expect(refs.filter((r) => r.startsWith("DummyNumbersStatManager."))).toEqual(
    [],
  );
});
