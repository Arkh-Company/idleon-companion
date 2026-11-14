// The tree engine over the invented game: a `number` request gives the root, equal to the Stats number of the same
// mosaic (FR-019), and nothing outside the catalog is calculated.
import { beforeAll, expect, test } from "vitest";
import { createEngine } from "./engine.ts";
import { GAME, mosaicOf, PAK } from "./fixtures/fake-mosaic.ts";
import { TARGETS } from "./targets.ts";
import type { CalcTreeNode } from "./tree-contract.ts";
import { createTreeEngine } from "./tree-engine.ts";
import { TREE_ROOTS } from "./tree-roots.ts";

let trees: ReturnType<typeof createTreeEngine>;
beforeAll(() => {
  trees = createTreeEngine(GAME, PAK, {
    ...TREE_ROOTS,
    sources: ["TreeMaxOf", [0, 0, 0]],
  });
});

const number = (id: string) => ({ type: "number", id, character: 0 });

test("each Stats root equals the Stats number of the same mosaic", () => {
  const mosaic = mosaicOf({
    Stats: { STR: 1, AGI: 2, WIS: 3, LUK: 4, Drop_Rarity: 9.5 },
  });
  const stats = createEngine(GAME, PAK).calculate(mosaic);
  for (const [id] of TARGETS) {
    const root = trees.tree(number(id), mosaic);
    expect(root).not.toBe("unknownNumber");
    if (root === "unknownNumber") return;
    expect(root.value).toBe(stats[id]);
  }
});

test("values gives each Stats number of the same mosaic, and null outside the roots", () => {
  const mosaic = mosaicOf({ Stats: { STR: 7, Drop_Rarity: 3.5 } });
  const stats = createEngine(GAME, PAK).calculate(mosaic);
  const ids = [...TARGETS.map(([id]) => id), "notANumber", "__proto__"];
  expect(trees.values(ids, mosaic)).toEqual(
    Object.fromEntries([
      ...TARGETS.map(([id]) => [id, stats[id]]),
      ["notANumber", null],
      ["__proto__", null],
    ]),
  );
});

test("values records nothing: the last tree's branches still open", () => {
  const [reads] = kidsOf(trees.tree(number("sources"), mosaicOf()));
  trees.values(["hp"], mosaicOf({ Stats: { STR: 2 } }));
  expect(
    trees.tree(expand("sources", reads?.id ?? ""), undefined),
  ).toMatchObject({ id: reads?.id, value: 8 });
});

test.each([
  ["ids that are no list", "hp", mosaicOf()],
  ["a mosaic that is not text", ["hp"], { attrs: {} }],
])("values with %s throws", (_name, ids, mosaic) => {
  expect(() => trees.values(ids, mosaic)).toThrow();
});

test("the root of the Drop Rate", () => {
  expect(trees.tree(number("dropRate"), mosaicOf())).toEqual({
    id: "root",
    pieceKey: '[0,"TotalStats","Drop_Rarity",0,0]',
    name: "Total",
    value: 2.5,
    fmt: null,
    leaf: null,
    condition: null,
    why: null,
    formula: null,
    code: 'TotalStats("Drop_Rarity", 0, 0)',
    role: "root",
    share: null,
    shareMode: null,
    flags: { unnamed: true },
    kids: [
      {
        id: "root/Game value",
        pieceKey: '[0,"Stats.Drop_Rarity"]',
        name: "Game value",
        value: 2.5,
        fmt: null,
        leaf: "tier", // the bench's rule on a code with "rarity" in it
        condition: null,
        why: null,
        formula: null,
        code: "Stats.Drop_Rarity",
        role: "piece",
        share: 1,
        shareMode: "sum",
        flags: { unnamed: true },
        kids: [],
      },
    ],
  });
});

test("a root that fails is unavailable", () => {
  const root = trees.tree(number("hp"), mosaicOf({ Scenario: "throw" }));
  expect(root).toMatchObject({ value: null, flags: { unavailable: true } });
});

test.each(["notANumber", "__proto__", "constructor"])("%s is refused", (id) => {
  expect(trees.tree(number(id), mosaicOf())).toBe("unknownNumber");
});

test.each([
  ["an expand before any tree", { type: "expand", treeId: "t", nodeId: "n" }],
  ["no request", null],
  ["a request without id", { type: "number" }],
])("%s throws", (_name, request) => {
  expect(() => trees.tree(request, mosaicOf())).toThrow();
});

test("a mosaic that is not text throws", () => {
  expect(() => trees.tree(number("dropRate"), { attrs: {} })).toThrow();
});

const expand = (treeId: string, nodeId: string) => ({
  type: "expand",
  treeId,
  nodeId,
});
const kidsOf = (n: CalcTreeNode | "unknownNumber") =>
  n !== "unknownNumber" && Array.isArray(n.kids) ? n.kids : [];

test("an expand opens a branch of the last tree, with no mosaic: nothing is recorded again", () => {
  const [reads] = kidsOf(trees.tree(number("sources"), mosaicOf()));
  expect(reads).toMatchObject({ code: "TreeReads()", kids: "lazy" });
  const branch = trees.tree(expand("sources", reads?.id ?? ""), undefined);
  expect(branch).toMatchObject({ id: reads?.id, value: 8 });
  expect(kidsOf(branch).map((k) => [k.code, k.value])).toEqual([
    ["TreeStats.a", 3],
    ["TreeStats.b", 5],
  ]);
});

test.each([
  ["another tree", "dropRate", "root/Game value"],
  ["a row that is no lazy branch", "sources", "root"],
  ["an unknown row", "sources", "root/nowhere"],
])("an expand of %s throws", (_name, treeId, nodeId) => {
  trees.tree(number("sources"), mosaicOf());
  expect(() => trees.tree(expand(treeId, nodeId), undefined)).toThrow();
});

test.each(["dropRate", "notANumber"])(
  "a new number request (%s) replaces the kept recording",
  (next) => {
    const [reads] = kidsOf(trees.tree(number("sources"), mosaicOf()));
    trees.tree(number(next), mosaicOf());
    expect(() =>
      trees.tree(expand("sources", reads?.id ?? ""), undefined),
    ).toThrow();
  },
);
