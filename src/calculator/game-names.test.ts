// The names read from the installed game's tables (spec 008, T023): over the invented game's lists, a recipe resolves
// only when its table's sha256 is the one given; a reading that fails or does not come back as text names nothing.
import { createHash } from "node:crypto";
import { beforeAll, expect, test } from "vitest";
import { GAME, PAK } from "./fixtures/fake-mosaic.ts";
import { readGameNames } from "./game-names.ts";
import { nameOf, useGameNames } from "./tree/names.ts";
import { NAME_RECIPES } from "./tree/names-table.ts";
import type { NameRecipe } from "./tree/names-table.ts";
import { createTreeEngine } from "./tree-engine.ts";
import { bootRecorder, TREE_LIMITS } from "./tree-record.ts";

let context: ReturnType<typeof bootRecorder>["context"];
beforeAll(() => {
  context = bootRecorder(GAME, PAK).context;
});

const recipe = (
  key: string,
  index: number[],
  transform: string,
  template: string | null = null,
): NameRecipe => ({
  key,
  template,
  parts: [{ table: "CustomLists.ListNames", index, field: null, transform }],
});
const RECIPES = [
  recipe("First()", [0, 0], "clean", "{0} (invented)"),
  recipe("Half()", [1, 0], "clean(split '|' [1])"),
  recipe("Number()", [0, 1], "clean"),
  recipe("Missing()", [5, 0], "clean"),
];
/** The bench's canonical form of the invented list: an array is itself. */
const LIST = JSON.stringify([["FIRST_INVENTED_II", 7], ["second|half"]]);
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

test("each recipe over the game's own table, its hash the bench's", () => {
  const names = readGameNames(
    context,
    TREE_LIMITS.startMs,
    RECIPES,
    new Map([["CustomLists.ListNames", sha(LIST)]]),
  );
  expect([...names]).toEqual([
    ["First()", "First Invented II (invented)"],
    ["Half()", "half"],
  ]);
  expect(context.sandbox.__namesAsk).toBeUndefined();
});

test.each([
  ["another hash", new Map([["CustomLists.ListNames", sha("[]")]])],
  ["no hash of the table", new Map([["CustomLists.Other", sha(LIST)]])],
  [
    "a table the game does not have",
    new Map([["CustomLists.Nowhere", sha(LIST)]]),
  ],
])("with %s, no recipe of the table has a name", (_name, hashes) => {
  expect(
    readGameNames(context, TREE_LIMITS.startMs, RECIPES, hashes).size,
  ).toBe(0);
});

test("an item's hash is its entry's", () => {
  const item: NameRecipe = {
    key: "Item()",
    template: null,
    parts: [
      {
        table: "ItemDefinitionsGET",
        index: ["itemA"],
        field: "v",
        transform: "clean",
      },
    ],
  };
  const entry = sha(JSON.stringify({ v: 1 }));
  // the field is a number, no text: the hash matched, and still no name
  expect(
    readGameNames(
      context,
      TREE_LIMITS.startMs,
      [item, ...RECIPES],
      new Map([
        ["ItemDefinitionsGET.itemA", entry],
        ["CustomLists.ListNames", sha(LIST)],
      ]),
    ).get("First()"),
  ).toBe("First Invented II (invented)");
});

test.each<[string, () => unknown]>([
  [
    "a reading out of time",
    () => {
      throw new Error("timeout");
    },
  ],
  ["a reading that is no text", () => 5],
  [
    "a reading of another shape",
    () => JSON.stringify({ texts: [1], forms: [] }),
  ],
  ["a reading without its forms", () => JSON.stringify({ texts: [] })],
  // a value of the context is never called, not even its toString
  ["a reading that is an object", () => ({ toString: () => good })],
  [
    "texts that are no list",
    () => JSON.stringify({ texts: "ABCD", forms: [LIST] }),
  ],
  [
    "forms that are no list",
    () =>
      JSON.stringify({
        texts: ["A", "B", "C", "D"],
        forms: { length: 1, 0: LIST },
      }),
  ],
  [
    "fewer texts than cells",
    () => JSON.stringify({ texts: ["FIRST"], forms: [LIST] }),
  ],
  [
    "more forms than tables",
    () => JSON.stringify({ texts: ["A", "B", "C", "D"], forms: [LIST, LIST] }),
  ],
  [
    "a text that is a number",
    () => JSON.stringify({ texts: [5, "B", "C", "D"], forms: [LIST] }),
  ],
])("%s names nothing", (_name, run) => {
  expect(
    readGameNames(
      { sandbox: {}, run },
      1,
      RECIPES,
      new Map([["CustomLists.ListNames", sha(LIST)]]),
    ).size,
  ).toBe(0);
});

/** What the reader gives for RECIPES when the list is unchanged: every cell's text, the list's form. */
const good = JSON.stringify({ texts: ["A", "B", "C", "D"], forms: [LIST] });
test("the reading the cases above break gives names", () => {
  expect(
    readGameNames(
      { sandbox: {}, run: () => good },
      1,
      RECIPES,
      new Map([["CustomLists.ListNames", sha(LIST)]]),
    ).get("First()"),
  ).toBe("A (invented)");
});

test("the reader gives each cell's text, and each table in the bench's canonical form", () => {
  context.sandbox.__ask = JSON.stringify({
    cells: [
      ["CustomMaps.MapNames", ["z", "b"], null],
      ["CustomMaps.MapNames", ["z"], "b"],
      ["CustomMaps.MapNames", [], "y"],
      ["CustomMaps.MapNames", ["z", "a"], null],
      ["CustomMaps.Nowhere", [0], null],
      // a list is never a map, whatever it carries; an empty map is no map
      ["CustomMaps.MapNames", ["list", 0], null],
      ["CustomMaps.MapNames", ["empty", "h"], null],
      ["CustomMaps.MapNames", ["text", "h"], null],
      ["ItemDefinitionsGET", ["itemA"], "v"],
    ],
    tables: [
      "CustomMaps.MapNames",
      "ItemDefinitionsGET.itemB",
      "CustomMaps.Nowhere",
      "CustomMaps.__proto__",
      "Nowhere.X",
    ],
  });
  expect(JSON.parse(String(context.run("__names.read(__ask)", 1_000)))).toEqual(
    {
      texts: ["BEE", "BEE", "WHY", null, null, "ZERO", null, "AITCH", null],
      forms: [
        '{"both":{"a":2,"h":{"q":1}},"empty":{"h":null},"list":["ZERO"],"text":{"h":"AITCH"},"y":"WHY","z":{"a":[1],"b":"BEE"}}',
        '{"v":2}',
        null,
        null,
        null,
      ],
    },
  );
});

test("the engine reads the game's names at its boot", () => {
  const key = NAME_RECIPES[0]?.key ?? "";
  useGameNames(new Map([[key, "Left from another game"]]));
  createTreeEngine(GAME, PAK);
  // the invented game has none of the bench's tables: no recipe resolves
  expect(nameOf(key)).toBeNull();
});
