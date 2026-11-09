// The map and monster names taken from the text of the installed game. All the "game code" here is made up (FR-015).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { readGameTables, screenNumbers } from "./game-tables.ts";

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

test.each([
  ["a write", "e.h.MenuType2=7;", [7]],
  ["a write with spaces", "e.h.MenuType2 = 7;", [7]],
  ["a comparison", 'if(99==$a.b.getGameAttribute("MenuType2"))c();', [99]],
  ["a negative number", "e.h.MenuType2=-1;", [-1]],
  ["a fraction", "e.h.MenuType2=1.5;", [1.5]],
])("screenNumbers finds %s of MenuType2", (_name, code, numbers) => {
  expect(screenNumbers(code)).toEqual(numbers);
});

test.each([
  ["MenuType written", "e.h.MenuType=7;"],
  ["MenuType compared", '7==a.getGameAttribute("MenuType");'],
  ["the tab written", "e.h.MenuType2TabSelected=3;"],
  ["the tab compared", '3==a.getGameAttribute("MenuType2TabSelected");'],
  ["a number that runs into a property", "e.h.MenuType2=7.x;"],
  ["a number that starts an expression", "e.h.MenuType2=100+r;"],
  ["a number at the end of a name", 'a999==b.getGameAttribute("MenuType2");'],
])("screenNumbers ignores %s", (_name, code) => {
  expect(screenNumbers(code)).toEqual([]);
});

test("screenNumbers sorts by value and drops repeats", () => {
  expect(
    screenNumbers(
      'e.h.MenuType2=30;e.h.MenuType2=7;100==a.getGameAttribute("MenuType2");7==a.getGameAttribute("MenuType2");',
    ),
  ).toEqual([7, 30, 100]);
});

const RUNS_TEXT: [string, RegExp][] = [
  ["eval", /\beval\b/],
  ["new Function", /\bnew\s+Function\b/],
  ["vm module", /["'](?:node:)?vm["']/],
  ["require(", /\brequire\s*\(/],
];

// Every file of the keeper, read.js and mock-game/ included; tests never ship.
const KEEPER_SOURCES = readdirSync(import.meta.dirname, {
  recursive: true,
  encoding: "utf8",
})
  .map((f) => f.replaceAll("\\", "/"))
  .filter(
    (f) => /\.(?:tsx?|c?js|mjs|html)$/.test(f) && !/\.test\.tsx?$/.test(f),
  )
  .map((file) => ({
    file,
    text: readFileSync(join(import.meta.dirname, file), "utf8"),
  }));

test("the scan for running the game code reads the whole keeper", () => {
  const files = KEEPER_SOURCES.map((s) => s.file);
  for (const f of [
    "game-tables.ts",
    "keeper.ts",
    "update-watch.ts",
    "reader.ts",
    "read.js",
  ])
    expect(files).toContain(f);
  expect(files.filter((f) => f.startsWith("mock-game/"))).not.toEqual([]);
});

test.each(RUNS_TEXT)(
  "no file of the keeper, where the game code passes as text, uses %s",
  (_name, form) => {
    expect(
      KEEPER_SOURCES.filter((s) => form.test(s.text)).map((s) => s.file),
    ).toEqual([]);
  },
);

test.each([
  ["eval(code);", "eval"],
  ["(0, globalThis.eval)(code);", "eval"],
  ["new  Function(code)();", "new Function"],
  ['import vm from "node:vm";', "vm module"],
  ["import vm from 'vm';", "vm module"],
  ['const vm = await import("node:vm");', "vm module"],
  ['const m = require ("x");', "require("],
])("the scan catches %s", (line, name) => {
  expect(RUNS_TEXT.find(([n]) => n === name)?.[1].test(line)).toBe(true);
});
