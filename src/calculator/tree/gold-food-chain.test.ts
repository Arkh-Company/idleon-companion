// A golden food's terms by their role (tree/gold-food-chain.ts; spec 009 FR-017, the decision of 17/11): the shared
// multiplier inside the emporium's term is "GFood Multi", with no rows of its own, since its sources are in the chain's
// pools. The game keeps it in a box the emporium's term reads back (N.js GoldFoodBonuses); the invented game keeps it
// in a variable (gold-food-branch.test.ts).
import { afterEach, expect, test } from "vitest";
import type { RecNode, RecValue } from "../recording.ts";
import { chainContext } from "./chain-context.ts";
import { TABLES } from "./gold-food-fixture.ts";
import { goldFoodTerm } from "./gold-food-chain.ts";
import { chainPools } from "./pools.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr } from "./steps.ts";
import type { Terms } from "./terms.ts";
import { useGameTables } from "./table-names.ts";

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

/** The shared multiplier's step, 1.3 × (2 + 20 ÷ 100), and the block that has it. */
const MULTI_STEP = {
  v: 2.86,
  e: op(
    "*",
    read("Stats.set", 1.3),
    op(
      "+",
      num(2),
      op(
        "/",
        op("+", read("Stats.a", 12), read("Stats.b", 8), 20),
        num(100),
        0.2,
      ),
      2.2,
    ),
    2.86,
  ),
};
const inBlock = (e: Expr, more: [string, RecValue][] = []) =>
  goldFoodTerm(e, "+", {
    block: nodes[0] ?? { id: 0, b: "?", a: [], c: [], p: null, pxi: 0 },
    nodes,
    steps: [MULTI_STEP],
    reads: new Map([["DNSM.FamBonusQTYs[66]", 2], ...more]),
    term,
  });
const isShared = (r: Row | null | undefined) => {
  expect(r?.node).toMatchObject({
    name: "GFood Multi",
    value: 2.86,
    code: null,
    pieceKey: null,
    kids: [],
  });
  expect(r?.open).toBeNull();
  expect(r?.group ?? []).toEqual([]);
  expect(r?.node.formula).not.toBeNull();
};

test("[FR-017] the box of the shared multiplier read on its own is the chain's working value: left to the chain, never a row here", () => {
  // the chain follows that read into the step that made it, and its sources become the chain's first pools; a row
  // here would end the chain there and lose them (009 T023 r2, measured on the Drop Rate)
  expect(inBlock(read("DNSM.GfoodBonusMULTI", 2.86))).toBeNull();
});

test("[FR-017] the worn food's product, its log only inside the quantity factor: the shared multiplier is GFood Multi, the row the worn food's", () => {
  // 7 × the box × (1 + log₁₀(1009) ÷ 2.14)
  const factor = op(
    "+",
    num(1),
    op("/", { t: "call", id: 1, v: 3 }, num(2.14), 1.402),
    2.402,
  );
  const worn = op(
    "*",
    op(
      "*",
      read("DNSM.GfoodMap.Amount", 7),
      read("DNSM.GfoodBonusMULTI", 2.86),
      20.02,
    ),
    factor,
    48.09,
  );
  useGameTables(TABLES);
  const r = inBlock(worn, [
    ["EquipmentQuantity[2][1]", 999],
    ["EquipmentOrder[2][1]", "itemA"],
  ]);
  isShared(r?.group?.find((k) => k.node.name === "GFood Multi"));
  // the worn food's, named as in the pass (tree/gold-food.ts), never the emporium's (009 T023 r3)
  expect(r?.node.name).toBe("Equipped: Invented Charm");
});

test("[FR-017] a step that reads the shared multiplier back from its box: the chain follows the read, and its first pools are the set's and the family's", () => {
  // the worn food's step, 7 × the box × (1 + log₁₀(1009) ÷ 2.14), after the multiplier's; the box is the block's own
  // working value (its writer is the block), the read the chain follows (chain-context.ts ownCache, pools.ts prevOf)
  const log = 3 / 2.14;
  const worn = op(
    "*",
    op(
      "*",
      read("DNSM.GfoodMap.Amount", 7),
      read("DNSM.GfoodBonusMULTI", 2.86),
      7 * 2.86,
    ),
    op(
      "+",
      num(1),
      op("/", { t: "call", id: 1, v: 3 }, num(2.14), log),
      1 + log,
    ),
    7 * 2.86 * (1 + log),
  );
  const own = (e: Expr): Row | null => {
    const r = term(e);
    return e.t === "read" && e.p === "DNSM.GfoodBonusMULTI"
      ? {
          ...r,
          open: { path: e.p, value: 2.86, writer: 0, entry: null, opening: [] },
        }
      : r;
  };
  const block = {
    ...(nodes[0] ?? { id: 0, b: "?", a: [], c: [], p: null, pxi: 0 }),
    v: worn.v,
  };
  const ctx = chainContext(
    {
      nodes,
      steps: () => [MULTI_STEP, { v: Number(worn.v), e: worn }],
      terms: () => ({ term: own }) as unknown as Terms,
      turns: () => [],
      opened: () => null,
    },
    block,
    0,
    new Set(),
  );
  const pools = chainPools(
    ctx.steps ?? [],
    { value: Number(worn.v) },
    ctx.termAt ?? (() => null),
    ctx.ownCache,
  );
  const codes = (i: number) =>
    Array.isArray(pools) ? pools[i]?.rows.map((r) => r.node.code) : pools;
  // the set's bonus, then the family (the 2) and the sources it adds
  expect([codes(0), codes(1)]).toEqual([
    ["Stats.set"],
    [null, "Stats.a", "Stats.b"],
  ]);
});
