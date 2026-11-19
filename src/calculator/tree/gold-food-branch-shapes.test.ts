// A golden food opened as a branch, as inside the Drop Rate (fake-game.js TreeGoldOf calls GoldFoodBonuses), apart from
// gold-food-branch.test.ts: the names its rows take from the foods' texts, and the shapes its block can take, with the
// rows or pools each gives. The foods' texts are invented tables (table-names.ts); no text of the game is in this file.
import { afterEach, beforeAll, expect, test } from "vitest";
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
/** The golden food of `key` opened as its chain. */
const chainOf = (key: string, ...rest: number[]) => ({
  food: openPath(
    buildOf(key, ...rest),
    `GoldFoodBonuses(${JSON.stringify(key)})`,
  ),
});
// the multiplier 1.3 × (2 + 0.2); the worn food 7 × it × 0.05 × log(1000) × (1 + log(1000) ÷ 2.14); the emporium's
// 7 × it × 0.05 × log(1 + 10^6)
const MULTI = 2.86;
const WORN = 7.212813084112149;
const EMPORIUM = 6.006000434728559;

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

test("an emporium's part times 1 is no sum: the pass has no emporium row", () => {
  useGameTables(TABLES);
  expect(goldRows(passOf("scaled")).map((k) => [k.name, k.value])).toEqual([
    ["GFood Multi", near(MULTI)],
    ["Equipped: Invented Charm", near(WORN)],
  ]);
});

// the steps of a golden food's emporium and worn food that read the worn food back: the chain's pools, the shared
// multiplier's and the worn food's (when there is one), then the sum's, with the values of the pass's rows
// the emporium's lone + is its own row, no pool (decision of 19/11); two of them are its pool; the worn food's step is
// one row, its own × N, so the set's pool is alone of its kind (the rule and answer 2 of 19/11)
const TWO_SUMS = [
  "Multi pool",
  "Additive pool 1",
  "Equipped: Invented Charm",
  "Additive pool 2",
];
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
    ["Multi pool", "Additive pool", "Equipped: Invented Charm", "Game value"],
  ],
  [
    "the emporium's twice: one pool, over the worn food's",
    "twice",
    3,
    [1.3, 2.2, WORN / MULTI, EMPORIUM / 5 + EMPORIUM],
    TWO_SUMS,
  ],
])("%s", (_name, key, level, values, names) => {
  useGameTables(TABLES);
  const { food } = chainOf(key, 999, level);
  expect(
    kidsIn(food)
      .slice(0, values.length)
      .map((k) => [k.name, k.value]),
  ).toEqual(values.map((v, i) => [names[i], near(v)]));
});
