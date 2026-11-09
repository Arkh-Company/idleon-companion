// The map and monster names taken from the text of the installed game. All the "game code" here is made up (FR-015).
import { expect, test } from "vitest";
import { readGameTables } from "./game-tables.ts";

const maps = (names: string, ids: string) =>
  `x.MapName=function(){return"${ids}".split(" ")},x.MapDispName=function(){return"${names}".split(" ")};`;
const monster = (id: string, name: string) =>
  `G.addNewMonster("${id}",{Name:"${name}",AFKtype:"X"});`;

const MAPS = maps("Blue_Vale Peak", "vale peak");
const MONSTER = monster("a1", "Beast");

test("maps come by number, with a space in place of the underscore", () => {
  expect(readGameTables(MAPS).maps).toEqual(["Blue Vale", "Peak"]);
});

test("monsters come by id, with a space in place of the underscore", () => {
  expect(
    readGameTables(monster("a1", "Beast_One") + monster("b2", "Beast"))
      .monsters,
  ).toEqual({ a1: "Beast One", b2: "Beast" });
});

test("a repeated monster id keeps the last, as in the game", () => {
  expect(
    readGameTables(monster("a1", "Beast") + monster("a1", "Other")).monsters,
  ).toEqual({ a1: "Other" });
});

test("the entry with a blank name stays in the table", () => {
  expect(readGameTables(monster("Nothing", " ")).monsters).toEqual({
    Nothing: " ",
  });
});

test("a monster id that is an Object.prototype name is an ordinary key", () => {
  const { monsters } = readGameTables(monster("__proto__", "Beast"));
  expect(Object.keys(monsters ?? {})).toEqual(["__proto__"]);
});

test("code with neither table gives null for both", () => {
  expect(readGameTables("var a=1;")).toEqual({ maps: null, monsters: null });
});

test.each([
  ["no match", 'x.MapDispName=["Vale","Peak"];x.MapName=["a","b"];'],
  [
    "only one of the two lists",
    'x.MapName=function(){return"a b".split(" ")};',
  ],
  ["two candidates", MAPS + maps("Other More", "c d")],
  ["lists of different lengths", maps("Vale Peak Hill", "a b")],
  ["an empty name in a list", maps("Vale  Peak", "a b c")],
  ["a list of one", maps("Vale", "a")],
])("maps with %s are null, and the monsters still read", (_name, code) => {
  expect(readGameTables(code + MONSTER)).toEqual({
    maps: null,
    monsters: { a1: "Beast" },
  });
});

test.each([
  ["no match", ""],
  [
    "one monster out of format",
    `${MONSTER}G.addNewMonster("b2",{Type:"X",Nome:"Y"});`,
  ],
  [
    "one monster that is not an object",
    `${MONSTER}G.addNewMonster("b2",someDefinition);`,
  ],
])("monsters with %s are null, and the maps still read", (_name, code) => {
  expect(readGameTables(MAPS + code)).toEqual({
    maps: ["Blue Vale", "Peak"],
    monsters: null,
  });
});
