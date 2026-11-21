// Every tree gets the mould (spec 009, T025, after the probe of the 716 trees, where 435 roots had no pool): the shapes
// of those roots on the invented game. A rounded sum of a coefficient times a source is its Additive pool; a chain the
// game clamps at the end, where the clamp does not bite, gets its chain's pools; a product with a check and a read no
// step shows is its Multi pool, the check and the read after it. Every level closes and no row leaves (FR-008).
import { beforeAll, expect, test } from "vitest";
import { checkTree } from "../main/tree-check.ts";
import { GAME, mosaicOf, PAK } from "./fixtures/fake-mosaic.ts";
import type { CalcTreeNode } from "./tree-contract.ts";
import { buildTree } from "./tree-build.ts";
import { bootRecorder } from "./tree-record.ts";
import { TABLES } from "./tree/gold-food-fixture.ts";
import { useGameTables } from "./names/table-names.ts";
import { kidsIn } from "./tree/tree-fixture.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});

const NONE = { recompute: [], builders: [] };
const treeOf = (block: string) =>
  buildTree(
    recorder.record(mosaicOf(), [[block, [0, 0, 0]]], NONE),
    0,
    recorder.ops,
  ).root;
/** Every code under a row, at any depth, pools and groups gone through. */
const codesIn = (n: CalcTreeNode): string[] =>
  kidsIn(n).flatMap((k) => [
    ...(k.code === null ? [] : [k.code]),
    ...codesIn(k),
  ]);
const sum = (ns: readonly CalcTreeNode[]) =>
  ns.reduce((s, k) => s + Number(k.value), 0);
const product = (ns: readonly CalcTreeNode[]) =>
  ns.reduce((p, k) => p * Number(k.value), 1);

// fake-game.js TreeRoundSum: round(3 × CardBonusREAL(1) + ArcadeBonus(0) + TreeLevel) = round(12 + 8 + 25)
test("a rounded sum of a coefficient times a source is one Additive pool, its terms by system", () => {
  const root = treeOf("TreeRoundSum");
  const [pool, ...rest] = kidsIn(root);
  expect(rest).toEqual([]);
  expect([pool?.name, pool?.role, pool?.combine, pool?.value]).toEqual([
    "Additive pool",
    "pool",
    "sum",
    45,
  ]);
  const level = kidsIn(pool);
  // the card's term, the arcade's and the level's, in the V1 order; the card's term is 3 × its value
  expect(level.map((k) => k.value)).toEqual([12, 8, 25]);
  expect(sum(level)).toBe(45);
  expect(codesIn(root)).toEqual(
    expect.arrayContaining(["CardBonusREAL(1)", "ArcadeBonus(0)", "TreeLevel"]),
  );
  expect(checkTree(root, 100)).not.toBeNull();
});

// fake-game.js TreeClamped: max(0.01, (TreeReads() + TreeBase) × TreeLoop()) = max(0.01, 72)
test("a chain the game clamps at the end, where the clamp does not bite, gets its chain's pools", () => {
  const root = treeOf("TreeClamped");
  const level = kidsIn(root);
  expect(level.map((k) => [k.name, k.role, k.combine, k.value])).toEqual([
    ["Additive pool", "pool", "sum", 12],
    // the single multiplier alone in its pool is its own × N row, no pool (answer 2 of 19/11)
    ["Game value", "piece", undefined, 6],
  ]);
  expect(product(level)).toBe(72);
  expect(kidsIn(level[0]).map((k) => [k.code, k.value])).toEqual([
    ["TreeReads()", 8],
    ["TreeBase", 4],
  ]);
  expect([level[1]?.code, level[1]?.fmt]).toEqual(["TreeLoop()", "x"]);
  expect(root.formula).toEqual([
    ["Additive pool", "×", "TreeLoop()"],
    [12, 6, 72],
  ]);
  expect(checkTree(root, 100)).not.toBeNull();
});

