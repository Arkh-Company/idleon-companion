// The root and the first level of a tree, built from a recording of the invented game (spec 008, T024, research R4):
// the rows under the root are the root block's own calls and state reads, and a row with more under it is "lazy".
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "./fixtures/fake-mosaic.ts";
import type { CalcTreeNode } from "./tree-contract.ts";
import { buildTree } from "./tree-build.ts";
import { bootRecorder } from "./tree-record.ts";
import { kidsOf } from "./tree/tree-fixture.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});

const NONE = { recompute: [], builders: [] };
const treeOf = (block: string, mosaic = mosaicOf(), character = 0) =>
  buildTree(
    recorder.record(mosaic, [[block, [0, 0, 0]]], NONE),
    character,
    recorder.ops,
  ).root;
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
  });
  // the root has its name, "Total", whatever its call's (the window shows "no name yet" otherwise)
  expect(root.flags).toEqual({});
});

test("a root whose last step is no sum or product: its calls, in order, then its state reads", () => {
  expect(rows(treeOf("TreeMaxOf"))).toEqual([
    ["TreeReads()", 8, "lazy"],
    ["TreeLoop()", 6, "lazy"],
    ["TreeBase", 4, 0],
  ]);
});

test("a call row carries its piece key and its call with the game's arity, and the generic name", () => {
  const [reads] = kidsOf(treeOf("TreeMaxOf"));
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
    // share.ts with no ⓘ yet: the max equals this part alone, the subset scan's product
    share: 1,
    shareMode: "product",
    flags: { unnamed: true },
    kids: "lazy",
  });
});

test("a state read is a leaf of unknown kind, keyed by its path", () => {
  const leaf = kidsOf(treeOf("TreeMaxOf")).at(-1);
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
  expect([a?.id, b?.id]).toEqual([
    "root/Additive pool/Game value",
    "root/Additive pool/Game value#2",
  ]);
  expect(a?.pieceKey).toBe(b?.pieceKey);
});

test("a game-bug rule tags each row that counts the source twice, keeps the game's values and tags nothing elsewhere (FR-016)", () => {
  const bugs = [
    {
      id: "inventedTwice",
      in: /^TreeTwice\(/,
      test: /^TreeReads\(\)$/,
      proof: "N.js TreeTwice",
    },
  ];
  const build = (block: string) =>
    buildTree(
      recorder.record(mosaicOf(), [[block, [0, 0, 0]]], NONE),
      0,
      recorder.ops,
      bugs,
    ).root;
  const twice = build("TreeTwice");
  expect(twice.value).toBe(16);
  expect(kidsOf(twice).map((k) => [k.value, k.flags.gameBug])).toEqual([
    [8, "inventedTwice"],
    [8, "inventedTwice"],
  ]);
  expect(twice.flags.gameBug).toBeUndefined();
  const once = kidsOf(build("TreeMaxOf"));
  expect(once.map((k) => k.flags.gameBug)).toEqual([
    undefined,
    undefined,
    undefined,
  ]);
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
    name: "Working value of the game (GameCache)",
    value: 5,
    flags: { fromCache: true },
    kids: [],
  });
});

test("a step of the first level is never named by its shape: no name yet (FR-006)", () => {
  // TreeTopRound: round(the cache × 1.5), its 1.5 a constant of the game's code (the assembly's "× 1.5")
  const [cache, constant] = kidsOf(treeOf("TreeTopRound"));
  expect(cache?.name).toBe("Working value of the game (GameCache)");
  expect(constant).toMatchObject({
    name: "Game value",
    value: 1.5,
    leaf: "fixedValue",
    flags: { unnamed: true },
  });
});

test("the piece keys carry the requested character", () => {
  const root = treeOf("TreeMaxOf", mosaicOf(), 1);
  expect(root.pieceKey).toBe('[1,"TreeMaxOf",0,0,0]');
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

test("a text read is no row: its value is not a number; the lengths of the step are values with no source", () => {
  const rows = kidsOf(treeOf("TreeTextValue")).map((k) => [k.code, k.leaf]);
  expect(rows).toEqual([
    [null, "unknown"],
    [null, "unknown"],
  ]);
});
