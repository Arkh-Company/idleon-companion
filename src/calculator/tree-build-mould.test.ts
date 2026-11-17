// The first level of a tree built from a recording of the invented game is the game's pools (spec 009, FR-001, FR-005,
// FR-008): a root that sums is one Additive pool, a root with a max at the top keeps its rows (all of them in
// "🔹 Other": the invented blocks have no system), and every pool closes to the root.
import { beforeAll, expect, test } from "vitest";
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
const kidsOf = (n: CalcTreeNode | undefined) =>
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
