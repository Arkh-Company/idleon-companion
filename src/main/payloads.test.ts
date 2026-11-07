// The shape checks of what reaches the main process from the window (IPC) and from the keeper (link).
import { expect, test } from "vitest";
import { DEFAULT_SETTINGS } from "../shared/index.ts";
import type { Reading, Status } from "../shared/index.ts";
import {
  linkReading,
  linkStatus,
  namePayload,
  settingsPayload,
} from "./payloads.ts";

test("a name payload with a known table, a number key and a name passes, the name trimmed", () => {
  expect(
    namePayload({ table: "menu2", key: "999", name: " Test ", x: 1 }),
  ).toEqual({ table: "menu2", key: "999", name: "Test" });
  expect(namePayload({ table: "menu", key: "0.1", name: "A" })?.key).toBe(
    "0.1",
  );
});

test.each([
  ["no object", "menu2"],
  ["an unknown table", { table: "quickref", key: "1", name: "A" }],
  ["a key that is not text", { table: "menu", key: 1, name: "A" }],
  ["a key that is not a number", { table: "menu", key: "abc", name: "A" }],
  ["a key that is not finite", { table: "menu", key: "NaN", name: "A" }],
  ["a key written another way", { table: "menu", key: "01", name: "A" }],
  ["a name that is not text", { table: "codex", key: "1", name: 5 }],
  ["an empty name", { table: "codex", key: "1", name: "" }],
  ["a blank name", { table: "codex", key: "1", name: "   " }],
])("a name payload with %s is refused", (_name, payload) => {
  expect(namePayload(payload)).toBeNull();
});

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
  char: "Darkhe",
  afk: null,
  codexTab: 2,
  codexSel: null,
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

test.each([
  ["a game outside its values", { ...status, game: "paused" }],
  ["a reader outside its values", { ...status, reader: "lost" }],
  ["a message that is not text", { ...status, message: 5 }],
  [
    "a last reading time that is not a number",
    { ...status, lastReadingAt: "9" },
  ],
  ["no object", "status"],
])("a link status with %s is refused", (_name, value) => {
  expect(linkStatus(value)).toBeNull();
});
