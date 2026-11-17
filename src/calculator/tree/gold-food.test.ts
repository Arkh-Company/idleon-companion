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
/** The pass's own rows (branches), without the block's checks and data rows that follow them, as any block's. */
const goldRows = (n: CalcTreeNode) => kidsOf(n).filter((k) => k.leaf === null);
const brief = (n: CalcTreeNode | undefined) =>
  kidsOf(n).map((k) => [k.name, k.value, k.leaf, k.fmt, k.flags]);
const near = (v: number): unknown => expect.closeTo(v, 9);
/** Each row as [name, value, leaf]. */
const rowsOf = (n: CalcTreeNode | undefined) =>
  kidsOf(n).map((k) => [k.name, k.value, k.leaf]);
/** The rows under a row that has a code, as [code, value]. */
const sourcesOf = (n: CalcTreeNode | undefined) =>
  kidsOf(n).flatMap((k) => (k.code === null ? [] : [[k.code, k.value]]));
// A golden food whose worn food it reads back (DNSM.GfoodBonus) is a chain (spec 009, FR-005, rule Y of 17/11): the worn
// food's step is a Multi pool, the emporium's an Additive pool, the same sources and values as the pass's rows. A food
// of one step (no worn food, a rounded one, a bonus kept in the block, another read) keeps the pass's rows.
// the multiplier 1.3 × (2 + 0.2); the worn food 7 × it × 0.05 × log(1000) × (1 + log(1009) ÷ 2.14); the emporium's
// 7 × it × 0.05 × log(1 + 10^6)
const MULTI = 2.86;
const WORN = 7.218273444957685;
const EMPORIUM = 6.006000434728559;

test("a golden food: the worn food and the emporium's steps are the chain's pools, with the shared multiplier's sources", () => {
  useGameTables(TABLES);
  const build = buildOf();
  const root = build.root;
  expect(root.value).toBeCloseTo(WORN + EMPORIUM, 9);
  const [worn, emporium] = kidsOf(root);
  expect(brief(root)).toEqual([
    ["Multi pool", near(WORN), null, "x", { closed: true }],
    ["Additive pool", near(EMPORIUM), null, null, { closed: true }],
    // the block's data row (the quantity its log call took) and its checks, as for any block
    ["Food slot 1 quantity", 999, "quantity", null, {}],
    ["Food slot 1 quantity > 0", 0, "condition", null, {}],
    ["Game value", 0, "condition", null, { unnamed: true }],
  ]);
  expect(rowsOf(worn)).toEqual([
    ["Amount of the golden food (item table)", 7, "fixedValue"],
    ["Game value", near(MULTI), null],
    ["Fixed ×0.05", 0.05, "fixedValue"],
    ["log₁₀", near(3), "rawBonus"],
    ["Multiplier", near(2.403687460858369), null],
  ]);
  // the shared multiplier, the step under its variable: its sources and the set's
  expect(sourcesOf(kidsOf(worn)[1])).toEqual([
    ["GfoodSet[0]", 10],
    ["GfoodSet[1]", 20],
    ["DNSM.FamBonusQTYs[66]", 2],
    ["TreeReads()", 8],
    ["TreeBase", 4],
    ["DNSM.GameCache.v", 5],
  ]);
  const [emp] = kidsOf(emporium);
  expect(emp?.value).toBeCloseTo(EMPORIUM, 9);
  expect(
    rowsOf(emp?.kids === "lazy" ? (build.expand(emp.id) ?? undefined) : emp),
  ).toEqual([
    ["Amount of the golden food (item table)", 7, "fixedValue"],
    ["× 0.05", 0.05, "fixedValue"],
    ["log₁₀", near(6.000000434294264), "rawBonus"],
  ]);
  expect(checkTree(root, 100)).not.toBeNull();
});

test("each pool and row of a golden food's chain has the ⓘ of its step", () => {
  useGameTables(TABLES);
  const root = treeOf();
  const [worn, emporium] = kidsOf(root);
  expect(root.formula).toEqual([
    ["Multi pool", "+", "Additive pool"],
    [7.218, 6.006, 13.224],
  ]);
  expect(worn?.formula).toEqual({
    rule: [
      "Amount of the golden food (item table) × Game value × Fixed ×0.05 × log₁₀ × Multiplier",
      "7 × 2.86 × 0.05 × 3 × 2.404 = 7.218",
    ],
  });
  const [, multi, , , factor] = kidsOf(worn);
  // the shared multiplier is the step under its variable, with its sources by name
  const [names, numbers] = Array.isArray(multi?.formula) ? multi.formula : [];
  expect([names?.join(" "), numbers]).toEqual([
    "( 1 + ( ( GfoodSet[0] + GfoodSet[1] ) ÷ 100 ) ) × ( max ( DNSM.FamBonusQTYs[66] , 1 ) + ( ( ( ( TreeReads() + TreeBase ) + DNSM.GameCache.v ) + 3 ) ÷ 100 ) )",
    [1, 10, 20, 100, 2, 1, 8, 4, 5, 3, 100, 2.86],
  ]);
  expect(factor?.formula).toEqual({
    rule: ["1 + (log₁₀ ÷ 2.14)", "1 + (3.004 ÷ 2.14) = 2.404"],
  });
  const multiOf =
    "(1 + ((GfoodSet[0] + GfoodSet[1]) ÷ 100)) × (max(DNSM.FamBonusQTYs[66], 1) + ((((TreeReads() + TreeBase) + DNSM.GameCache.v) + 3) ÷ 100))";
  const numsOf =
    "(1 + ((10 + 20) ÷ 100)) × (max(2, 1) + ((((8 + 4) + 5) + 3) ÷ 100))";
  expect(kidsOf(emporium)[0]?.formula).toEqual({
    rule: [
      `((Amount of the golden food × (${multiOf})) × 0.05) × log₁₀`,
      `((7 × (${numsOf})) × 0.05) × 6 = 6.006`,
    ],
  });
});

