// The Golden Food pass (pieces.cjs explainRaw goldFood at BASELINE-4) where it runs: a golden food opened as a branch,
// as inside the Drop Rate (fake-game.js TreeGoldOf calls GoldFoodBonuses). At the root, a golden food that reads its
// worn food back is a chain of steps (spec 009, rule Y: gold-food.test.ts); below it, the pass names its rows.
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

/** The golden food of `key`, opened under TreeGoldOf. */
const passOf = (
  key = "DropRatez",
  quantity = 999,
  level = 3,
  family = 2,
  cache = 5,
) =>
  openPath(
    buildTree(
      recorder.record(
        golden(quantity, level, family, cache),
        [["TreeGoldOf", [key]]],
        { recompute: [], builders: [] },
      ),
      0,
      recorder.ops,
    ),
    `GoldFoodBonuses(${JSON.stringify(key)})`,
  );
const kidsOf = (n: CalcTreeNode | null | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];
/** The pass's own rows (branches), without the block's checks and data rows that follow them, as any block's. */
const goldRows = (n: CalcTreeNode | null) =>
  kidsOf(n).filter((k) => k.leaf === null);
const near = (v: number): unknown => expect.closeTo(v, 9);
const brief = (n: CalcTreeNode | null | undefined) =>
  kidsOf(n).map((k) => [k.name, k.value, k.leaf, k.fmt, k.flags]);

// the multiplier 1.3 × (2 + 0.2); the worn food 7 × it × 0.05 × log(1000) × (1 + log(1009) ÷ 2.14); the emporium's
// 7 × it × 0.05 × log(1 + 10^6)
const MULTI = 2.86;
const WORN = 7.218273444957685;
const EMPORIUM = 6.006000434728559;

test("a golden food: the shared multiplier, the worn food and the emporium's, each with its parts", () => {
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
    ["Food slot 1 quantity > 0", 0, "condition", null, {}],
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

test("each row of a golden food has the ⓘ of its step", () => {
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
  expect(goldRows(passOf("DropRatez", 999, 3, 0))[0]?.formula).toEqual({
    rule: [
      "SECRET_SET multi × (max(Family Bonus 66, 1) + Sources ÷ 100)",
      "1.3 × (1 + 0.2) = 1.56",
    ],
  });
  expect(goldRows(passOf("atTwo", 999, 3, 0))[0]?.formula).toBeNull();
});

test("sources taken as a percent by a product are no sources", () => {
  const [multi] = goldRows(passOf("percent"));
  const sources = kidsOf(multi)[1];
  expect([
    sources?.name,
    sources?.value,
    sources?.flags,
    kidsOf(sources),
  ]).toEqual(["Sources ÷ 100", null, { unavailable: true }, []]);
  expect(multi?.formula).toBeNull();
});

test("a set of one part has its ⓘ; one written with its number last has no parts", () => {
  const set = (key: string) => kidsOf(goldRows(passOf(key))[0])[2];
  const one = set("oneSet");
  expect(kidsOf(one).map((k) => [k.code, k.value])).toEqual([
    ["GfoodSet[0]", 10],
  ]);
  expect(one?.formula).toEqual([
    ["1", "+", "(", "GfoodSet[0]", "÷", "100", ")"],
    [1, 10, 100, 1.1],
  ]);
  const last = set("setLast");
  expect([last?.value, kidsOf(last)]).toEqual([near(1.1), []]);
});

test("a source at 0 stays in its place in the sum, as in any sum, and the sources' ⓘ still names it (spec 009, FR-016)", () => {
  const [multi] = goldRows(passOf("DropRatez", 999, 3, 2, 0));
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
});

// the steps of a golden food's emporium and worn food, as the pass reads them (the 008's cases)
test.each<[string, string, number, number, [string, number][]]>([
  [
    "no emporium level: no emporium row",
    "DropRatez",
    999,
    0,
    [["Equipped: Invented Charm", WORN]],
  ],
  [
    "a worn food added to the bonus is the worn food's step, not the emporium's",
    "added",
    999,
    0,
    [["Equipped: Invented Charm", WORN]],
  ],
  [
    "the emporium's log inside a max",
    "inFn",
    999,
    3,
    [
      ["Equipped: Invented Charm", WORN],
      ["Emporium: Other Dish", EMPORIUM],
    ],
  ],
  [
    "the emporium's twice: the last step, over the worn food's",
    "twice",
    999,
    3,
    [
      ["Equipped: Invented Charm", WORN],
      ["Emporium: Other Dish", EMPORIUM / 5 + EMPORIUM],
    ],
  ],
])("%s", (_name, key, quantity, level, rows) => {
  useGameTables(TABLES);
  expect(
    goldRows(passOf(key, quantity, level)).map((k) => [k.name, k.value]),
  ).toEqual([
    ["GFood Multi", near(MULTI)],
    ...rows.map(([n, v]) => [n, near(v)]),
  ]);
});
