// A golden food opened as a branch, as inside the Drop Rate (fake-game.js TreeGoldOf calls GoldFoodBonuses). One that
// reads its worn food back is a chain of steps and opens with its chain's pools, the same sources and values as the
// pass's rows (spec 009, FR-017; the Vinicius's decision of 17/11), as at the root (gold-food.test.ts). One that keeps its
// worn food in the block (the key local, and percentLocal, oneSetLocal… with another shared multiplier) is no chain:
// the Golden Food pass (pieces.cjs explainRaw goldFood at BASELINE-4) names its rows.
import { afterEach, beforeAll, expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { GAME, PAK } from "../fixtures/fake-mosaic.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { buildTree } from "../tree-build.ts";
import { bootRecorder } from "../tree-record.ts";
import { golden, TABLES } from "./gold-food-fixture.ts";
import { useGameTables } from "./table-names.ts";
import { kidsIn, openPath } from "./tree-fixture.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});
afterEach(() => {
  useGameTables(new Map());
});

/** The build of TreeGoldOf over the golden food of `key`: its quantity, its level, its family and its cache. */
const buildOf = (key: string, q = 999, l = 3, f = 2, c = 5) =>
  buildTree(
    recorder.record(golden(q, l, f, c), [["TreeGoldOf", [key]]], {
      recompute: [],
      builders: [],
    }),
    0,
    recorder.ops,
  );
/** The golden food of `key`, opened under TreeGoldOf. */
const passOf = (key = "local", ...rest: number[]) =>
  openPath(buildOf(key, ...rest), `GoldFoodBonuses(${JSON.stringify(key)})`);
/** The pass's own rows (branches), without the block's checks and data rows that follow them, as any block's. */
const goldRows = (n: CalcTreeNode | null) =>
  kidsIn(n).filter((k) => k.leaf === null);
const near = (v: number): unknown => expect.closeTo(v, 9);
const brief = (n: CalcTreeNode | null | undefined) =>
  kidsIn(n).map((k) => [k.name, k.value, k.leaf, k.fmt, k.flags]);
/** The sources under a row, each the first row with a code on its way down, as [code, value]; lazy rows opened. */
function sourcesOf(
  build: ReturnType<typeof buildOf>,
  n: CalcTreeNode | null | undefined,
): [string, unknown][] {
  return kidsIn(n).flatMap((k) => {
    if (k.code !== null) return [[k.code, k.value] as [string, unknown]];
    return sourcesOf(build, k.kids === "lazy" ? build.expand(k.id) : k);
  });
}
/** The chain's pools of the golden food of `key`, as [name, value], and its build. */
function chainOf(key: string, ...rest: number[]) {
  const build = buildOf(key, ...rest);
  const food = openPath(build, `GoldFoodBonuses(${JSON.stringify(key)})`);
  const pools = kidsIn(food).filter((k) => k.role === "pool");
  return { build, food, pools };
}

// the multiplier 1.3 × (2 + 0.2); the worn food 7 × it × 0.05 × log(1000) × (1 + log(1000) ÷ 2.14); the emporium's
// 7 × it × 0.05 × log(1 + 10^6)
const MULTI = 2.86;
const WORN = 7.212813084112149;
const EMPORIUM = 6.006000434728559;
/** The shared multiplier's sources: the set's, the family, then the sources it adds. */
const MULTI_SOURCES = [
  ["GfoodSet[0]", 10],
  ["GfoodSet[1]", 20],
  ["DNSM.FamBonusQTYs[66]", 2],
  ["TreeReads()", 8],
  ["TreeBase", 4],
  ["DNSM.GameCache.v", 5],
];

test("a golden food that reads its worn food back opens as its chain: its shared multiplier's pools, its worn food's numbers and the emporium's Additive pool", () => {
  useGameTables(TABLES);
  const { build, food, pools } = chainOf("DropRatez");
  expect(food?.value).toBeCloseTo(WORN + EMPORIUM, 9);
  expect(brief(food)).toEqual([
    // the set's pool, alone of its kind once the worn food's step is a row (answer 2 of 19/11)
    ["Multi pool", near(1.3), null, "x", { closed: true }],
    ["Additive pool", near(2.2), null, null, { closed: true }],
    // the worn food's step is one row, no pool of a row per factor: its log₁₀ and its quantity factor are math, in
    // its ⓘ only (the rule of 19/11), and a single multiplier alone in its pool is its own × N row (answer 2 of 19/11)
    ["Equipped: Invented Charm", near(WORN / MULTI), null, "x", {}],
    // the emporium's lone + is its own row, no pool (decision of 19/11)
    ["Beanstalk: Other Dish", near(EMPORIUM), null, "+", {}],
    // the block's data row (the quantity its log call took) and its checks, as for any block; the check of the
    // quantity beside it is said in the food's ⓘ, no row (A39, Vinicius's answer of 19/11)
    ["Food slot 1 quantity", 999, "quantity", null, {}],
    ["Game value", 0, "condition", null, { unnamed: true }],
  ]);
  const [set, family] = pools;
  // the worn food's step and the emporium's lone + are rows (decisions of 19/11)
  const worn = kidsIn(food)[2];
  const emporium = kidsIn(food)[3];
  // the shared multiplier is no unnamed row: the set's bonuses, one row each, then the family and the sources in % by
  // system (FR-007, FR-017); the worn food's pool has the food's own numbers
  expect(kidsIn(set).map((k) => [k.code, k.value])).toEqual([
    ["GfoodSet[0]", 10],
    ["GfoodSet[1]", 20],
  ]);
  // the family is a system of its own, its group of one source (fix tree-shape-091, rule 1), so the other sources are
  // a "🔹 Other" group in % (FR-005; A34's option B is only for a pool all of whose groups are "Other")
  expect(
    kidsIn(family).map((k) => [k.code ?? k.name, k.combine, k.value]),
  ).toEqual([
    ["👪 Family Bonuses", "sum", 2],
    ["🔹 Other", "percent", near(0.2)],
  ]);
  expect(
    kidsIn(kidsIn(family)[0]).map((k) => [k.code, k.combine, k.value]),
  ).toEqual([["DNSM.FamBonusQTYs[66]", undefined, 2]]);
  expect([...sourcesOf(build, set), ...sourcesOf(build, family)]).toEqual(
    MULTI_SOURCES,
  );
  // the worn food's own numbers, its leaves what goes into its math: the quantity for its log₁₀ and its quantity factor,
  // which are no rows (19/11)
  expect(
    kidsIn(worn?.kids === "lazy" ? build.expand(worn.id) : worn).map((k) => [
      k.name,
      k.value,
    ]),
  ).toEqual([
    ["Amount of the golden food (item table)", 7],
    ["Base rate (× 0.05)", 0.05],
    ["Quantity", 999],
  ]);
  // the emporium's: the food's amount, the multiplier's sources again, and the level its log takes
  const emp = emporium;
  const parts = kidsIn(emp?.kids === "lazy" ? build.expand(emp.id) : emp);
  expect(emp?.name).toBe("Beanstalk: Other Dish");
  expect(parts.map((k) => [k.name, k.value, k.leaf])).toEqual([
    ["Amount of the golden food (item table)", 7, "fixedValue"],
    ["GFood Multi", near(MULTI), null],
    ["Base rate (× 0.05)", 0.05, "fixedValue"],
    ["Beanstalk level", 3, "level"],
  ]);
  // 19/11: the log₁₀ is math, in the row's ⓘ, which ends with its value (FR-008)
  const empF = emp?.formula;
  expect(Array.isArray(empF) ? empF[1].at(-1) : null).toBeCloseTo(6.006, 3);
  // its ⓘ is how its pools join, then the check beside them in words: a rule, its result the food's value (A39)
  expect(food?.formula).toEqual({
    rule: [
      "Multi pool × Additive pool × Equipped: Invented Charm + Beanstalk: Other Dish (Food slot 1 quantity > 0: no)",
      "1.3 × 2.2 × 2.522 + 6.006 = 13.219",
    ],
  });
  expect(checkTree(food, 100)).not.toBeNull();
});

test("a golden food the pass reads: the shared multiplier, the worn food and the emporium's, each with its parts", () => {
  useGameTables(TABLES);
  const root = passOf();
  expect(root?.value).toBeCloseTo(WORN + EMPORIUM, 9);
  const [multi, worn, emporium] = kidsIn(root);
  expect(brief(root)).toEqual([
    ["GFood Multi", near(MULTI), null, "x", {}],
    ["Equipped: Invented Charm", near(WORN), null, null, {}],
    ["Beanstalk: Other Dish", near(EMPORIUM), null, null, {}],
    // the block's data row (the quantity its log call took) and its checks, as for any block
    ["Food slot 1 quantity", 999, "quantity", null, {}],
    ["Food slot 1 quantity > 0", 1, "condition", null, {}],
    ["Game value", 0, "condition", null, { unnamed: true }],
  ]);
  const [, sources, set] = kidsIn(multi);
  expect(brief(multi)).toEqual([
    ["Invented Family (family bonus)", 2, "rawBonus", null, {}],
    ["Sources ÷ 100", near(0.2), null, null, {}],
    ["SECRET_SET multi", near(1.3), null, "x", {}],
  ]);
  expect(kidsIn(sources).map((k) => [k.code, k.name, k.value])).toEqual([
    ["TreeReads()", "Game value", 8],
    ["TreeBase", "Game value", 4],
    ["DNSM.GameCache.v", "Working value of the game (GameCache)", 5],
    [null, "Fixed +3", 3],
  ]);
  expect(kidsIn(set).map((k) => [k.code, k.value])).toEqual([
    ["GfoodSet[0]", 10],
    ["GfoodSet[1]", 20],
  ]);
  // 19/11: the log₁₀ is math in the row's ⓘ, no Log Factor; the leaves are what goes into it, and the Base rate
  expect(brief(worn)).toEqual([
    ["Base Amount", 7, "fixedValue", null, {}],
    ["Base rate (× 0.05)", 0.05, "fixedValue", null, {}],
    ["Quantity", 999, "quantity", null, {}],
  ]);
  expect(brief(emporium)).toEqual([
    ["Base Amount", 7, "fixedValue", null, {}],
    ["Base rate (× 0.05)", 0.05, "fixedValue", null, {}],
    ["Beanstalk level", 3, "level", null, {}],
  ]);
  // every name the pass writes is one the host takes
  expect(checkTree(root, 100)).not.toBeNull();
});

test("each row of a golden food the pass reads has the ⓘ of its step", () => {
  useGameTables(TABLES);
  const [multi, worn, emporium] = kidsIn(passOf());
  const [, sources, set] = kidsIn(multi);
  expect(multi?.formula).toEqual({
    rule: [
      "SECRET_SET multi × (max(Invented Family, 1) + Sources ÷ 100)",
      "1.3 × (2 + 0.2) = 2.86",
    ],
  });
  // a source with no name of its own is its code; "Fixed +3" is the constant of the sum
  expect(sources?.formula).toEqual({
    rule: [
      "(TreeReads() + TreeBase + DNSM.GameCache.v + Fixed +3) ÷ 100",
      "(8 + 4 + 5 + 3) ÷ 100 = 0.2",
    ],
  });
  expect(set?.formula).toEqual([
    [
      "1",
      "+",
      "(",
      "(",
      "GfoodSet[0]",
      "+",
      "GfoodSet[1]",
      ")",
      "÷",
      "100",
      ")",
    ],
    [1, 10, 20, 100, 1.3],
  ]);
  // the shared multiplier is the step under its variable; a log call keeps its own term (it has no code among the parts)
  const multiOf =
    "(1 + ((GfoodSet[0] + GfoodSet[1]) ÷ 100)) × (max(Invented Family, 1) + ((((TreeReads() + TreeBase) + DNSM.GameCache.v) + 3) ÷ 100))";
  const numsOf =
    "(1 + ((10 + 20) ÷ 100)) × (max(2, 1) + ((((8 + 4) + 5) + 3) ÷ 100))";
  expect([worn?.formula, emporium?.formula]).toEqual([
    {
      rule: [
        `(((Base Amount × (${multiOf})) × 0.05) × log₁₀) × (1 + (log₁₀ ÷ 2.14))`,
        `(((7 × (${numsOf})) × 0.05) × 3) × (1 + (3 ÷ 2.14)) = 7.213`,
      ],
    },
    {
      rule: [
        `((Base Amount × (${multiOf})) × 0.05) × log₁₀`,
        `((7 × (${numsOf})) × 0.05) × 6 = 6.006`,
      ],
    },
  ]);
});

test("the multiplier's ⓘ counts a family below 1 as 1, and is not written when the step's family is another", () => {
  expect(goldRows(passOf("local", 999, 3, 0))[0]?.formula).toEqual({
    rule: [
      "SECRET_SET multi × (max(DNSM.FamBonusQTYs[66], 1) + Sources ÷ 100)",
      "1.3 × (1 + 0.2) = 1.56",
    ],
  });
  expect(goldRows(passOf("atTwoLocal", 999, 3, 0))[0]?.formula).toBeNull();
  // as a chain, the same sources and values: the set's pool, then max(family, 2) + the sources ÷ 100
  // (the set's pool alone of its kind, the worn food's step a row: answer 2 of 19/11)
  const { build, food, pools } = chainOf("atTwo", 999, 3, 0);
  expect(pools.slice(0, 2).map((p) => [p.name, p.value])).toEqual([
    ["Multi pool", near(1.3)],
    ["Additive pool", near(2.2)],
  ]);
  expect(food?.value).toBeCloseTo(WORN + EMPORIUM, 9);
  expect(sourcesOf(build, pools[1]).map(([c]) => c)).toEqual(
    expect.arrayContaining(["TreeReads()", "TreeBase", "DNSM.GameCache.v"]),
  );
});

test("sources taken as a percent by a product are no sources", () => {
  const [multi] = goldRows(passOf("percentLocal"));
  const sources = kidsIn(multi)[1];
  expect([
    sources?.name,
    sources?.value,
    sources?.flags,
    kidsIn(sources),
  ]).toEqual(["Sources ÷ 100", null, { unavailable: true }, []]);
  expect(multi?.formula).toBeNull();
  // as a chain, the same sources and values: the family and the sources' product by 0.01
  const { build, food, pools } = chainOf("percent");
  expect(pools.map((p) => [p.name, p.value])).toEqual([
    ["Multi pool", near(1.3)],
    ["Additive pool", near(2.2)],
  ]);
  // the worn food's step is its own × N row, the emporium's lone + its own row, no pools (decisions of 19/11)
  const worn = kidsIn(food)[2];
  expect([worn?.name, worn?.fmt, worn?.value]).toEqual([
    "Game value",
    "x",
    near(WORN / MULTI),
  ]);
  // (no food texts here: the generic name, no code, as the worn food's)
  const emporium = kidsIn(food)[3];
  expect([
    emporium?.name,
    emporium?.code,
    emporium?.role,
    emporium?.fmt,
    emporium?.value,
  ]).toEqual(["Game value", null, "piece", "+", near(EMPORIUM)]);
  expect(worn?.code).toBeNull();
  expect(sourcesOf(build, pools[1])).toEqual([
    ["DNSM.FamBonusQTYs[66]", 2],
    ["TreeReads()", 8],
    ["TreeBase", 4],
    ["DNSM.GameCache.v", 5],
  ]);
});

test("a set of one part has its ⓘ; one written with its number last has no parts", () => {
  const set = (key: string) => kidsIn(goldRows(passOf(key))[0])[2];
  const one = set("oneSetLocal");
  expect(kidsIn(one).map((k) => [k.code, k.value])).toEqual([
    ["GfoodSet[0]", 10],
  ]);
  expect(one?.formula).toEqual([
    ["1", "+", "(", "GfoodSet[0]", "÷", "100", ")"],
    [1, 10, 100, 1.1],
  ]);
  const last = set("setLastLocal");
  expect([last?.value, kidsIn(last)]).toEqual([near(1.1), []]);
  // as a chain, the set's one part is its first row, with the same value: a single multiplier alone in its Multi pool
  // is its own × N row, no pool (answer 2 of 19/11)
  // its name: "Multiplier" for 1 + its part ÷ 100, the generic one written with its number last (tree/shapes.ts)
  for (const [key, name] of [
    ["oneSet", "Multiplier"],
    ["setLast", "Game value"],
  ] as const) {
    const { build, food } = chainOf(key);
    const [first] = kidsIn(food);
    expect([first?.name, first?.code, first?.role, first?.value]).toEqual([
      name,
      null,
      "piece",
      near(1.1),
    ]);
    expect(sourcesOf(build, first)).toEqual([["GfoodSet[0]", 10]]);
  }
});

test("a source at 0 stays in its place in the sum, as in any sum, and the sources' ⓘ still names it (spec 009, FR-016)", () => {
  const [multi] = goldRows(passOf("local", 999, 3, 2, 0));
  const sources = kidsIn(multi)[1];
  expect(kidsIn(sources).map((k) => [k.name, k.value])).toEqual([
    ["Game value", 8],
    ["Game value", 4],
    ["Working value of the game (GameCache)", 0],
    ["Fixed +3", 3],
  ]);
  expect(sources?.formula).toEqual({
    rule: [
      "(TreeReads() + TreeBase + DNSM.GameCache.v + Fixed +3) ÷ 100",
      "(8 + 4 + 0 + 3) ÷ 100 = 0.15",
    ],
  });
  // as a chain, the source at 0 stays among the shared multiplier's sources
  const { build, pools } = chainOf("DropRatez", 999, 3, 2, 0);
  expect([
    ...sourcesOf(build, pools[0]),
    ...sourcesOf(build, pools[1]),
  ]).toEqual(
    MULTI_SOURCES.map(([c, v]) => [c, c === "DNSM.GameCache.v" ? 0 : v]),
  );
});
