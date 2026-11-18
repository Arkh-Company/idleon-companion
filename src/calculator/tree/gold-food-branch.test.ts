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
import { openPath } from "./tree-fixture.ts";

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
const kidsOf = (n: CalcTreeNode | null | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];
/** The pass's own rows (branches), without the block's checks and data rows that follow them, as any block's. */
const goldRows = (n: CalcTreeNode | null) =>
  kidsOf(n).filter((k) => k.leaf === null);
const near = (v: number): unknown => expect.closeTo(v, 9);
const brief = (n: CalcTreeNode | null | undefined) =>
  kidsOf(n).map((k) => [k.name, k.value, k.leaf, k.fmt, k.flags]);
/** The sources under a row, each the first row with a code on its way down, as [code, value]; lazy rows opened. */
function sourcesOf(
  build: ReturnType<typeof buildOf>,
  n: CalcTreeNode | null | undefined,
): [string, unknown][] {
  return kidsOf(n).flatMap((k) => {
    if (k.code !== null) return [[k.code, k.value] as [string, unknown]];
    return sourcesOf(build, k.kids === "lazy" ? build.expand(k.id) : k);
  });
}
/** The chain's pools of the golden food of `key`, as [name, value], and its build. */
function chainOf(key: string, ...rest: number[]) {
  const build = buildOf(key, ...rest);
  const food = openPath(build, `GoldFoodBonuses(${JSON.stringify(key)})`);
  const pools = kidsOf(food).filter((k) => k.role === "pool");
  return { build, food, pools };
}

// the multiplier 1.3 × (2 + 0.2); the worn food 7 × it × 0.05 × log(1000) × (1 + log(1009) ÷ 2.14); the emporium's
// 7 × it × 0.05 × log(1 + 10^6)
const MULTI = 2.86;
const WORN = 7.218273444957685;
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
    ["Multi pool 1", near(1.3), null, "x", { closed: true }],
    ["Additive pool 1", near(2.2), null, null, { closed: true }],
    ["Multi pool 2", near(WORN / MULTI), null, "x", { closed: true }],
    ["Additive pool 2", near(EMPORIUM), null, null, { closed: true }],
    // the block's data row (the quantity its log call took) and its checks, as for any block
    ["Food slot 1 quantity", 999, "quantity", null, {}],
    ["Food slot 1 quantity > 0", 0, "condition", null, {}],
    ["Game value", 0, "condition", null, { unnamed: true }],
  ]);
  const [set, family, worn, emporium] = pools;
  // the shared multiplier is no unnamed row: the set's bonuses, one row each, then the family and the sources in % by
  // system (FR-007, FR-017); the worn food's pool has the food's own numbers
  expect(kidsOf(set).map((k) => [k.code, k.value])).toEqual([
    ["GfoodSet[0]", 10],
    ["GfoodSet[1]", 20],
  ]);
  expect(
    kidsOf(family).map((k) => [k.code ?? k.name, k.combine, k.value]),
  ).toEqual([
    ["DNSM.FamBonusQTYs[66]", undefined, 2],
    ["🔹 Other", "percent", near(0.2)],
  ]);
  expect([...sourcesOf(build, set), ...sourcesOf(build, family)]).toEqual(
    MULTI_SOURCES,
  );
  expect(kidsOf(worn).map((k) => [k.name, k.value])).toEqual([
    ["Amount of the golden food (item table)", 7],
    ["Fixed ×0.05", 0.05],
    ["log₁₀", near(3)],
    ["Quantity multiplier", near(2.403687460858369)],
  ]);
  // the emporium's: the food's amount, the multiplier's sources again, and its log of 6
  const [emp] = kidsOf(emporium);
  const parts = kidsOf(emp?.kids === "lazy" ? build.expand(emp.id) : emp);
  expect(emp?.name).toBe("Emporium: Other Dish");
  expect(parts.map((k) => [k.name, k.value, k.leaf])).toEqual([
    ["Amount of the golden food (item table)", 7, "fixedValue"],
    ["GFood Multi", near(MULTI), null],
    ["Fixed ×0.05", 0.05, "fixedValue"],
    ["log₁₀", near(6.000000434294264), "rawBonus"],
  ]);
  expect(parts.reduce((p, k) => p * Number(k.value), 1)).toBeCloseTo(
    EMPORIUM,
    9,
  );
  // its ⓘ is how its pools join
  expect(food?.formula).toEqual([
    [
      "Multi pool 1",
      "×",
      "Additive pool 1",
      "×",
      "Multi pool 2",
      "+",
      "Additive pool 2",
    ],
    [1.3, 2.2, 2.524, 6.006, 13.224],
  ]);
  expect(checkTree(food, 100)).not.toBeNull();
});

