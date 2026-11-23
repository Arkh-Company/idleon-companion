// The step a call returned is chosen by its recorded place, never by a value equal to the call's (spec 010, T184;
// CODING_STANDARDS, the rule of the place). The invented game (fake-game.js, TreeAddTalents) gives two talents of one
// code on an `add` curve, the level a step before the curve: with ×1 the level and the curve are both 27.
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
