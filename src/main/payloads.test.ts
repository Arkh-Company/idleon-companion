// The shape checks of what reaches the main process from the window (IPC) and from the keeper (link).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { DEFAULT_SETTINGS, READ_NULLS } from "../shared/index.ts";
import type { Reading, Status } from "../shared/index.ts";
import {
  emptyPayload,
  linkGameFiles,
  linkReading,
  linkState,
  linkStatus,
  linkTables,
  settingsPayload,
} from "./payloads.ts";

test("a settings payload with the three booleans passes, unknown keys dropped", () => {
  expect(
    settingsPayload({ ...DEFAULT_SETTINGS, alwaysOnTop: true, x: 1 }),
  ).toEqual({ ...DEFAULT_SETTINGS, alwaysOnTop: true });
});

test.each([
  ["no object", null],
  ["a missing key", { showWindowOnGameStart: true, closeWithGame: true }],
  ["a key of the wrong type", { ...DEFAULT_SETTINGS, closeWithGame: "no" }],
])("a settings payload with %s is refused", (_name, payload) => {
  expect(settingsPayload(payload)).toBeNull();
});

const reading: Reading = {
  t: 5,
  map: 264,
  menu: 3,
  menu2: 0,
  menu2tab: 0,
  skillTab: 0,
  char: "Tester",
  afk: null,
  codexTab: 2,
  ...READ_NULLS,
};

test("a link reading of the right shape keeps its time", () => {
  expect(linkReading(reading)).toEqual(reading);
});

test.each([
  ["no time", { ...reading, t: undefined }],
  ["a time that is not a number", { ...reading, t: "5" }],
  ["a field of the wrong type", { ...reading, map: "264" }],
  ["no object", "reading"],
])("a link reading with %s is refused", (_name, value) => {
  expect(linkReading(value)).toBeNull();
});

const status: Status = {
  game: "running",
  reader: "attached",
  message: "Reading failed: x",
  lastReadingAt: 9,
};

test("a link status of the right shape keeps only its fields", () => {
  expect(linkStatus({ ...status, extra: 1 })).toEqual(status);
});

test("a link status without the optional fields passes", () => {
  expect(linkStatus({ game: "closed", reader: "error" })).toStrictEqual({
    game: "closed",
    reader: "error",
  });
});

test("a link status with the reader released passes", () => {
  expect(linkStatus({ game: "running", reader: "released" })).toStrictEqual({
    game: "running",
    reader: "released",
  });
});

test.each([
  ["a game outside its values", { ...status, game: "paused" }],
  ["a reader outside its values", { ...status, reader: "lost" }],
  ["a paused reader", { ...status, reader: "paused" }],
  ["a message that is not text", { ...status, message: 5 }],
  [
    "a last reading time that is not a number",
    { ...status, lastReadingAt: "9" },
  ],
  ["no object", "status"],
])("a link status with %s is refused", (_name, value) => {
  expect(linkStatus(value)).toBeNull();
});

const tables = { maps: ["Vale", "Peak"], monsters: { a1: "Beast" } };

test("link tables of the right shape keep only their fields", () => {
  expect(linkTables({ ...tables, extra: 1 })).toStrictEqual(tables);
  expect(linkTables({ maps: null, monsters: null })).toStrictEqual({
    maps: null,
    monsters: null,
  });
});

test.each([
  [
    "a number in maps",
    { ...tables, maps: ["Vale", 1] },
    { ...tables, maps: null },
  ],
  [
    "maps that are not a list",
    { ...tables, maps: "Vale" },
    { ...tables, maps: null },
  ],
  [
    "a number in monsters",
    { ...tables, monsters: { a1: 1 } },
    { ...tables, monsters: null },
  ],
  [
    "an array as monsters",
    { ...tables, monsters: ["Beast"] },
    { ...tables, monsters: null },
  ],
])(
  "link tables with %s count as unread for that table only",
  (_name, value, expected) => {
    expect(linkTables(value)).toStrictEqual(expected);
  },
);

test.each([
  ["a text", "tables"],
  ["null", null],
  ["a list", []],
])("link tables whose body is %s give both null", (_name, value) => {
  expect(linkTables(value)).toStrictEqual({ maps: null, monsters: null });
});

const slice = {
  sentinel: { char: "A", map: 7 },
  pieces: [
    { path: ["Cards"], value: [1, 2] },
    { path: ["PlayerDATABASE", "A"], value: { $m: {} } },
  ],
  at: 5,
  cycles: { fast: 1, all: 0 },
};
const withPiece = (piece: unknown) => ({ ...slice, pieces: [piece] });

test("a link slice of the right shape keeps only its fields", () => {
  const padded = {
    ...slice,
    extra: 1,
    sentinel: { ...slice.sentinel, extra: 1 },
    pieces: slice.pieces.map((p) => ({ ...p, extra: 1 })),
    cycles: { ...slice.cycles, extra: 1 },
  };
  expect(linkState(padded)).toStrictEqual(slice);
});