// fake-game.js TreeChecked: TreeLevel > 100 returns 0; else TreeReads() × TreeLoop(), × 2 when TreeOwned > 0 (not taken)
test("a product with a check and a read no step shows is its Multi pool, the check and the read after it", () => {
  const root = treeOf("TreeChecked");
  const [pool, ...rest] = kidsIn(root);
  expect([pool?.name, pool?.role, pool?.combine, pool?.value]).toEqual([
    "Multi pool",
    "pool",
    "product",
    48,
  ]);
  expect(kidsIn(pool).map((k) => [k.code, k.value])).toEqual([
    ["TreeReads()", 8],
    ["TreeLoop()", 6],
  ]);
  // every row of the 008 is still there: the reads and the checks after the pool
  expect(rest.map((k) => [k.code, k.value, k.leaf ?? null])).toEqual([
    ["TreeLevel", 25, "level"],
    ["TreeOwned", 0, "unknown"],
    [null, 0, "condition"],
    [null, 0, "condition"],
  ]);
  expect(checkTree(root, 100)).not.toBeNull();
});

/** A root's ⓘ as its two lines of text, its names and its numbers. */
const lines = (f: CalcTreeNode["formula"]): string[] =>
  Array.isArray(f)
    ? [f[0], f[1]].map((line) => line.join(" "))
    : (f?.rule ?? []);

// spec 009 T030 (decision of 18/11): a root the game floors keeps its pools, and the floor stays in sight in the
// root's ⓘ (FR-008). fake-game.js TreeFloored: floor(TreeReads() + TreeBase + 0.5) = floor(12.5) = 12
test("a root the game floors keeps its pools, the floor in its ⓘ", () => {
  const root = treeOf("TreeFloored");
  const [pool, ...rest] = kidsIn(root);
  expect(rest).toEqual([]);
  expect([pool?.name, pool?.combine, pool?.value]).toEqual([
    "Additive pool",
    "sum",
    12.5,
  ]);
  expect(sum(kidsIn(pool))).toBe(12.5);
  expect(root.value).toBe(12);
  const [names, numbers] = lines(root.formula);
  expect(names?.replace(/\s/g, "")).toBe("floor(Additivepool)");
  expect(numbers).toMatch(/12\.5.*12$/);
  expect(checkTree(root, 100)).not.toBeNull();
});

// fake-game.js TreeFloorChain: floor((TreeReads() + TreeBase) × TreeLoop() × 1.05 + 0.3) = floor(75.9) = 75
test("a chain the game floors keeps its chain's pools, the floor around them in the root's ⓘ", () => {
  const root = treeOf("TreeFloorChain");
  const level = kidsIn(root);
  expect(level.map((k) => [k.name, k.combine, k.value])).toEqual([
    ["Additive pool", "sum", 12],
    ["Multi pool", "product", expect.closeTo(6.3, 9)],
    // the lone + 0.3 after the product is its own row, no pool (decision of 19/11)
    ["Fixed +0.3", undefined, 0.3],
  ]);
  expect(root.value).toBe(75);
  const [names, numbers] = lines(root.formula);
  expect(names?.replace(/\s/g, "")).toBe(
    "floor(Additivepool×Multipool+Fixed+0.3)",
  );
  expect(numbers).toMatch(/ 75$/);
  expect(checkTree(root, 100)).not.toBeNull();
});

// fake-game.js TreeHaveItem: the block caches whether Cards[1] contains itemA, then tests the cache (HaveW6Trophy)
test("a block's cache of its own search is said by the item it found, from the items' table (009 T030)", () => {
  useGameTables(TABLES);
  const root = buildTree(
    recorder.record(
      mosaicOf({ Cards: [[], ["itemA"], [], []] }),
      [["TreeHaveItem", [0, 0, 0]]],
      NONE,
    ),
    0,
    recorder.ops,
  ).root;
  const names = (n: CalcTreeNode): string[] =>
    kidsIn(n).flatMap((k) => [k.name, ...names(k)]);
  expect(names(root)).toContain("Found Invented Charm");
  useGameTables(new Map());
});