test("a golden food the pass reads: the shared multiplier, the worn food and the emporium's, each with its parts", () => {
  useGameTables(TABLES);
  const root = passOf();
  expect(root?.value).toBeCloseTo(WORN + EMPORIUM, 9);
  const [multi, worn, emporium] = kidsOf(root);
  expect(brief(root)).toEqual([
    ["GFood Multi", near(MULTI), null, "x", {}],
    ["Equipped: Invented Charm", near(WORN), null, null, {}],
    ["Emporium: Other Dish", near(EMPORIUM), null, null, {}],
    // the block's data row (the quantity its log call took) and its checks, as for any block
    ["Food slot 1 quantity", 999, "quantity", null, {}],
    ["Food slot 1 quantity > 0", 1, "condition", null, {}],
    ["Game value", 0, "condition", null, { unnamed: true }],
  ]);
  const [, sources, set] = kidsOf(multi);
  expect(brief(multi)).toEqual([
    ["Family Bonus 66", 2, "rawBonus", null, {}],
    ["Sources ÷ 100", near(0.2), null, null, {}],
    ["SECRET_SET multi", near(1.3), null, "x", {}],
  ]);
  expect(kidsOf(sources).map((k) => [k.code, k.name, k.value])).toEqual([
    ["TreeReads()", "Game value", 8],
    ["TreeBase", "Game value", 4],
    ["DNSM.GameCache.v", "Working value of the game (GameCache)", 5],
    [null, "Fixed +3", 3],
  ]);
  expect(kidsOf(set).map((k) => [k.code, k.value])).toEqual([
    ["GfoodSet[0]", 10],
    ["GfoodSet[1]", 20],
  ]);
  expect(brief(worn)).toEqual([
    ["Base Amount", 7, "fixedValue", null, {}],
    ["Quantity", 999, "quantity", null, {}],
    ["Log Factor", near(3), "quantity", null, {}],
  ]);
  expect(brief(emporium)).toEqual([
    ["Base Amount", 7, "fixedValue", null, {}],
    ["Log Factor", near(6.000000434294264), "quantity", null, {}],
  ]);
  // every name the pass writes is one the host takes
  expect(checkTree(root, 100)).not.toBeNull();
});

