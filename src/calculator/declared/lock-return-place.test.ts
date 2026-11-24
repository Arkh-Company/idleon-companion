// The step a call returned is chosen by its recorded place, never by a value equal to the call's (spec 010, T184;
// CODING_STANDARDS, the rule of the place). The invented game (fake-game.js, TreeAddTalents) gives two talents of one
// code on an `add` curve, the level a step before the curve: with ×1 the level and the curve are both 27. TreeEarlyCall
// and TreeLateCall return a bare read of 7 after their step, with a call worth 7 before the step or right after it.
import { expect, test } from "vitest";
import { levelContext, recorded } from "./lock-fixture.ts";
import { returnOf } from "./lock-parts.ts";

test("two talents of one code return their curve's call, even when the level has the curve's value", () => {
  const { rec, ops } = recorded("TreeAddTalents");
  const ctx = levelContext(rec, ops, "root");
  const talents = rec.nodes.filter((n) => n.b === "TreeAddTalent");
  expect(talents.map((n) => n.v)).toEqual([27, 108]);
  for (const t of talents) {
    const curve = rec.nodes.find(
      (n) => n.p === t.id && n.b === "ArbitraryCode5Inputs",
    );
    expect(returnOf(t, ctx)).toMatchObject({ t: "call", id: curve?.id });
  }
});

test("a call made before the step, worth the read returned after it, is no return: the read is (T185)", () => {
  const { rec, ops } = recorded("TreeEarlyRoot");
  const ctx = levelContext(rec, ops, "root");
  const early = rec.nodes.find((x) => x.b === "TreeEarlyCall");
  expect(early?.v).toBe(7);
  expect(early && returnOf(early, ctx)).toEqual({
    t: "read",
    p: "TreeBig.k2",
    v: 7,
  });
});

test("a call and a read both after the last step, at the same place, return none: the place does not decide", () => {
  const { rec, ops } = recorded("TreeEarlyRoot");
  const ctx = levelContext(rec, ops, "root");
  const late = rec.nodes.find((x) => x.b === "TreeLateCall");
  expect(late?.v).toBe(7);
  expect(late && returnOf(late, ctx)).toBeNull();
});
