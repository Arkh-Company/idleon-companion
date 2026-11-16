// The tree engine over the invented game: a `number` request gives the root, equal to the Stats number of the same
// mosaic (FR-019), and nothing outside the catalog is calculated.
import { beforeAll, expect, test, vi } from "vitest";
import { createEngine } from "./engine.ts";
import { GAME, mosaicOf, PAK } from "./fixtures/fake-mosaic.ts";
import { TARGETS } from "./targets.ts";
import type { CalcTreeNode } from "./tree-contract.ts";
import { createTreeEngine, shapeOf } from "./tree-engine.ts";
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

// SC-001, US6: 10 item swaps in a row over the same worker, the root of each Stats number equal to the Stats each time.
test("over 10 mosaics in a row, as 10 item swaps, each root still equals the Stats number", () => {
  const stats = createEngine(GAME, PAK);
  for (let swap = 1; swap <= 10; swap++) {
    const mosaic = mosaicOf({
      Stats: {
        STR: swap,
        AGI: 2 * swap,
        WIS: 3,
        LUK: swap % 4,
        Drop_Rarity: swap / 2,
      },
    });
    const numbers = stats.calculate(mosaic);
    for (const [id] of TARGETS) {
      const root = trees.tree(number(id), mosaic);
      expect(root === "unknownNumber" ? root : root.value).toBe(numbers[id]);
    }
  }
  // 10 recordings of 11 trees: about 6.5 s under the whole suite, against the 5 s default (under 1 s alone).
}, 30_000);

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

// "Game changed" by a part of an open node (FR-024): a part's piece key is its call, calculated as a root is.
test("values gives a call's piece key its number, and null to a read path or a key that is no call", () => {
  const mosaic = mosaicOf({ Stats: { STR: 7, Drop_Rarity: 3.5 } });
  const [block, args] = TREE_ROOTS.hp ?? ["", []];
  const call = JSON.stringify([0, block, ...args]);
  const values = trees.values(
    [call, '[0,"Some.read.path"]', "[0,1]", "[nope"],
    mosaic,
  );
  expect(values).toEqual({
    [call]: trees.values(["hp"], mosaic).hp,
    '[0,"Some.read.path"]': null,
    "[0,1]": null,
    "[nope": null,
  });
  expect(values[call]).toEqual(expect.any(Number));
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
    flags: {},
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

// Where this goes (FR-027): the shape of a number is every part of its tree, its branches opened, each piece once.
test("a shape lists every part of the tree with its branches opened, each piece once", () => {
  const shape = trees.shape("sources", mosaicOf());
  expect(shape).not.toBe("unknownNumber");
  if (shape === "unknownNumber") return;
  expect(shape.map(([key]) => key)).toEqual([
    '[0,"TreeMaxOf",0,0,0]',
    '[0,"TreeReads"]',
    '[0,"TreeStats.a"]', // inside the lazy branch of TreeReads
    '[0,"TreeStats.b"]',
    '[0,"TreeLoop"]',
    '[0,"TreeList[0]"]',
    '[0,"TreeList[1]"]',
    '[0,"TreeList[2]"]',
    '[0,"TreeBase"]',
  ]);
  for (const [, name] of shape) expect(typeof name).toBe("string");
});

test("a piece that repeats opens once in a shape", () => {
  const lazy = (id: string): CalcTreeNode =>
    ({ id, pieceKey: "piece", name: "Part", kids: "lazy" }) as CalcTreeNode;
  const expand = vi.fn((id: string) => ({
    ...lazy(id),
    kids: [{ ...lazy(`${id}/leaf`), pieceKey: "leaf", kids: [] }],
  }));
  const root = {
    ...lazy("root"),
    pieceKey: "root",
    kids: [lazy("a"), lazy("b")],
  };
  expect(shapeOf({ root, expand, conflicts: [] })).toEqual([
    ["root", "Part"],
    ["piece", "Part"],
    ["leaf", "Part"],
  ]);
  expect(expand).toHaveBeenCalledOnce();
});

test("a shape records nothing that the last tree's branches need", () => {
  const [reads] = kidsOf(trees.tree(number("sources"), mosaicOf()));
  trees.shape("dropRate", mosaicOf());
  expect(
    trees.tree(expand("sources", reads?.id ?? ""), undefined),
  ).toMatchObject({ id: reads?.id, value: 8 });
});

test.each(["notANumber", "__proto__"])("the shape of %s is refused", (id) => {
  expect(trees.shape(id, mosaicOf())).toBe("unknownNumber");
});

test.each([
  ["an id that is no text", 7, mosaicOf()],
  ["a mosaic that is not text", "sources", { attrs: {} }],
])("a shape with %s throws", (_name, id, mosaic) => {
  expect(() => trees.shape(id, mosaic)).toThrow();
});
