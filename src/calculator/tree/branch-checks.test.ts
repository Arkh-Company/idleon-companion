// A branch check is never a row (spec 009, FR-018; audit family 3, deferred A39): a comparison of a row of its level
// with a literal ("Owned = 1" beside "Owned", "Bonus level > 0" beside "Bonus level") leaves its row only when the ⓘ of
// the row above says it; an ⓘ that does not say it yet gets it in words, as the card's stars (tree/build-up-cards.ts).
import { expect, test } from "vitest";
import { formulaLines } from "../../renderer/tree-text.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { check, fixed, lazy, leaf, named, placed } from "./tree-fixture.ts";

const kids = (n: CalcTreeNode | undefined) =>
  n && Array.isArray(n.kids) ? n.kids.map((k) => k.name) : [];
const lines = (n: CalcTreeNode | undefined) =>
  n?.formula ? formulaLines(n.formula) : null;

test("a check of a state beside it leaves its row, and the ⓘ above says it", () => {
  const [n] = placed({}, [
    named("Some bonus", 12, [
      fixed("× 2", 2),
      leaf("Bonus level", 6, "Stats.lv", "level"),
      check("Owned", true, "Stats.own"),
      check("Owned = 1", true),
    ]),
  ]).rows;
  expect(kids(n)).not.toContain("Owned = 1");
  expect(lines(n)?.names).toContain("Owned = 1");
});

test("a check an ⓘ of atoms does not say leaves its row, and the ⓘ says it in words", () => {
  const [n] = placed({}, [
    named("Some bonus", 10, [
      leaf("Bonus level", 6, "Stats.lv", "level"),
      leaf("Other bonus", 4, "Stats.other", "rawBonus"),
      check("Bonus level > 0", true),
    ]),
  ]).rows;
  // the math of the rows, the check said after it
  expect(n?.formula).toEqual({
    rule: ["Bonus level + Other bonus (Bonus level > 0: yes)", "6 + 4 = 10"],
  });
  expect(kids(n)).toEqual(["Bonus level", "Other bonus"]);
});

/** A source that opens into its own pool, beside the pool the level it reads and the check of that level. */
function besidePool(): CalcTreeNode | null {
  const level = leaf("Invented level", 101, "Stats.lv", "level");
  const pool: Row = {
    node: row({
      pieceKey: null,
      value: 2,
      code: null,
      name: "Multi pool",
      role: "pool",
      combine: "product",
      poolKind: "multi",
      fmt: "x",
      flags: { closed: true },
    }),
    open: null,
    group: [level, fixed("× 2", 2)],
  };
  const t = placed({ 1: [pool, level, check("Invented level = 101", true)] }, [
    {
      ...lazy("Invented source", 2, "Call1()", 1),
      xf: ["Multi pool", "2 = 2"],
    },
  ]);
  return t.expand(t.rows[0]?.id ?? "");
}

test("beside a pool, a read the pool shows leaves, and a check of it is said in the ⓘ (FR-005, family 10)", () => {
  const n = besidePool() ?? undefined;
  expect(kids(n)).toEqual(["Multi pool"]);
  expect(lines(n)?.names).toContain("Invented level = 101: yes");
});
