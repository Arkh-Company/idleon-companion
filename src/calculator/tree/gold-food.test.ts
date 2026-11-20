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
/** An ⓘ as its two lines, the names and the numbers, from its atoms or its rule. */
const linesOf = (f: CalcTreeNode["formula"] | undefined): string[] =>
  Array.isArray(f) ? [f[0].join(" "), f[1].join(" ")] : f ? [...f.rule] : [];
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
    // the set's pool, alone of its kind once the worn food's step is a row (answer 2 of 19/11)
    ["Multi pool", near(1.3), null, "x", { closed: true }],
    ["Additive pool", near(2.2), null, null, { closed: true }],
    // the worn food's step is one row, no pool of a row per factor: its log₁₀ and its quantity factor are math, in
    // its ⓘ only (the rule of 19/11), and a single multiplier alone in its pool is its own × N row (answer 2 of 19/11)
    ["Equipped: Invented Charm", near(WORN / MULTI), null, "x", {}],
    // the emporium's lone + is its own row, no pool (decision of 19/11)
    ["Beanstalk: Other Dish", near(EMPORIUM), null, "+", {}],
    // the block's data row (the quantity its log call took) and its checks, as for any block; the check of the
    // quantity beside it is said in the root's ⓘ, no row (A39, Vinicius's answer of 19/11)
    ["Food slot 1 quantity", 999, "quantity", null, {}],
    ["Game value", 0, "condition", null, { unnamed: true }],
  ]);
  // the worn food's own numbers: no row of the shared multiplier among them (FR-007); its leaves what goes into its
  // math, the quantity for its log₁₀ and its quantity factor, which are no rows (19/11)
  expect(rowsOf(worn)).toEqual([
    ["Amount of the golden food (item table)", 7, "fixedValue"],
    ["Base rate (× 0.05)", 0.05, "fixedValue"],
    ["Quantity", 999, "quantity"],
  ]);
  // the shared multiplier's pools: the set's bonuses, one row each; the family, and the sources in % by system
  expect(sourcesOf(set)).toEqual([
    ["GfoodSet[0]", 10],
    ["GfoodSet[1]", 20],
  ]);
  // the family is a system of its own, in its group "👪 Family Bonuses" (fix tree-shape-091, rule 1), so the other
  // sources are a "🔹 Other" group in %, its rows the sources, adding 0.2 (FR-005; A34's option B is only for a pool all
  // of whose groups are "Other")
  const [families, other] = kidsOf(family);
  expect([families?.name, families?.role, families?.value]).toEqual([
    "👪 Family Bonuses",
    "system",
    2,
  ]);
  const [fam] = kidsOf(families);
  expect([fam?.code, fam?.value]).toEqual(["DNSM.FamBonusQTYs[66]", 2]);
  expect([other?.name, other?.combine, other?.value]).toEqual([
    "🔹 Other",
    "percent",
    near(0.2),
  ]);
  expect(sourcesOf(other)).toEqual([
    ["TreeReads()", 8],
    ["TreeBase", 4],
    ["DNSM.GameCache.v", 5],
  ]);
  // the emporium's row: its food's name, and its parts with the shared multiplier, which multiply to it (FR-007, FR-008)
  // the emporium's lone + is its row (decision of 19/11)
  const emp = emporium;
  expect([emp?.name, emp?.value]).toEqual([
    "Beanstalk: Other Dish",
    near(EMPORIUM),
  ]);
  const parts = kidsOf(
    emp?.kids === "lazy" ? (build.expand(emp.id) ?? undefined) : emp,
  );
  // each part with its name, value and type; the shared multiplier a value its own steps prove, never a "?"
  expect(parts.map((k) => [k.name, k.value, k.leaf, k.why])).toEqual([
    ["Amount of the golden food (item table)", 7, "fixedValue", null],
    ["GFood Multi", near(MULTI), null, null],
    ["Base rate (× 0.05)", 0.05, "fixedValue", null],
    ["Beanstalk level", 3, "level", null],
  ]);
  expect(parts[1]?.formula).toEqual({
    rule: [
      "SECRET_SET multi × (max(Invented Family, 1) + Sources ÷ 100)",
      "1.3 × (2 + 0.2) = 2.86",
    ],
  });
  const empF = emp?.formula as [string[], number[]]; // 19/11: log₁₀ in the ⓘ
  expect(empF[1].at(-1)).toBeCloseTo(6.006, 3);
  expect(checkTree(root, 100)).not.toBeNull();
});

