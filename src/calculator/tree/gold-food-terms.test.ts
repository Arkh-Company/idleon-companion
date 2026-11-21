// A golden food's terms by the names the Vinicius gave them on 19/11 (tree/gold-food-chain.ts): N.js GoldFoodBonuses
// writes bonus = Amount × multi × 0.05 × log₁₀(1 + q) × (1 + log₁₀(1 + q) ÷ 2.14), q the worn food's quantity, or
// 10³ · 10^L for the Gold Food Beanstalk's level L. The 0.05 is the "Base rate (× 0.05)". Invented values.
import { afterEach, expect, test } from "vitest";
import type { RecNode, RecValue } from "../recording.ts";
import { goldFoodTerm } from "./gold-food-chain.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr } from "../recorded/steps.ts";
import { useGameTables } from "../names/table-names.ts";

afterEach(() => {
  useGameTables(new Map());
});

const num = (v: number): Expr => ({ t: "num", v });
const read = (p: string, v: number): Expr => ({ t: "read", p, v });
const op = (o: string, l: Expr, r: Expr, v: number): Expr => ({
  t: "op",
  o,
  l,
  r,
  v,
});
const NODES: RecNode[] = [
  { id: 0, b: "GoldFoodBonuses", a: ["DropRatez"], c: [1, 2], p: null, pxi: 0 },
  // the Beanstalk's log, of 1 + 10³ · 10³ at level 3
  { id: 1, b: "getLOG", a: [1000001], c: [], p: 0, pxi: 0, v: 6 },
  // the worn food's log, of 1 + its quantity 999
  { id: 2, b: "getLOG", a: [1000], c: [], p: 0, pxi: 0, v: 3 },
];
/** A term as a plain row named by its code, so only the term's own rule is under test. */
const term = (e: Expr): Row => ({
  node: row({
    pieceKey: e.t === "read" ? e.p : null,
    value: Number(e.v),
    code: e.t === "read" ? e.p : null,
  }),
  open: null,
});
const MULTI_STEP = {
  v: 2.86,
  e: op("*", read("Stats.set", 1.3), read("Stats.fam", 2.2), 2.86),
};
const inBlock = (e: Expr, more: [string, RecValue][] = []) =>
  goldFoodTerm(e, "*", {
    block: NODES[0] ?? { id: 0, b: "?", a: [], c: [], p: null, pxi: 0 },
    nodes: NODES,
    steps: [MULTI_STEP],
    reads: new Map([["DNSM.FamBonusQTYs[66]", 2], ...more]),
    term,
  });

test("the block's 0.05 is the Base rate (× 0.05), a fixed value", () => {
  const r = inBlock(num(0.05));
  expect([r?.node.name, r?.node.value, r?.node.flags]).toEqual([
    "Base rate (× 0.05)",
    0.05,
    {},
  ]);
});

test("a 0.05 of another block is no Base rate", () => {
  const r = goldFoodTerm(num(0.05), "*", {
    block: { id: 0, b: "Other", a: [], c: [], p: null, pxi: 0 },
    nodes: NODES,
    steps: [],
    reads: new Map(),
    term,
  });
  expect(r).toBeNull();
});

// 19/11: the log₁₀ and the factor 1 + log₁₀(…) ÷ 2.14 are math, no rows: they are in the product's ⓘ, and the product's
// leaves are what goes into them (the worn food's quantity, the Beanstalk's level), the Amount, the Base rate and the
// GFood Multi
const box = read("DNSM.GfoodBonusMULTI", 2.86);
const amountBox = op("*", read("DNSM.GfoodMap.Amount", 7), box, 20.02);
const factorOf = (id: number, log: number) =>
  op(
    "+",
    num(1),
    op("/", { t: "call", id, v: log }, num(2.14), log / 2.14),
    1 + log / 2.14,
  );
const names = (r: Row | null) => r?.group?.map((k) => k.node.name) ?? [];

test("the Beanstalk's product: its leaves and its ⓘ, no row of its log or of its factor", () => {
  const rated = op("*", amountBox, num(0.05), 1.001);
  const logged = op("*", rated, { t: "call", id: 1, v: 6 }, 6.006);
  const v = 6.006 * (1 + 6 / 2.14);
  const r = inBlock(op("*", logged, factorOf(1, 6), v), [["Ninja[104][0]", 3]]);
  expect(names(r).slice(1)).toEqual([
    "GFood Multi",
    "Base rate (× 0.05)",
    "Beanstalk level",
  ]);
  expect(r?.group?.at(-1)?.node.value).toBe(3);
  expect(r?.f?.[0]).toContain("log₁₀(1 + 1000 × 10^Beanstalk level)");
  expect(r?.f?.[0]).toContain(
    "(1 + log₁₀(1 + 1000 × 10^Beanstalk level) ÷ 2.14)",
  );
  expect(r?.f?.[1]).toMatch(/= 22\.8\d*$/);
});

test("the worn food's product: the quantity is its leaf, the Quantity multiplier only its ⓘ", () => {
  const v = 20.02 * (1 + 3 / 2.14);
  const r = inBlock(op("*", amountBox, factorOf(2, 3), v), [
    ["EquipmentQuantity[2][1]", 999],
    ["EquipmentOrder[2][1]", "itemA"],
  ]);
  expect(names(r)).not.toContain("Quantity multiplier");
  expect(names(r).slice(1)).toEqual(["GFood Multi", "Quantity"]);
  expect(r?.group?.at(-1)?.node.value).toBe(999);
  expect(r?.f?.[0]).toContain("(1 + log₁₀(1 + Quantity) ÷ 2.14)");
  expect(r?.f?.[1]).toContain("(1 + log₁₀(1 + 999) ÷ 2.14)");
});