test("a link slice taken with no character passes", () => {
  const noChar = { ...slice, sentinel: { char: null, map: 7 } };
  expect(linkState(noChar)).toStrictEqual(noChar);
});

test("the value of a piece is not inspected", () => {
  const odd = withPiece({ path: ["Cards"], value: "anything" });
  expect(linkState(odd)).toStrictEqual(odd);
});

test("a character's subkey, the third level, passes", () => {
  const subkey = withPiece({
    path: ["PlayerDATABASE", "A", "SkillLevels"],
    value: [1],
  });
  expect(linkState(subkey)).toStrictEqual(subkey);
});

test.each([
  ["no object", "state"],
  ["a list", []],
  ["no sentinel", { ...slice, sentinel: undefined }],
  ["a character that is a number", { ...slice, sentinel: { char: 1, map: 7 } }],
  ["no character", { ...slice, sentinel: { map: 7 } }],
  [
    "a map that is not a number",
    { ...slice, sentinel: { char: "A", map: "7" } },
  ],
  ["a time that is not a number", { ...slice, at: "5" }],
  ["pieces that are not a list", { ...slice, pieces: {} }],
  ["a piece that is not an object", withPiece(null)],
  ["a path that is not a list", withPiece({ path: "Cards", value: 1 })],
  ["a path of no items", withPiece({ path: [], value: 1 })],
  ["a path of 3 items", withPiece({ path: ["a", "b", "c"], value: 1 })],
  [
    "a path of 3 items on a split map other than the characters",
    withPiece({ path: ["DNSM", "b", "c"], value: 1 }),
  ],
  [
    "a path of 4 items",
    withPiece({ path: ["PlayerDATABASE", "A", "b", "c"], value: 1 }),
  ],
  [
    "a third level that is not text",
    withPiece({ path: ["PlayerDATABASE", "A", 1], value: 1 }),
  ],
  ["a path item that is not text", withPiece({ path: ["a", 1], value: 1 })],
  ["no cycles", { ...slice, cycles: undefined }],
  [
    "a formula cycle that is not a number",
    { ...slice, cycles: { fast: "1", all: 0 } },
  ],
  [
    "an all cycle that is not a number",
    { ...slice, cycles: { fast: 1, all: null } },
  ],
])("a link slice with %s is refused", (_name, value) => {
  expect(linkState(value)).toBeNull();
});

test.each([
  ["the game's folder", "C:\\Steam\\Game\\resources"],
  ["another case", "D:\\Game\\RESOURCES"],
  ["a closing separator", "C:\\Game\\Resources\\"],
  ["forward slashes", "C:/Game/resources"],
])("link game files with %s pass", (_name, path) => {
  expect(linkGameFiles(path)).toBe(path);
});

test.each([
  ["no text", 5],
  ["an empty text", ""],
  ["a relative path", "Game\\resources"],
  ["only the folder name", "resources"],
  ["a drive-relative path", "C:resources"],
  ["another last folder", "C:\\Game\\resources\\app"],
  ["a name that only ends like it", "C:\\Game\\myresources"],
  ["a network path", "\\\\server\\share\\resources"],
  ["a network path with forward slashes", "//server/share/resources"],
  ["a path with no drive", "\\Game\\resources"],
  ["a long network path", "\\\\?\\UNC\\server\\share\\resources"],
  ["a long path on a drive", "\\\\?\\C:\\Game\\resources"],
])("link game files with %s are refused", (_name, value) => {
  expect(linkGameFiles(value)).toBeNull();
});

// settings:get, steam:state, steam:setup, reader:release, reader:reconnect and update:install carry no body.
test.each([
  ["a missing body", undefined],
  ["an empty object", {}],
])("a bodiless channel accepts %s", (_name, payload) => {
  expect(emptyPayload(payload)).toBe(true);
});

test.each([
  ["null", null],
  ["an object with a field", { account: "102" }],
  ["an array", []],
  ["a text", ""],
  ["a number", 0],
  ["a boolean", false],
])("a bodiless channel refuses %s", (_name, payload) => {
  expect(emptyPayload(payload)).toBe(false);
});

// ponytail: reads the source because index.ts imports electron and no test may load it.
test("settings:get refuses a body before it answers", () => {
  const source = readFileSync(join(import.meta.dirname, "index.ts"), "utf8");
  expect(source).toMatch(
    /handle\(IPC\.settingsGet, \(payload\) => \{\s+if \(!emptyPayload\(payload\)\)\s+throw /,
  );
});

test("reader:confirm-attach refuses a body before it acts", () => {
  const source = readFileSync(join(import.meta.dirname, "index.ts"), "utf8");
  expect(source).toMatch(
    /handle\(IPC\.confirmAttach, \(payload\) => \{\s+if \(!emptyPayload\(payload\)\)\s+throw /,
  );
});
