// Golden Food over recordings of the invented game's GoldFoodBonuses (fake-game.js), apart from gold-food.test.ts: the
// shapes a food's block can take, and the rows or pools each gives. The block's key picks how a step is written. The
// foods' texts are invented tables in the bench's canonical form (table-names.ts); no text of the game is in this file.
import { afterEach, beforeAll, expect, test } from "vitest";
import { GAME, PAK } from "../fixtures/fake-mosaic.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { buildTree } from "../tree-build.ts";
import { bootRecorder } from "../tree-record.ts";
import { golden, TABLES } from "./gold-food-fixture.ts";
import { useGameTables } from "../names/table-names.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});
afterEach(() => {
  useGameTables(new Map());
});

const treeOf = (key = "DropRatez", quantity = 999, level = 3) =>
  buildTree(
    recorder.record(
      golden(quantity, level, 2, 5),
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
const near = (v: number): unknown => expect.closeTo(v, 9);
// the multiplier 1.3 × (2 + 0.2); the worn food 7 × it × 0.05 × log(1000) × (1 + log(1000) ÷ 2.14); the emporium's
// 7 × it × 0.05 × log(1 + 10^6)
const MULTI = 2.86;
const WORN = 7.212813084112149;
const EMPORIUM = 6.006000434728559;

test.each<[string, string, number, number, [string, number][]]>([
  [
    "no worn food: the emporium's adds to nothing",
    "DropRatez",
    0,
    3,
    [["Beanstalk: Other Dish", EMPORIUM]],
  ],
  [
    "a worn food rounded is no worn food's step",
    "round",
    999,
    3,
    [["Beanstalk: Other Dish", Math.round(WORN) + EMPORIUM]],
  ],
  [
    "a bonus kept in the block: the emporium's adds to the worn food's step",
    "local",
    999,
    3,
    [
      ["Equipped: Invented Charm", WORN],
      ["Beanstalk: Other Dish", EMPORIUM],
    ],
  ],
  [
    "the emporium's added to another read: it adds to the worn food's step",
    "other",
    999,
    3,
    [
      ["Equipped: Invented Charm", WORN],
      ["Beanstalk: Other Dish", 9 + EMPORIUM - WORN],
    ],
  ],
  [
    "the emporium's added to another read with no worn food: it adds to nothing",
    "other",
    0,
    3,
    [["Beanstalk: Other Dish", 9 + EMPORIUM]],
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

// the foods whose worn food is read back: a chain, the shared multiplier's pools and the worn food's step (when there is
// one), then the sum's; the worn food's step is one row, its own × N, so the set's pool is alone of its kind (the rule
// and answer 2 of 19/11)
const SHARED = ["Multi pool", "Additive pool", "Equipped: Invented Charm"];
const TWO_SUMS = [
  "Multi pool",
  "Additive pool 1",
  "Equipped: Invented Charm",
  "Additive pool 2",
];
// the emporium's lone + is its own row, no pool (decision of 19/11); two of them are its pool
test.each<[string, string, number, number[], string[]]>([
  [
    "no emporium level: the emporium's pool is 0",
    "DropRatez",
    0,
    [1.3, 2.2, WORN / MULTI, 0],
    TWO_SUMS,
  ],
  [
    "a worn food added to the bonus is one sum",
    "added",
    0,
    [WORN],
    ["Additive pool"],
  ],
  [
    "the emporium's log inside a max",
    "inFn",
    3,
    [1.3, 2.2, WORN / MULTI, EMPORIUM],
    // an emporium with no name of its own
    [...SHARED, "Game value"],
  ],
  [
    "the emporium's twice, in one pool",
    "twice",
    3,
    [1.3, 2.2, WORN / MULTI, EMPORIUM * 1.2],
    TWO_SUMS,
  ],
])("%s", (_name, key, level, values, names) => {
  useGameTables(TABLES);
  expect(
    kidsOf(treeOf(key, 999, level))
      .slice(0, values.length)
      .map((k) => [k.name, k.value]),
  ).toEqual(values.map((v, i) => [names[i], near(v)]));
});
