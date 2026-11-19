// A branch check is never a row (spec 009, FR-018; audit family 3, deferred A39): a comparison of a row of its level
// with a literal ("Owned = 1" beside "Owned", "Bonus level > 0" beside "Bonus level") leaves its row only when the ⓘ of
// the row above says it; an ⓘ that does not say it yet gets it in words, as the card's stars (tree/build-up-cards.ts).
import { expect, test } from "vitest";
import { formulaLines } from "../../renderer/tree-text.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { firstLevel } from "./mould.ts";
import type { Expr, Step } from "./steps.ts";
import { check, fixed, lazy, leaf, named, placed, read } from "./tree-fixture.ts";

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

/**
 * A source that opens into its own pool, beside the pool the level it reads and the check of that level, its ⓘ the game's
 * expression `xf`.
 */
function besidePool(xf: [string, string]): CalcTreeNode | null {
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
      xf,
    },
  ]);
  return t.expand(t.rows[0]?.id ?? "");
}

test("beside a pool, a read the pool shows leaves, and a check of it is said in an ⓘ of words (FR-005, family 10)", () => {
  const n = besidePool(["Multi pool, when unlocked", "2"]) ?? undefined;
  expect(kids(n)).toEqual(["Multi pool"]);
  expect(lines(n)?.names).toContain("Invented level = 101: yes");
});

test("beside a pool, a check stays while the ⓘ is of atoms, which cannot say it (A39)", () => {
  const n = besidePool(["Multi pool", "2 = 2"]) ?? undefined;
  expect(kids(n)).toEqual(["Multi pool", "Invented level = 101"]);
});

// A root whose steps are a chain, (Call1() + Call2()) × Call3(), its check "Owned = 1" beside "Owned" after the pools
const call = (p: string, v: number): Expr => ({ t: "read", p, v });
const op = (o: string, l: Expr, r: Expr, v: number): Expr => ({
  t: "op",
  o,
  l,
  r,
  v,
});
function rootWithCheck(a: number, b: number, round: boolean) {
  const rows = [
    read("Call1()", a),
    read("Call2()", b),
    read("Call3()", 2),
    check("Owned", true, "Stats.own"),
    check("Owned = 1", true),
  ];
  const sum = op("+", call("Call1()", a), call("Call2()", b), a + b);
  const product = op("*", { t: "val", v: a + b }, call("Call3()", 2), (a + b) * 2);
  const v = round ? Math.floor((a + b) * 2) : (a + b) * 2;
  const last: Expr = round
    ? { t: "fn", name: "floor", args: [product], v }
    : product;
  const steps: Step[] = [
    { v: a + b, e: sum },
    { v, e: last },
  ];
  const termAt = (e: Expr): Row | null =>
    e.t === "read"
      ? (rows.find((r) => r.node.code === e.p) ?? null)
      : e.t === "num"
        ? fixed(`Fixed +${String(e.v)}`, Number(e.v))
        : null;
  return firstLevel(
    rows,
    { name: "Total", value: v, formula: null },
    {
      expr: last,
      term: (e) => termAt(e),
      writerOf: () => undefined,
      steps,
      termAt,
    },
  );
}

test("beside the root's pools, a check leaves and is said after the pools' math in the root's ⓘ (A39)", () => {
  const out = rootWithCheck(3, 4, false);
  expect(out.rows.map((r) => r.node.name)).not.toContain("Owned = 1");
  expect(out.formula).toEqual({
    rule: ["Additive pool × Call3() (Owned = 1: yes)", "7 × 2 = 14"],
  });
});

test("beside a rounded root's pools, a check leaves and is said after the rounding in the root's ⓘ (A39, T030)", () => {
  const out = rootWithCheck(3.5, 4.25, true);
  expect(out.rows.map((r) => r.node.name)).not.toContain("Owned = 1");
  expect(out.formula).toEqual({
    rule: ["floor(Additive pool × Call3()) (Owned = 1: yes)", "floor(7.75 × 2) = 15"],
  });
});
