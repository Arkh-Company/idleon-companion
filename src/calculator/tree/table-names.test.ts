// The names a rule reads from a game table at the row the tree asks (spec Open Questions: the turn recipes derived from
// the names table's, over the same reader and the same hash check), over invented tables in the bench's canonical form,
// as the boot keeps them (game-names.ts). No text of the game is in this file.
import { afterEach, expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import type { TurnRead } from "./entries.ts";
import { TABLE_HASHES } from "./names-table.ts";
import { row } from "./rows.ts";
import {
  isTextTable,
  partText,
  TABLE_TEXTS,
  tableText,
  useGameTables,
} from "./table-names.ts";
import { NO_NAME, turnName } from "./turn-names.ts";

afterEach(() => {
  useGameTables(new Map());
});

const TABLES = new Map<string, unknown>([
  ["CustomLists.StarSigns", [["SIGN_ZERO"], ["Sign_One", 5], [7]]],
  ["CustomLists.ArtifactInfo", [[], [], ["Invented_Relic"]]],
  ["CustomLists.GamingPalette", [[0, 1, 2, "Invented Hue"]]],
  ["CustomLists.SummonEnemies", [["mobA", "mobGone", "mobLong"]]],
  ["MonsterDefinitionsGET.mobA", { Name: "INVENTED_BEAST" }],
  // a text that may be a name, too long inside the turn's name
  ["MonsterDefinitionsGET.mobLong", { Name: "x".repeat(195) }],
  ["ItemDefinitionsGET.itemA", { displayName: "Invented|Charm" }],
  // an item's text that may be a name, too long in "Found …"
  ["ItemDefinitionsGET.itemLong", { displayName: "y".repeat(196) }],
]);
const passes = (name: string) =>
  checkTree(
    { id: "x", ...row({ pieceKey: null, value: 1, code: null, name }) },
    1,
  ) !== null;

test.each<[string, TurnRead[], string | null]>([
  [
    "the sign it found",
    [["DNSM.StarSignsDL contains 1", true]],
    "Sign One (sign 1)",
  ],
  ["a sign in capitals", [["DNSM.StarSignsDL[3]", 0]], "Sign Zero (sign 0)"],
  [
    "a sign whose cell is no text",
    [["DNSM.StarSignsDL[3]", 2]],
    "Star sign (sign 2)",
  ],
  [
    "a sign the table has not",
    [["DNSM.StarSignsDL[3]", 9]],
    "Star sign (sign 9)",
  ],
  [
    "a won battle",
    [["CustomLists.SummonEnemies[7][0]", 1]],
    "Battle 0 win (Invented Beast)",
  ],
  [
    "a battle whose monster the tables have not",
    [["CustomLists.SummonEnemies[7][1]", 1]],
    "Battle 1 win",
  ],
  [
    "a battle the table has not",
    [["CustomLists.SummonEnemies[7][3]", 1]],
    "Battle 3 win",
  ],
  ["an artifact", [["Sailing[3][2]", 1]], "Invented Relic (artifact 2)"],
  ["a colour", [["Spelunk[9][0]", 1]], "Invented Hue (palette 0)"],
  ["a found item", [["Cards[1] contains itemA", true]], "Found Invented Charm"],
  ["an item it did not find", [["Cards[1] contains itemA", false]], null],
  [
    "an item's definition",
    [["ItemDefinitionsGET.itemA.UQ1val", 3]],
    "Invented Charm",
  ],
  [
    "a found item and a sign: the item first",
    [
      ["DNSM.StarSignsDL[3]", 0],
      ["Cards[1] contains itemA", true],
    ],
    "Found Invented Charm",
  ],
  [
    "a sign and a battle: the sign first",
    [
      ["CustomLists.SummonEnemies[7][0]", 1],
      ["DNSM.StarSignsDL[3]", 0],
    ],
    "Sign Zero (sign 0)",
  ],
  [
    "a battle and an endless win: the battle first",
    [
      ["CustomLists.SummonEnemies[10][1]", 1],
      ["CustomLists.SummonEnemies[7][0]", 1],
    ],
    "Battle 0 win (Invented Beast)",
  ],
  [
    "a colour and an item's definition: the colour first",
    [
      ["ItemDefinitionsGET.itemA.UQ1val", 3],
      ["Spelunk[9][0]", 1],
    ],
    "Invented Hue (palette 0)",
  ],
  [
    "an item's definition and a table row's text: the item first",
    [
      ["CustomLists.Invented[2][0]", "ROW"],
      ["ItemDefinitionsGET.itemA.UQ1val", 3],
    ],
    "Invented Charm",
  ],
])("[turn recipes] the turn of %s", (_name, reads, name) => {
  useGameTables(TABLES);
  expect(turnName(reads, "DNSM.X")).toBe(name);
  if (name) expect(passes(name)).toBe(true);
});

// pieces.cjs turnName: a rule of an item always ends the search (the bench writes the item's id); with no text, no name
test.each<[string, TurnRead[]]>([
  ["a found item with no text", [["Cards[1] contains itemB", true]]],
  [
    "a found item with no text and a table row's text",
    [
      ["Cards[1] contains itemB", true],
      ["CustomLists.X[2][0]", "ROW"],
    ],
  ],
  [
    "a found item with no text and a sign",
    [
      ["DNSM.StarSignsDL[3]", 0],
      ["Cards[1] contains itemB", true],
    ],
  ],
  ["a definition with no text", [["ItemDefinitionsGET.itemB.UQ1val", 3]]],
  // family 2 (audit of 19/11): an artifact or a colour with no text is never named by its index
  ["an artifact with no text", [["Sailing[3][0]", 1]]],
  ["a colour with no text", [["Spelunk[9][5]", 1]]],
  // a rule that names the turn with a name too long to be one ends the search too
  [
    "a battle whose name would be too long",
    [["CustomLists.SummonEnemies[7][2]", 1]],
  ],
  [
    "a found item whose name would be too long and a table row's text",
    [
      ["Cards[1] contains itemLong", true],
      ["CustomLists.X[2][0]", "ROW"],
    ],
  ],
  [
    "a definition with no text and a table row's text",
    [
      ["CustomLists.X[2][0]", "ROW"],
      ["ItemDefinitionsGET.itemB.UQ1val", 3],
    ],
  ],
])("[turn recipes] the turn of %s has no name", (_name, reads) => {
  useGameTables(TABLES);
  expect(turnName(reads, "DNSM.X")).toBe(NO_NAME);
});

test("with no table of the game, a battle is its number and an item names nothing", () => {
  expect(turnName([["CustomLists.SummonEnemies[7][0]", 1]], "DNSM.X")).toBe(
    "Battle 0 win",
  );
  expect(turnName([["Cards[1] contains itemA", true]], "DNSM.X")).toBe(NO_NAME);
});

test.each<[string, unknown, string | null]>([
  ["a list's cell", [["A_TEXT"]], "A Text"],
  ["a cell that is no text", [[5]], null],
  ["a row the list has not", [], null],
  ["a cell of code", [["a; b"]], null],
  ["a cell too long", [["a".repeat(201)]], null],
])("a table text reads %s", (_name, table, text) => {
  useGameTables(new Map([["CustomLists.StarSigns", table]]));
  expect(tableText("sign", 0)).toBe(text);
});

test("a part reads only a text of its own table", () => {
  useGameTables(TABLES);
  const part = (index: (string | number)[], field: string | null = null) =>
    partText({
      table: "CustomLists.StarSigns",
      index,
      field,
      transform: "raw",
    });
  expect(part([1, 0])).toBe("Sign_One");
  expect(part([1, "length"])).toBeNull();
  expect(part([0, "constructor"])).toBeNull();
  expect(part([1, 0], "length")).toBeNull();
  // an entry's table is its own, by its id
  expect(
    partText({
      table: "ItemDefinitionsGET",
      index: ["itemA"],
      field: "displayName",
      transform: "raw",
    }),
  ).toBe("Invented|Charm");
  expect(
    partText({
      table: "ItemDefinitionsGET",
      index: ["mobA"],
      field: "Name",
      transform: "raw",
    }),
  ).toBeNull();
});

test("each table text reads a table the names table's recipes check by its hash", () => {
  for (const t of Object.values(TABLE_TEXTS)) {
    const ids = [...TABLE_HASHES.keys()].filter((id) => t.test.test(id));
    expect([t.table, ids.length > 0]).toEqual([t.table, true]);
    expect(
      ids.every((id) => id === t.table || id.startsWith(`${t.table}.`)),
    ).toBe(true);
  }
});

test("only the tables a table text reads are kept from the boot", () => {
  expect(
    [
      "CustomLists.StarSigns",
      "ItemDefinitionsGET.itemA",
      "MonsterDefinitionsGET.mobA",
      "CustomLists.StarSignsMore",
      "CustomLists.Other",
      "ItemDefinitionsGETX.itemA",
    ].map(isTextTable),
  ).toEqual([true, true, true, false, false, false]);
});
