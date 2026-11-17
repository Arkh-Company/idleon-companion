// The first level of a tree built from a recording of the invented game is the game's pools (spec 009, FR-001, FR-005,
// FR-008): a root that sums is one Additive pool, a root with a max at the top keeps its rows (all of them in
// "🔹 Other": the invented blocks have no system), and every pool closes to the root.
import { beforeAll, expect, test } from "vitest";
import { checkTree } from "../main/tree-check.ts";
import { GAME, mosaicOf, PAK } from "./fixtures/fake-mosaic.ts";
import type { CalcTreeNode } from "./tree-contract.ts";
import { buildTree } from "./tree-build.ts";
import { bootRecorder } from "./tree-record.ts";

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
const kidsOf = (n: CalcTreeNode | null | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];

test("a root that sums is one Additive pool, with no piece, holding its rows", () => {
  const root = treeOf("TreeTwice");
  const [pool, ...rest] = kidsOf(root);
  expect(rest).toEqual([]);
  expect(pool).toMatchObject({
    id: "root/Additive pool",
    name: "Additive pool",
    role: "pool",
    poolKind: "additive",
    combine: "sum",
    pieceKey: null,
    code: null,
    value: 16,
  });
  expect(kidsOf(pool).map((k) => [k.id, k.code, k.value])).toEqual([
    ["root/Additive pool/Game value", "TreeReads()", 8],
    ["root/Additive pool/Game value#2", "TreeReads()", 8],
  ]);
});

test("a root with a max at the top has no pool: its rows, all in Other, stay as they are", () => {
  const root = treeOf("TreeMaxOf");
  expect(kidsOf(root).map((k) => [k.role, k.code, k.value])).toEqual([
    ["piece", "TreeReads()", 8],
    ["piece", "TreeLoop()", 6],
    ["piece", "TreeBase", 4],
  ]);
});

test("every pool closes to the root, and only pools and groups have no piece key", () => {
  for (const block of ["TreeTwice", "TreeSources", "TreeCacheRead"]) {
    const root = treeOf(block);
    const pools = kidsOf(root).filter((k) => k.role === "pool");
    expect(pools.length).toBeGreaterThan(0);
    const [first] = pools;
    const total =
      first?.combine === "sum"
        ? pools.reduce((s, p) => s + Number(p.value), 0)
        : pools.reduce((s, p) => s * Number(p.value), 1);
    expect(total).toBeCloseTo(Number(root.value));
    for (const p of pools) {
      expect(p.pieceKey).toBeNull();
      expect(Object.hasOwn(kidsOf(p)[0] ?? {}, "combine")).toBe(
        kidsOf(p)[0]?.role === "system",
      );
    }
  }
});

// The shape of the Drop Rate's chain (fake-game.js TreeChain): 37 → + 2 (when a flag is on) → × 6 → + 0.5 →
// × (1 + (3 + 80) ÷ 100) → × 3 × 2, each step on the running total (FR-005, rule Y of 17/11); the first sum is the
// working value the root wrote and reads back, a link of the chain: its sources are the first pool's.
test("a root that is a chain of steps gets a pool per run, in the game's order, each closing, and the main takes it", () => {
  const build = buildTree(
    recorder.record(mosaicOf(), [["TreeChain", [0, 0, 0]]], NONE),
    0,
    recorder.ops,
  );
  const root = build.root;
  const level = kidsOf(root);
  expect(
    level.map((k) => [k.name, k.role, k.poolKind, k.combine, k.value]),
  ).toEqual([
    ["Additive pool 1", "pool", "additive", "sum", 39],
    ["Multi pool 1", "pool", "multi", "product", 6],
    ["Additive pool 2", "pool", "additive", "sum", 0.5],
    ["Multi pool 2", "pool", "multi", "onePlusPercent", 1.83],
    ["Multi pool 3", "pool", "multi", "product", 6],
    // the check that guards the + 2 stays, after the pools: no source leaves (FR-008)
    ["Game value", "piece", undefined, undefined, 1],
  ]);
  expect(level.map((k) => kidsOf(k).map((r) => [r.code, r.value]))).toEqual([
    [
      ["TreeReads()", 8],
      ["TreeBase", 4],
      ["TreeLevel", 25],
      [null, 2],
    ],
    [["TreeLoop()", 6]],
    [[null, 0.5]],
    [
      ["TreeStats.a", 3],
      ["TreeCapped", 80],
    ],
    [
      ["TreeTwins[0]", 3],
      ["TreeList[1]", 2],
    ],
    [],
  ]);
  expect(root.formula).toEqual([
    [
      "(",
      "Additive pool 1",
      "×",
      "Multi pool 1",
      "+",
      "Additive pool 2",
      ")",
      "×",
      "Multi pool 2",
      "×",
      "Multi pool 3",
    ],
    [39, 6, 0.5, 1.83, 6, 2574.81],
  ]);
  // a call of the sum still opens inside its pool
  const [reads] = kidsOf(level[0]);
  expect(
    kidsOf(reads?.kids === "lazy" ? build.expand(reads.id) : reads).map((r) => [
      r.code,
      r.value,
    ]),
  ).toEqual([
    ["TreeStats.a", 3],
    ["TreeStats.b", 5],
  ]);
  expect(checkTree(root, 100)).not.toBeNull();
});

test("a chain keeps after its pools the rows no step of it shows: the block's data rows, as any block's (FR-008)", () => {
  // (TreeBase + 1) × TreeArg(TreeLevel): the level the call took is a data row of the block
  const level = kidsOf(treeOf("TreeChainData"));
  expect(level.map((k) => [k.name, k.role, k.value])).toEqual([
    ["Additive pool", "pool", 5],
    ["Multi pool", "pool", 100],
    [expect.any(String), "piece", 25],
  ]);
  expect(level[2]?.code).toBe("TreeLevel");
});

test("a chain a step of which neither adds nor multiplies is open: the build says so, for the log (NFR-005)", () => {
  const build = (block: string) =>
    buildTree(
      recorder.record(mosaicOf(), [[block, [0, 0, 0]]], NONE),
      0,
      recorder.ops,
    );
  const open = build("TreeChainOpen");
  expect([open.chainOpen, open.root.value]).toEqual([true, 9]);
  // the tree is still built, from the rows
  expect(kidsOf(open.root).length).toBeGreaterThan(0);
  expect(build("TreeChain").chainOpen).toBe(false);
});
