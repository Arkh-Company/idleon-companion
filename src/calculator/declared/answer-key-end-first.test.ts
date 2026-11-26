// The pools' order when the code writes the end first (spec 010, T178; the LUK: floor(A + (1 + P/100) × (B + C))): a
// term (1 + sum/100) × (sum) inside a sum becomes the pools in the game's order, the base's Additive, the % Multi, then
// the Additive of the rest, by the recorded expression's structure, never by the text's order. The invented game
// (fake-game.js, TreeEndFirst) gives floor(TreeLevel + (1 + (TreeStats.a + TreeStats.b) / 100) × (TreeBase + TreeCapped)).
import { expect, test } from "vitest";
import { recorded } from "./lock-fixture.ts";

test("a (1 + sum/100) × (sum) inside a sum gives the base, then the %, then the rest", () => {
  const { key } = recorded("TreeEndFirst");
  expect(key.final).toBe(115);
  expect(key.top.map((l) => l.kind)).toEqual(["floor"]);
  expect(
    key.pools.map((p) => [p.kind, p.value, p.terms.map((t) => t.refs)]),
  ).toEqual([
    ["additive", 84, [["TreeBase"], ["TreeCapped"]]],
    ["multi", 1.08, [["TreeStats.a", "TreeStats.b"]]],
    ["additive", 25, [["TreeLevel"]]],
  ]);
  expect(key.pools.every((p) => p.error < 1e-9)).toBe(true);
});
