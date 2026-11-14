// The tree engine over the invented game: a `number` request gives the root, equal to the Stats number of the same
// mosaic (FR-019), and nothing outside the catalog is calculated.
import { beforeAll, expect, test } from "vitest";
import { createEngine } from "./engine.ts";
import { GAME, mosaicOf, PAK } from "./fixtures/fake-mosaic.ts";
import { TARGETS } from "./targets.ts";
import { createTreeEngine } from "./tree-engine.ts";

let trees: ReturnType<typeof createTreeEngine>;
beforeAll(() => {
  trees = createTreeEngine(GAME, PAK);
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
        id: "root/Stats.Drop_Rarity",
        pieceKey: '[0,"Stats.Drop_Rarity"]',
        name: "Stats.Drop_Rarity",
        value: 2.5,
        fmt: null,
        leaf: "unknown",
        condition: null,
        why: null,
        formula: null,
        code: "Stats.Drop_Rarity",
        role: "piece",
        share: null,
        shareMode: null,
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
  [
    "an expand, before branches exist",
    { type: "expand", treeId: "t", nodeId: "n" },
  ],
  ["no request", null],
  ["a request without id", { type: "number" }],
])("%s throws", (_name, request) => {
  expect(() => trees.tree(request, mosaicOf())).toThrow();
});

test("a mosaic that is not text throws", () => {
  expect(() => trees.tree(number("dropRate"), { attrs: {} })).toThrow();
});