test("each row of a golden food the pass reads has the ⓘ of its step", () => {
  useGameTables(TABLES);
  const [multi, worn, emporium] = kidsOf(passOf());
  const [, sources, set] = kidsOf(multi);
  expect(multi?.formula).toEqual({
    rule: [
      "SECRET_SET multi × (max(Family Bonus 66, 1) + Sources ÷ 100)",
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
    "(1 + ((GfoodSet[0] + GfoodSet[1]) ÷ 100)) × (max(DNSM.FamBonusQTYs[66], 1) + ((((TreeReads() + TreeBase) + DNSM.GameCache.v) + 3) ÷ 100))";
  const numsOf =
    "(1 + ((10 + 20) ÷ 100)) × (max(2, 1) + ((((8 + 4) + 5) + 3) ÷ 100))";
  expect([worn?.formula, emporium?.formula]).toEqual([
    {
      rule: [
        `(((Base Amount × (${multiOf})) × 0.05) × log₁₀) × (1 + (log₁₀ ÷ 2.14))`,
        `(((7 × (${numsOf})) × 0.05) × 3) × (1 + (3.004 ÷ 2.14)) = 7.218`,
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

test("a food with no text keeps the generic name; the emporium's with none takes the worn food's", () => {
  expect(goldRows(passOf()).map((k) => [k.name, k.flags])).toEqual([
    ["GFood Multi", {}],
    ["Game value", { unnamed: true }],
    ["Game value", { unnamed: true }],
  ]);
  useGameTables(new Map([...TABLES].slice(0, 1)));
  expect(goldRows(passOf()).map((k) => k.name)).toEqual([
    "GFood Multi",
    "Equipped: Invented Charm",
    "Emporium: Invented Charm",
  ]);
});

test("a food whose name would be too long keeps the generic name", () => {
  useGameTables(
    new Map([["ItemDefinitionsGET.itemA", { displayName: "y".repeat(196) }]]),
  );
  const [, worn, emporium] = goldRows(passOf());
  expect([worn?.name, worn?.flags]).toEqual(["Game value", { unnamed: true }]);
  expect(emporium?.flags).toEqual({ unnamed: true });
});

test("the multiplier's ⓘ counts a family below 1 as 1, and is not written when the step's family is another", () => {
  expect(goldRows(passOf("local", 999, 3, 0))[0]?.formula).toEqual({
    rule: [
      "SECRET_SET multi × (max(Family Bonus 66, 1) + Sources ÷ 100)",
      "1.3 × (1 + 0.2) = 1.56",
    ],
  });
  expect(goldRows(passOf("atTwoLocal", 999, 3, 0))[0]?.formula).toBeNull();
  // as a chain, the same sources and values: the set's pool, then max(family, 2) + the sources ÷ 100
  const { build, food, pools } = chainOf("atTwo", 999, 3, 0);
  expect(pools.slice(0, 2).map((p) => [p.name, p.value])).toEqual([
    ["Multi pool 1", near(1.3)],
    ["Additive pool 1", near(2.2)],
  ]);
  expect(food?.value).toBeCloseTo(WORN + EMPORIUM, 9);
  expect(sourcesOf(build, pools[1]).map(([c]) => c)).toEqual(
    expect.arrayContaining(["TreeReads()", "TreeBase", "DNSM.GameCache.v"]),
  );
});

test("sources taken as a percent by a product are no sources", () => {
  const [multi] = goldRows(passOf("percentLocal"));
  const sources = kidsOf(multi)[1];
  expect([
    sources?.name,
    sources?.value,
    sources?.flags,
    kidsOf(sources),
  ]).toEqual(["Sources ÷ 100", null, { unavailable: true }, []]);
  expect(multi?.formula).toBeNull();
  // as a chain, the same sources and values: the family and the sources' product by 0.01
  const { build, pools } = chainOf("percent");
  expect(pools.map((p) => [p.name, p.value])).toEqual([
    ["Multi pool 1", near(1.3)],
    ["Additive pool 1", near(2.2)],
    ["Multi pool 2", near(WORN / MULTI)],
    ["Additive pool 2", near(EMPORIUM)],
  ]);
  expect(sourcesOf(build, pools[1])).toEqual([
    ["DNSM.FamBonusQTYs[66]", 2],
    ["TreeReads()", 8],
    ["TreeBase", 4],
    ["DNSM.GameCache.v", 5],
  ]);
});

test("a set of one part has its ⓘ; one written with its number last has no parts", () => {
  const set = (key: string) => kidsOf(goldRows(passOf(key))[0])[2];
  const one = set("oneSetLocal");
  expect(kidsOf(one).map((k) => [k.code, k.value])).toEqual([
    ["GfoodSet[0]", 10],
  ]);
  expect(one?.formula).toEqual([
    ["1", "+", "(", "GfoodSet[0]", "÷", "100", ")"],
    [1, 10, 100, 1.1],
  ]);
  const last = set("setLastLocal");
  expect([last?.value, kidsOf(last)]).toEqual([near(1.1), []]);
  // as a chain, the set's one part is its first pool, with the same value
  for (const key of ["oneSet", "setLast"]) {
    const { build, pools } = chainOf(key);
    expect([pools[0]?.name, pools[0]?.value]).toEqual([
      "Multi pool 1",
      near(1.1),
    ]);
    expect(sourcesOf(build, pools[0])).toEqual([["GfoodSet[0]", 10]]);
  }
});

test("a source at 0 stays in its place in the sum, as in any sum, and the sources' ⓘ still names it (spec 009, FR-016)", () => {
  const [multi] = goldRows(passOf("local", 999, 3, 2, 0));
  const sources = kidsOf(multi)[1];
  expect(kidsOf(sources).map((k) => [k.name, k.value])).toEqual([
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

test("an emporium's part times 1 is no sum: the pass has no emporium row", () => {
  useGameTables(TABLES);
  expect(goldRows(passOf("scaled")).map((k) => [k.name, k.value])).toEqual([
    ["GFood Multi", near(MULTI)],
    ["Equipped: Invented Charm", near(WORN)],
  ]);
});

// the steps of a golden food's emporium and worn food that read the worn food back: the chain's pools, the shared
// multiplier's and the worn food's (when there is one), then the sum's, with the values of the pass's rows
test.each<[string, string, number, number[]]>([
  [
    "no emporium level: the emporium's pool is 0",
    "DropRatez",
    0,
    [1.3, 2.2, WORN / MULTI, 0],
  ],
  ["a worn food added to the bonus is one sum", "added", 0, [WORN]],
  [
    "the emporium's log inside a max",
    "inFn",
    3,
    [1.3, 2.2, WORN / MULTI, EMPORIUM],
  ],
  [
    "the emporium's twice: one pool, over the worn food's",
    "twice",
    3,
    [1.3, 2.2, WORN / MULTI, EMPORIUM / 5 + EMPORIUM],
  ],
])("%s", (_name, key, level, values) => {
  useGameTables(TABLES);
  const names =
    values.length > 1
      ? ["Multi pool 1", "Additive pool 1", "Multi pool 2"]
      : [];
  const last = values.length > 1 ? "Additive pool 2" : "Additive pool";
  expect(chainOf(key, 999, level).pools.map((k) => [k.name, k.value])).toEqual(
    values.map((v, i) => [names[i] ?? last, near(v)]),
  );
});
