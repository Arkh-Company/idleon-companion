// Golden Food (pieces.cjs explainRaw goldFood at BASELINE-4) over recordings of the invented game's GoldFoodBonuses
// (fake-game.js): the shared multiplier, the worn food and the emporium's, each with the ⓘ of its step. The block's key
// picks how a step is written. The foods' texts are invented tables in the bench's canonical form (table-names.ts); no
// text of the game is in this file.
import { afterEach, beforeAll, expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { GAME, PAK } from "../fixtures/fake-mosaic.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { buildTree } from "../tree-build.ts";
import { bootRecorder } from "../tree-record.ts";
import { sourceTerm } from "./gold-food.ts";
import { golden, TABLES } from "./gold-food-fixture.ts";
import { row } from "./rows.ts";
import { useGameTables } from "./table-names.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});
afterEach(() => {
  useGameTables(new Map());
});

const buildOf = (
  key = "DropRatez",
  quantity = 999,
  level = 3,
  family = 2,
  cache = 5,
) =>
  buildTree(
    recorder.record(
      golden(quantity, level, family, cache),
      [["GoldFoodBonuses", [key]]],
      { recompute: [], builders: [] },
    ),
    0,
    recorder.ops,
  );
const treeOf = (...args: Parameters<typeof buildOf>) => buildOf(...args).root;
const kidsOf = (n: CalcTreeNode | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];
const brief = (n: CalcTreeNode | undefined) =>
  kidsOf(n).map((k) => [k.name, k.value, k.leaf, k.fmt, k.flags]);
const near = (v: number): unknown => expect.closeTo(v, 9);
/** Each row as [name, value, leaf]. */
const rowsOf = (n: CalcTreeNode | undefined) =>
  kidsOf(n).map((k) => [k.name, k.value, k.leaf]);
/** The rows under a row that has a code, as [code, value]. */
const sourcesOf = (n: CalcTreeNode | undefined) =>
  kidsOf(n).flatMap((k) => (k.code === null ? [] : [[k.code, k.value]]));
// A golden food whose worn food it reads back (DNSM.GfoodBonus) is a chain (spec 009, FR-005, rule Y of 17/11), back to
// its shared multiplier, which the block keeps in a variable (FR-017, 009 r1): the set's Multi pool, the family and the
// sources' Additive pool, the worn food's own numbers in a Multi pool, the emporium's Additive pool; the same sources and
// values as the pass's rows. A food of one step (no worn food, a rounded one, a bonus kept in the block, another read)
// keeps the pass's rows.
// the multiplier 1.3 × (2 + 0.2); the worn food 7 × it × 0.05 × log(1000) × (1 + log(1000) ÷ 2.14); the emporium's
// 7 × it × 0.05 × log(1 + 10^6)
const MULTI = 2.86;
const WORN = 7.212813084112149;
const EMPORIUM = 6.006000434728559;

test("a golden food: its shared multiplier's, its worn food's and the emporium's steps are the chain's pools, with the same sources", () => {
  useGameTables(TABLES);
  const build = buildOf();
  const root = build.root;
  expect(root.value).toBeCloseTo(WORN + EMPORIUM, 9);
  const [set, family, worn, emporium] = kidsOf(root);
  expect(brief(root)).toEqual([
    ["Multi pool 1", near(1.3), null, "x", { closed: true }],
    ["Additive pool", near(2.2), null, null, { closed: true }],
    ["Multi pool 2", near(WORN / MULTI), null, "x", { closed: true }],
    // the emporium's lone + is its own row, no pool (decision of 19/11)
    ["Emporium: Other Dish", near(EMPORIUM), null, "+", {}],
    // the block's data row (the quantity its log call took) and its checks, as for any block; the check of the
    // quantity beside it is said in the root's ⓘ, no row (A39, Vinicius's answer of 19/11)
    ["Food slot 1 quantity", 999, "quantity", null, {}],
    ["Game value", 0, "condition", null, { unnamed: true }],
  ]);
  // the worn food's own numbers: no row of the shared multiplier among them (FR-007)
  expect(rowsOf(worn)).toEqual([
    ["Amount of the golden food (item table)", 7, "fixedValue"],
    ["Fixed ×0.05", 0.05, "fixedValue"],
    ["log₁₀", near(3), "rawBonus"],
    ["Quantity multiplier", near(2.4018691588785046), null],
  ]);
  // the shared multiplier's pools: the set's bonuses, one row each; the family, and the sources in % by system
  expect(sourcesOf(set)).toEqual([
    ["GfoodSet[0]", 10],
    ["GfoodSet[1]", 20],
  ]);
  // every source in "Other": no "🔹 Other" group beside a "🔹 Other" group in %, the sources in % the pool's own rows,
  // each as its +N%, that still add 0.2 to it (A34, option B of Vinicius's answer)
  const [fam, ...other] = kidsOf(family);
  expect([fam?.code, fam?.value]).toEqual(["DNSM.FamBonusQTYs[66]", 2]);
  expect(other.map((k) => k.fmt)).toEqual(["%", "%", "%", "%"]);
  expect(other.reduce((a, k) => a + Number(k.value), 0) / 100).toBeCloseTo(
    0.2,
    9,
  );
  expect(
    other.flatMap((k) => (k.code === null ? [] : [[k.code, k.value]])),
  ).toEqual([
    ["TreeReads()", 8],
    ["TreeBase", 4],
    ["DNSM.GameCache.v", 5],
  ]);
  // the emporium's row: its food's name, and its parts with the shared multiplier, which multiply to it (FR-007, FR-008)
  // the emporium's lone + is its row (decision of 19/11)
  const emp = emporium;
  expect([emp?.name, emp?.value]).toEqual([
    "Emporium: Other Dish",
    near(EMPORIUM),
  ]);
  const parts = kidsOf(
    emp?.kids === "lazy" ? (build.expand(emp.id) ?? undefined) : emp,
  );
  // each part with its name, value and type; the shared multiplier a value its own steps prove, never a "?"
  expect(parts.map((k) => [k.name, k.value, k.leaf, k.why])).toEqual([
    ["Amount of the golden food (item table)", 7, "fixedValue", null],
    ["GFood Multi", near(MULTI), null, null],
    ["Fixed ×0.05", 0.05, "fixedValue", null],
    ["log₁₀", near(6.000000434294264), "rawBonus", null],
  ]);
  expect(parts[1]?.formula).toEqual({
    rule: [
      "SECRET_SET multi × (max(Family Bonus 66, 1) + Sources ÷ 100)",
      "1.3 × (2 + 0.2) = 2.86",
    ],
  });
  expect(parts.reduce((p, k) => p * Number(k.value), 1)).toBeCloseTo(
    EMPORIUM,
    9,
  );
  expect(checkTree(root, 100)).not.toBeNull();
});

test("each pool and row of a golden food's chain has the ⓘ of its step", () => {
  useGameTables(TABLES);
  const root = treeOf();
  const [set, family, worn, emporium] = kidsOf(root);
  // the pools' chain, then the check beside them in words: a rule, its result the root's value (A39)
  expect(root.formula).toEqual({
    rule: [
      "Multi pool 1 × Additive pool × Multi pool 2 + Emporium: Other Dish (Food slot 1 quantity > 0: no)",
      "1.3 × 2.2 × 2.522 + 6.006 = 13.219",
    ],
  });
  expect(worn?.formula).toEqual({
    rule: [
      "Amount of the golden food (item table) × Fixed ×0.05 × log₁₀ × Quantity multiplier",
      "7 × 0.05 × 3 × 2.402 = 2.522",
    ],
  });
  const [, , , factor] = kidsOf(worn);
  // the shared multiplier, by its pools: the set's 1 + (bonuses) ÷ 100, the family + the sources ÷ 100
  expect(set?.formula).toEqual([
    ["1", "+", "(", "GfoodSet[0]", "+", "GfoodSet[1]", ")", "÷", "100"],
    [1, 10, 20, 100, 1.3],
  ]);
  // every source in "Other", no group in %: the pool's ⓘ writes each source in % in its row's unit, +8% as 8 ÷ 100
  // (A34, option B, as family 21), and still closes (FR-008)
  expect(family?.formula).toEqual([
    [
      "DNSM.FamBonusQTYs[66]",
      "+",
      "TreeReads()",
      "÷",
      "100",
      "+",
      "TreeBase",
      "÷",
      "100",
      "+",
      "DNSM.GameCache.v",
      "÷",
      "100",
      "+",
      "Fixed +3",
      "÷",
      "100",
    ],
    [2, 8, 100, 4, 100, 5, 100, 3, 100, 2.2],
  ]);
  // the worn food's quantity factor, named by its role, with the quantity in its ⓘ (FR-007), as N.js writes it:
  // 1 + getLOG(1 + quantity) ÷ 2.14 (009 T023 r4)
  expect(factor?.formula).toEqual([
    ["1", "+", "log₁₀", "(", "1", "+", "quantity", ")", "÷", "2.14"],
    [1, 1, 999, 2.14, 2.402],
  ]);
  // the emporium's: its parts' product, the shared multiplier among them
  expect(emporium?.formula).toEqual({
    rule: [
      "Amount of the golden food × GFood Multi × 0.05 × log₁₀",
      "7 × 2.86 × 0.05 × 6 = 6.006",
    ],
  });
});

test("the shared multiplier counts a family below 1 as 1; a step whose family is at least 2 is the chain's own pool", () => {
  // 1.3 × (max(0, 1) + 0.2) = 1.56, by its pools
  const [set, family] = kidsOf(treeOf("DropRatez", 999, 3, 0));
  expect(Number(set?.value) * Number(family?.value)).toBeCloseTo(1.56, 9);
  // under it, the read without the name the row above says (the 008's rename by the row above) and its minimum
  expect(rowsOf(kidsOf(family)[0])).toEqual([
    ["Working value of the game", 0, "unknown"],
    ["Minimum 1", 1, "fixedValue"],
  ]);
  // max(family, 1) is the family's row, with its read's name and code, never a row with no name (FR-007)
  const fam = kidsOf(family)[0];
  expect([fam?.code, fam?.name, fam?.value]).toEqual([
    "DNSM.FamBonusQTYs[66]",
    "Working value of the game (FamBonusQTYs)",
    1,
  ]);
  // every source in "Other", no group in %: each source in % in its row's unit, +8% as 8 ÷ 100 (A34, option B)
  expect(family?.formula).toEqual([
    [
      "DNSM.FamBonusQTYs[66]",
      "+",
      "TreeReads()",
      "÷",
      "100",
      "+",
      "TreeBase",
      "÷",
      "100",
      "+",
      "DNSM.GameCache.v",
      "÷",
      "100",
      "+",
      "Fixed +3",
      "÷",
      "100",
    ],
    [1, 8, 100, 4, 100, 5, 100, 3, 100, 1.2],
  ]);
  // the multiplier read back as a value of its step: the set, then max(family, 2) + the sources ÷ 100, as pools
  const pools = kidsOf(treeOf("atTwo", 999, 3, 0));
  expect(pools.slice(0, 2).map((p) => [p.name, p.value])).toEqual([
    ["Multi pool 1", near(1.3)],
    ["Additive pool", near(2.2)],
  ]);
  expect(rowsOf(kidsOf(pools[1])[0])).toEqual([
    ["Working value of the game", 0, "unknown"],
    ["Minimum 2", 2, "fixedValue"],
  ]);
  expect(kidsOf(pools[1])[0]?.code).toBe("DNSM.FamBonusQTYs[66]");
});

test("sources taken as a percent by a product are a product of their sum by 0.01, in the chain's pool", () => {
  const [, add] = kidsOf(treeOf("percent"));
  expect([add?.name, add?.value]).toEqual(["Additive pool", near(2.2)]);
  const [family, ...sources] = kidsOf(add);
  expect([family?.code, family?.value]).toEqual(["DNSM.FamBonusQTYs[66]", 2]);
  // the product of their sum by 0.01 has no name: no row (FR-017), its sources rows of the pool, its math in the
  // pool's ⓘ, which closes (FR-008)
  expect(sources.slice(0, 3).map((k) => [k.code, k.value])).toEqual([
    ["TreeReads()", 8],
    ["TreeBase", 4],
    ["DNSM.GameCache.v", 5],
  ]);
  expect(Array.isArray(add?.formula) && add.formula[0].slice(-3)).toEqual([
    "×",
    "0.01",
    ")",
  ]);
  expect(Array.isArray(add?.formula) && add.formula[1].at(-1)).toBeCloseTo(
    2.2,
    9,
  );
});

test("a set of one part is the chain's first row, with its ⓘ; one written with its number last too", () => {
  // the single multiplier alone in its Multi pool is its own × N row, no pool (answer 2 of 19/11)
  const set = (key: string) => kidsOf(treeOf(key))[0];
  expect(set("oneSet")?.role).toBe("piece");
  const one = set("oneSet");
  expect(sourcesOf(one)).toEqual([["GfoodSet[0]", 10]]);
  expect(one?.formula).toEqual([
    ["1", "+", "(", "GfoodSet[0]", "÷", "100", ")"],
    [1, 10, 100, 1.1],
  ]);
  const last = set("setLast");
  const [lastNames, lastNumbers] = Array.isArray(last?.formula)
    ? last.formula
    : [];
  expect([last?.value, lastNames?.join(" "), lastNumbers]).toEqual([
    near(1.1),
    "( GfoodSet[0] ÷ 100 ) + 1",
    [10, 100, 1, 1.1],
  ]);
});

test("a source at 0 stays in its place in the shared multiplier, and its ⓘ still names it (spec 009, FR-016)", () => {
  // every source in "Other": the sources in % are the family pool's own rows, no group (A34, option B)
  const [, family] = kidsOf(treeOf("DropRatez", 999, 3, 2, 0));
  expect(sourcesOf(family).slice(1)).toEqual([
    ["TreeReads()", 8],
    ["TreeBase", 4],
    ["DNSM.GameCache.v", 0],
  ]);
  expect(family?.formula).toEqual([
    [
      "DNSM.FamBonusQTYs[66]",
      "+",
      "TreeReads()",
      "÷",
      "100",
      "+",
      "TreeBase",
      "÷",
      "100",
      "+",
      "DNSM.GameCache.v",
      "÷",
      "100",
      "+",
      "Fixed +3",
      "÷",
      "100",
    ],
    [2, 8, 100, 4, 100, 0, 100, 3, 100, 2.15],
  ]);
});

test("a source in the sources' ⓘ is its name without its tag, or its code with no name", () => {
  const source = (name: string | undefined, code: string) => ({
    node: row({ pieceKey: null, value: 1, code, ...(name ? { name } : {}) }),
    open: null,
  });
  expect(sourceTerm(source("Invented bonus (Invented tab)", "A.b"))).toBe(
    "Invented bonus",
  );
  expect(sourceTerm(source(undefined, "A.b()"))).toBe("A.b()");
});

test("another block with the same steps is no golden food", () => {
  useGameTables(TABLES);
  const rec = recorder.record(
    golden(999, 3, 2, 5),
    [["GoldFoodBonuses", ["DropRatez"]]],
    { recompute: [], builders: [] },
  );
  const other = {
    ...rec,
    nodes: rec.nodes.map((n) =>
      n.b === "GoldFoodBonuses" ? { ...n, b: "InventedBonuses" } : n,
    ),
  };
  const names = kidsOf(buildTree(other, 0, recorder.ops).root).map(
    (k) => k.name,
  );
  expect(names).not.toContain("GFood Multi");
});

test("a block of fewer than four steps is no golden food", () => {
  useGameTables(TABLES);
  const names = kidsOf(treeOf("DropRatez", 999, -1)).map((k) => k.name);
  expect(names).not.toContain("GFood Multi");
  expect(names).not.toContain("Equipped: Invented Charm");
});
