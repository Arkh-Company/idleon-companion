// The shape checks of what reaches the main process from the window (IPC) and from the keeper (link).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { DEFAULT_SETTINGS, READ_NULLS } from "../shared/index.ts";
import type { Reading, Status } from "../shared/index.ts";
import {
  emptyPayload,
  linkReading,
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
