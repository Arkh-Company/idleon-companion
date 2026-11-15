// Golden Food (pieces.cjs explainRaw goldFood at BASELINE-4) over recordings of the invented game's GoldFoodBonuses
// (fake-game.js): the shared multiplier, the worn food and the emporium's, each with the ⓘ of its step. The block's key
// picks how a step is written. The foods' texts are invented tables in the bench's canonical form (table-names.ts); no
// text of the game is in this file.
import { afterEach, beforeAll, expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { buildTree } from "../tree-build.ts";
import { bootRecorder } from "../tree-record.ts";
import { sourceTerm } from "./gold-food.ts";
import { row } from "./rows.ts";
import { useGameTables } from "./table-names.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});
afterEach(() => {
  useGameTables(new Map());
});

const TABLES = new Map<string, unknown>([
  ["ItemDefinitionsGET.itemA", { displayName: "Invented|Charm" }],
  ["ItemDefinitionsGET.itemB", { displayName: "OTHER_DISH" }],
]);
/** The state of a golden food: the worn food's quantity, the emporium's level and the Family Bonus 66. */
const golden = (
  quantity: number,
  level: number,
  family: number,
  cache: number,
) =>
  mosaicOf({
    GfoodSet: [10, 20],
    GfoodStart: 9,
    EquipmentOrder: [[], [], ["Blank", "itemA"]],
    EquipmentQuantity: [[], [], [0, quantity]],
    Ninja: Array.from({ length: 105 }, (_, i) => (i === 104 ? [level] : [])),
    DNSM: {
      $m: {
        FamBonusQTYs: Array.from({ length: 67 }, (_, i) =>
          i === 66 ? family : 0,
        ),
        GfoodMap: { $m: { Amount: 7 } },
        GfoodBonus: 0,
        GameCache: { $m: { v: cache } },
      },
    },
  });
const treeOf = (
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
  ).root;
const kidsOf = (n: CalcTreeNode | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];
/** The pass's own rows (branches), without the block's checks and data rows that follow them, as any block's. */
const goldRows = (n: CalcTreeNode) => kidsOf(n).filter((k) => k.leaf === null);
const brief = (n: CalcTreeNode | undefined) =>
  kidsOf(n).map((k) => [k.name, k.value, k.leaf, k.fmt, k.flags]);
const near = (v: number): unknown => expect.closeTo(v, 9);
// the multiplier 1.3 × (2 + 0.2); the worn food 7 × it × 0.05 × log(1000) × (1 + log(1009) ÷ 2.14); the emporium's
// 7 × it × 0.05 × log(1 + 10^6)
const MULTI = 2.86;
const WORN = 7.218273444957685;
const EMPORIUM = 6.006000434728559;

test("a golden food: the shared multiplier, the worn food and the emporium's, each with its parts", () => {
  useGameTables(TABLES);
  const root = treeOf();
  expect(root.value).toBeCloseTo(WORN + EMPORIUM, 9);
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
  const [multi, worn, emporium] = kidsOf(treeOf());
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

test("the multiplier's ⓘ counts a family below 1 as 1, and is not written when the step's family is another", () => {
  expect(goldRows(treeOf("DropRatez", 999, 3, 0))[0]?.formula).toEqual({
    rule: [
      "SECRET_SET multi × (max(Family Bonus 66, 1) + Sources ÷ 100)",
      "1.3 × (1 + 0.2) = 1.56",
    ],
  });
  expect(goldRows(treeOf("atTwo", 999, 3, 0))[0]?.formula).toBeNull();
});

test("sources taken as a percent by a product are no sources", () => {
  const [multi] = goldRows(treeOf("percent"));
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
  const set = (key: string) => kidsOf(goldRows(treeOf(key))[0])[2];
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

test("a food with no text keeps the generic name; the emporium's with none takes the worn food's", () => {
  expect(goldRows(treeOf()).map((k) => [k.name, k.flags])).toEqual([
    ["GFood Multi", {}],
    ["Game value", { unnamed: true }],
    ["Game value", { unnamed: true }],
  ]);
  useGameTables(new Map([...TABLES].slice(0, 1)));
  expect(goldRows(treeOf()).map((k) => k.name)).toEqual([
    "GFood Multi",
    "Equipped: Invented Charm",
    "Emporium: Invented Charm",
  ]);
});

test("a food whose name would be too long keeps the generic name", () => {
  useGameTables(
    new Map([["ItemDefinitionsGET.itemA", { displayName: "y".repeat(196) }]]),
  );
  const [, worn, emporium] = goldRows(treeOf());
  expect([worn?.name, worn?.flags]).toEqual(["Game value", { unnamed: true }]);
  expect(emporium?.flags).toEqual({ unnamed: true });
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
    "no emporium level: no emporium row",
    "DropRatez",
    999,
    0,
    [["Equipped: Invented Charm", WORN]],
  ],
  [
    "a worn food rounded is no worn food's step",
    "round",
    999,
    3,
    [["Emporium: Other Dish", Math.round(WORN) + EMPORIUM]],
  ],
  [
    "a worn food added to the bonus is the worn food's step, not the emporium's",
    "added",
    999,
    0,
    [["Equipped: Invented Charm", WORN]],
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
    goldRows(treeOf(key, quantity, level)).map((k) => [k.name, k.value]),
  ).toEqual([
    ["GFood Multi", near(MULTI)],
    ...rows.map(([n, v]) => [n, near(v)]),
  ]);
});

test("a source at 0 goes under the sum's own row at 0, as in any sum, and the sources' ⓘ still names it", () => {
  const [multi] = goldRows(treeOf("DropRatez", 999, 3, 2, 0));
  const sources = kidsOf(multi)[1];
  expect(kidsOf(sources).map((k) => [k.name, k.value])).toEqual([
    ["Game value", 8],
    ["Game value", 4],
    ["Fixed +3", 3],
    ["At 0 (1)", 0],
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
