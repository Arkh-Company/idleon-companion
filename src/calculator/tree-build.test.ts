// The root and the first level of a tree, built from a recording of the invented game (spec 008, T024, research R4):
// the rows under the root are the root block's own calls and state reads, and a row with more under it is "lazy".
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
const treeOf = (block: string, mosaic = mosaicOf(), character = 0) =>
  buildTree(recorder.record(mosaic, [[block, [0, 0, 0]]], NONE), character)
    .root;
const kidsOf = (n: CalcTreeNode) => (n.kids === "lazy" ? [] : n.kids);
const rows = (n: CalcTreeNode) =>
  kidsOf(n).map((k) => [
    k.code,
    k.value,
    k.kids === "lazy" ? "lazy" : k.kids.length,
  ]);

test("the root is the root call, with the call's value", () => {
  const root = treeOf("TreeSources");
  expect(root).toMatchObject({
    id: "root",
    pieceKey: '[0,"TreeSources",0,0,0]',
    name: "Total",
    value: 52,
    code: "TreeSources(0, 0, 0)",
    role: "root",
    flags: { unnamed: true },
  });
});

test("the first level is the root's calls, in order, then its state reads", () => {
  expect(rows(treeOf("TreeSources"))).toEqual([
    ["TreeReads()", 8, "lazy"],
    ["TreeLoop()", 6, "lazy"],
    ["TreeBase", 4, 0],
  ]);
});

test("a call row carries its piece key and its call with the game's arity, and the generic name", () => {
  const [reads] = kidsOf(treeOf("TreeSources"));
  expect(reads).toEqual({
    id: "root/Game value",
    pieceKey: '[0,"TreeReads"]',
    name: "Game value",
    value: 8,
    fmt: null,
    leaf: null,
    condition: null,
    why: null,
    formula: null,
    code: "TreeReads()",
    role: "piece",
    share: null,
    shareMode: "unknown",
    flags: { unnamed: true },
    kids: "lazy",
  });
});

test("a state read is a leaf of unknown kind, keyed by its path", () => {
  const leaf = kidsOf(treeOf("TreeSources")).at(-1);
  expect(leaf).toMatchObject({
    id: "root/Game value#3",
    name: "Game value",
    pieceKey: '[0,"TreeBase"]',
    leaf: "unknown",
    code: "TreeBase",
    kids: [],
  });
});

test("a piece called twice is the same piece, with its own row id", () => {
  const [a, b] = kidsOf(treeOf("TreeTwice"));
  expect([a?.id, b?.id]).toEqual(["root/Game value", "root/Game value#2"]);
  expect(a?.pieceKey).toBe(b?.pieceKey);
});

test("a cache read written by a call opens under it; one from the game is saved by the game", () => {
  const [cache] = kidsOf(treeOf("TreeCacheRead"));
  expect(cache).toMatchObject({
    code: "DNSM.TreeCache.total",
    value: 8,
    kids: "lazy",
  });
  const [game] = kidsOf(treeOf("TreeGameCache"));
  expect(game).toMatchObject({
    code: "DNSM.GameCache.v",
    value: 5,
    flags: { unnamed: true, fromCache: true },
    kids: [],
  });
});

test("the piece keys carry the requested character", () => {
  const root = treeOf("TreeSources", mosaicOf(), 1);
  expect(root.pieceKey).toBe('[1,"TreeSources",0,0,0]');
  expect(kidsOf(root)[0]?.pieceKey).toBe('[1,"TreeReads"]');
});

test("a root that fails is unavailable, with nothing under it", () => {
  const root = buildTree(
    recorder.record(
      mosaicOf({ Scenario: "throw" }),
      [["PlayerHPmax", [0, 0, 0]]],
      NONE,
    ),
    0,
  ).root;
  expect(root).toMatchObject({
    value: null,
    flags: { unavailable: true },
    kids: [],
  });
});

test("a text read is no row: its value is not a number", () => {
  const names = kidsOf(treeOf("TreeTextValue")).map((k) => k.code);
  expect(names).toEqual([]);
});
