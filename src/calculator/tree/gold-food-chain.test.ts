// A golden food's terms by their role (tree/gold-food-chain.ts; spec 009 FR-017, the decision of 17/11): the shared
// multiplier inside the emporium's term is "GFood Multi", with no rows of its own, since its sources are in the chain's
// pools. The game keeps it in a box the emporium's term reads back (N.js GoldFoodBonuses); the invented game keeps it
// in a variable (gold-food-branch.test.ts).
import { expect, test } from "vitest";
import type { RecNode } from "../recording.ts";
import { goldFoodTerm } from "./gold-food-chain.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr } from "./steps.ts";

const num = (v: number): Expr => ({ t: "num", v });
const read = (p: string, v: number): Expr => ({ t: "read", p, v });
const op = (o: string, l: Expr, r: Expr, v: number): Expr => ({
  t: "op",
  o,
  l,
  r,
  v,
});
const nodes: RecNode[] = [
  { id: 0, b: "GoldFoodBonuses", a: ["DropRatez"], c: [1], p: null, pxi: 0 },
  { id: 1, b: "getLOG", a: [1000001], c: [], p: 0, pxi: 0, v: 6 },
];
/** A term as a plain row named by its code, so only the term's own rule is under test. */
const term = (e: Expr): Row => ({
  node: row({
    pieceKey: e.t === "read" ? e.p : null,
    value: Number(e.v),
    code: e.t === "read" ? e.p : null,
    kids: e.t === "read" ? "lazy" : [],
  }),
  open: e.t === "read" ? 9 : null,
});

test("[FR-017] the emporium's term that reads the shared multiplier back from its box: GFood Multi, no rows of its own, its ⓘ", () => {
  // the multiplier 1.3 × (2 + 20 ÷ 100), a step of the block; the emporium's 7 × it × 0.05 × log₁₀(1 + 10^6)
  const sources = op("+", read("Stats.a", 12), read("Stats.b", 8), 20);
  const multi = op(
    "*",
    read("Stats.set", 1.3),
    op("+", num(2), op("/", sources, num(100), 0.2), 2.2),
    2.86,
  );
  const emporium = op(
    "*",
    op(
      "*",
      op(
        "*",
        read("DNSM.GfoodMap.Amount", 7),
        read("DNSM.GfoodBonusMULTI", 2.86),
        20.02,
      ),
      num(0.05),
      1.001,
    ),
    { t: "call", id: 1, v: 6 },
    6.006,
  );
  const r = goldFoodTerm(emporium, "+", {
    block: nodes[0] ?? { id: 0, b: "?", a: [], c: [], p: null, pxi: 0 },
    nodes,
    steps: [{ v: 2.86, e: multi }],
    reads: new Map([["DNSM.FamBonusQTYs[66]", 2]]),
    term,
  });
  const shared = r?.group?.find((k) => k.node.name === "GFood Multi");
  expect(shared?.node).toMatchObject({
    value: 2.86,
    code: null,
    pieceKey: null,
    kids: [],
  });
  expect(shared?.open).toBeNull();
  expect(shared?.group ?? []).toEqual([]);
  expect(shared?.node.formula).not.toBeNull();
  // the box's read is no row of the term: the multiplier is
  expect(r?.group?.map((k) => k.node.code)).not.toContain(
    "DNSM.GfoodBonusMULTI",
  );
});