test("the shared multiplier counts a family below 1 as 1; a step whose family is at least 2 is the chain's own pool", () => {
  const [worn] = kidsOf(treeOf("DropRatez", 999, 3, 0));
  const multi = kidsOf(worn)[1];
  expect(multi?.value).toBeCloseTo(1.56, 9);
  expect(Array.isArray(multi?.formula) && multi.formula[1]).toEqual([
    1, 10, 20, 100, 0, 1, 8, 4, 5, 3, 100, 1.56,
  ]);
  // the multiplier read back as a value of its step: the set, then max(family, 2) + the sources ÷ 100, as pools
  const pools = kidsOf(treeOf("atTwo", 999, 3, 0));
  expect(pools.slice(0, 2).map((p) => [p.name, p.value])).toEqual([
    ["Multi pool 1", near(1.3)],
    ["Additive pool 1", near(2.2)],
  ]);
  expect(rowsOf(kidsOf(pools[1])[0])).toEqual([
    ["Working value of the game (FamBonusQTYs)", 0, "unknown"],
    ["Minimum 2", 2, "fixedValue"],
  ]);
});

test("sources taken as a percent by a product are a product of their sum by 0.01, in the chain's pool", () => {
  const [, add] = kidsOf(treeOf("percent"));
  expect([add?.name, add?.value]).toEqual(["Additive pool 1", near(2.2)]);
  const [family, sources] = kidsOf(add);
  expect([family?.code, family?.value]).toEqual(["DNSM.FamBonusQTYs[66]", 2]);
  expect(sources?.value).toBeCloseTo(0.2, 9);
  expect(sourcesOf(sources)).toEqual([
    ["TreeReads()", 8],
    ["TreeBase", 4],
    ["DNSM.GameCache.v", 5],
  ]);
  expect(Array.isArray(sources?.formula) && sources.formula[0].at(-1)).toBe(
    "0.01",
  );
});

test("a set of one part is the chain's first pool, with its ⓘ; one written with its number last too", () => {
  const set = (key: string) => kidsOf(kidsOf(treeOf(key))[0])[0];
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

test.each<[string, string, number, number, [string, number][]]>([
  [
    "no worn food: the emporium's adds to nothing",
    "DropRatez",
    0,
    3,
    [["Emporium: Other Dish", EMPORIUM]],
  ],
  [
    "a worn food rounded is no worn food's step",
    "round",
    999,
    3,
    [["Emporium: Other Dish", Math.round(WORN) + EMPORIUM]],
  ],
  [
    "a bonus kept in the block: the emporium's adds to the worn food's step",
    "local",
    999,
    3,
    [
      ["Equipped: Invented Charm", WORN],
      ["Emporium: Other Dish", EMPORIUM],
    ],
  ],
  [
    "the emporium's added to another read: it adds to the worn food's step",
    "other",
    999,
    3,
    [
      ["Equipped: Invented Charm", WORN],
      ["Emporium: Other Dish", 9 + EMPORIUM - WORN],
    ],
  ],
  [
    "the emporium's added to another read with no worn food: it adds to nothing",
    "other",
    0,
    3,
    [["Emporium: Other Dish", 9 + EMPORIUM]],
  ],
  [
    "the emporium's times 1 is no sum: no emporium row",
    "scaled",
    999,
    3,
    [["Equipped: Invented Charm", WORN]],
  ],
])("%s", (_name, key, quantity, level, rows) => {
  useGameTables(TABLES);
  expect(
    goldRows(treeOf(key, quantity, level)).map((k) => [k.name, k.value]),
  ).toEqual([
    ["GFood Multi", near(MULTI)],
    ...rows.map(([n, v]) => [n, near(v)]),
  ]);
});

// the foods whose worn food is read back: a chain, the worn food's Multi pool (when there is one), then the sum's
test.each<[string, string, number, number[]]>([
  ["no emporium level: the emporium's pool is 0", "DropRatez", 0, [WORN, 0]],
  ["a worn food added to the bonus is one sum", "added", 0, [WORN]],
  ["the emporium's log inside a max", "inFn", 3, [WORN, EMPORIUM]],
  ["the emporium's twice, in one pool", "twice", 3, [WORN, EMPORIUM * 1.2]],
])("%s", (_name, key, level, values) => {
  useGameTables(TABLES);
  const names = values.length > 1 ? ["Multi pool"] : [];
  expect(
    kidsOf(treeOf(key, 999, level))
      .filter((k) => k.role === "pool")
      .map((k) => [k.name, k.value]),
  ).toEqual(values.map((v, i) => [names[i] ?? "Additive pool", near(v)]));
});

test("a source at 0 stays in its place in the shared multiplier, and its ⓘ still names it (spec 009, FR-016)", () => {
  const [worn] = kidsOf(treeOf("DropRatez", 999, 3, 2, 0));
  const multi = kidsOf(worn)[1];
  expect(sourcesOf(multi)).toEqual([
    ["GfoodSet[0]", 10],
    ["GfoodSet[1]", 20],
    ["DNSM.FamBonusQTYs[66]", 2],
    ["TreeReads()", 8],
    ["TreeBase", 4],
    ["DNSM.GameCache.v", 0],
  ]);
  expect(Array.isArray(multi?.formula) && multi.formula).toEqual([
    expect.arrayContaining(["DNSM.GameCache.v"]),
    [1, 10, 20, 100, 2, 1, 8, 4, 0, 3, 100, 2.795],
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