test("each pool and row of a golden food's chain has the ⓘ of its step", () => {
  useGameTables(TABLES);
  const root = treeOf();
  const [set, family, worn, emporium] = kidsOf(root);
  // the pools' chain, then the check beside them in words: a rule, its result the root's value (A39)
  expect(root.formula).toEqual({
    rule: [
      "Multi pool × Additive pool × Equipped: Invented Charm + Beanstalk: Other Dish (Food slot 1 quantity > 0: no)",
      "1.3 × 2.2 × 2.522 + 6.006 = 13.219",
    ],
  });
  // the worn food's step: the whole product, its log₁₀ and its quantity factor of 1 + the quantity as N.js writes them,
  // 1 + getLOG(1 + quantity) ÷ 2.14 (009 T023 r4), the quantity its leaf (FR-007, the rule of 19/11), closing (FR-008)
  expect(linesOf(worn?.formula)).toEqual([
    "Amount of the golden food × Base rate × log₁₀ ( 1 + Quantity ) × ( 1 + log₁₀ ( 1 + Quantity ) ÷ 2.14 )",
    "7 0.05 1 999 1 1 999 2.14 2.522",
  ]);
  // the shared multiplier, by its pools: the set's 1 + (bonuses) ÷ 100, the family + the sources ÷ 100
  expect(set?.formula).toEqual([
    ["1", "+", "(", "GfoodSet[0]", "+", "GfoodSet[1]", ")", "÷", "100"],
    [1, 10, 20, 100, 1.3],
  ]);
  // the family's group of its one source (fix tree-shape-091, rule 1) + the "🔹 Other" group in %, written in its rows'
  // unit with its ÷ 100, its own ⓘ its sources' sum ÷ 100
  expect(family?.formula).toEqual([
    ["👪 Family Bonuses", "+", "🔹 Other", "÷", "100"],
    [2, 20, 100, 2.2],
  ]);
  expect(kidsOf(family)[1]?.formula).toEqual({
    rule: [
      "(TreeReads() + TreeBase + DNSM.GameCache.v + Fixed +3) ÷ 100",
      "(8 + 4 + 5 + 3) ÷ 100 = 0.2",
    ],
  });
  // the emporium's: its parts and its log₁₀ of 1 + 1000 × 10^level, the Beanstalk's level its leaf (19/11)
  const [words, numbers] = (emporium?.formula ?? [[], []]) as [
    string[],
    number[],
  ];
  expect([words.join(" "), numbers]).toEqual([
    "Amount of the golden food × GFood Multi × Base rate × log₁₀ ( 1 + 1000 × 10 ^ Beanstalk level )",
    [7, 2.86, 0.05, 1, 1000, 10, 3, 6.006],
  ]);
});

test("the shared multiplier counts a family below 1 as 1; a step whose family is at least 2 is the chain's own pool", () => {
  // 1.3 × (max(0, 1) + 0.2) = 1.56, by its pools
  const [set, family] = kidsOf(treeOf("DropRatez", 999, 3, 0));
  expect(Number(set?.value) * Number(family?.value)).toBeCloseTo(1.56, 9);
  // in the family's group (fix tree-shape-091, rule 1), the read without the name the row above says (the 008's rename
  // by the row above) and its minimum
  const families = kidsOf(family)[0];
  expect([families?.name, families?.role]).toEqual([
    "👪 Family Bonuses",
    "system",
  ]);
  expect(rowsOf(kidsOf(families)[0])).toEqual([
    ["Working value of the game", 0, "unknown"],
    ["Minimum 1", 1, "fixedValue"],
  ]);
  // max(family, 1) is the family's row, with its read's name and code, never a row with no name (FR-007)
  const fam = kidsOf(families)[0];
  expect([fam?.code, fam?.name, fam?.value]).toEqual([
    "DNSM.FamBonusQTYs[66]",
    "Working value of the game (FamBonusQTYs)",
    1,
  ]);
  expect(family?.formula).toEqual([
    ["👪 Family Bonuses", "+", "🔹 Other", "÷", "100"],
    [1, 20, 100, 1.2],
  ]);
  // the multiplier read back as a value of its step: the set, then max(family, 2) + the sources ÷ 100, as pools; the
  // set's alone of its kind, the worn food's step a row (answer 2 of 19/11)
  const pools = kidsOf(treeOf("atTwo", 999, 3, 0));
  expect(pools.slice(0, 2).map((p) => [p.name, p.value])).toEqual([
    ["Multi pool", near(1.3)],
    ["Additive pool", near(2.2)],
  ]);
  const twice = kidsOf(pools[1])[0];
  expect(twice?.name).toBe("👪 Family Bonuses");
  expect(rowsOf(kidsOf(twice)[0])).toEqual([
    ["Working value of the game", 0, "unknown"],
    ["Minimum 2", 2, "fixedValue"],
  ]);
  expect(kidsOf(twice)[0]?.code).toBe("DNSM.FamBonusQTYs[66]");
});

test("sources taken as a percent by a product are a product of their sum by 0.01, in the chain's pool", () => {
  const [, add] = kidsOf(treeOf("percent"));
  expect([add?.name, add?.value]).toEqual(["Additive pool", near(2.2)]);
  const [families, ...sources] = kidsOf(add);
  // the family in its system's group (fix tree-shape-091, rule 1)
  expect([families?.name, families?.value]).toEqual(["👪 Family Bonuses", 2]);
  const [family] = kidsOf(families);
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
  // the source at 0 stays among the "🔹 Other" group's sources, and its ⓘ names it
  const [, family] = kidsOf(treeOf("DropRatez", 999, 3, 2, 0));
  const sources = kidsOf(family)[1];
  expect(sourcesOf(sources)).toEqual([
    ["TreeReads()", 8],
    ["TreeBase", 4],
    ["DNSM.GameCache.v", 0],
  ]);
  expect(sources?.formula).toEqual({
    rule: [
      "(TreeReads() + TreeBase + DNSM.GameCache.v + Fixed +3) ÷ 100",
      "(8 + 4 + 0 + 3) ÷ 100 = 0.15",
    ],
  });
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
