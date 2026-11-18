import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { DEFAULT_SETTINGS } from "../shared/index.ts";
import {
  loadSettings,
  loadView,
  loadZoom,
  saveSettings,
  saveView,
  saveZoom,
} from "./settings.ts";

function fileWith(content?: string): string {
  const file = join(mkdtempSync(join(tmpdir(), "settings-")), "settings.json");
  if (content !== undefined) writeFileSync(file, content);
  return file;
}

test("a missing file gives the defaults", () => {
  expect(loadSettings(fileWith())).toEqual(DEFAULT_SETTINGS);
});

test("a known key is kept and an unknown key is dropped", () => {
  expect(loadSettings(fileWith('{"alwaysOnTop":true,"x":1}'))).toEqual({
    ...DEFAULT_SETTINGS,
    alwaysOnTop: true,
  });
});

test("a key of the wrong type gets its default", () => {
  expect(
    loadSettings(
      fileWith('{"closeWithGame":"no","showWindowOnGameStart":false}'),
    ),
  ).toEqual({ ...DEFAULT_SETTINGS, showWindowOnGameStart: false });
});

test.each([
  ["invalid JSON", "{"],
  ["JSON that is not an object", "[true]"],
  ["null", "null"],
])("%s gives the defaults", (_name, content) => {
  expect(loadSettings(fileWith(content))).toEqual(DEFAULT_SETTINGS);
});

test("the zoom is saved and loaded with the settings, and neither save loses the other", () => {
  const file = fileWith();
  const s = {
    showWindowOnGameStart: false,
    closeWithGame: true,
    alwaysOnTop: true,
  };
  saveSettings(file, s);
  saveZoom(file, 1.5);
  expect(loadZoom(file)).toBe(1.5);
  expect(loadSettings(file)).toEqual(s);
  saveSettings(file, { ...s, alwaysOnTop: false });
  expect(loadZoom(file)).toBe(1.5);
});

test.each([
  ["a missing file", undefined],
  ["invalid JSON", "{"],
  ["a zoom out of range", '{"zoom":3}'],
  ["a zoom that is not a number", '{"zoom":"2"}'],
])("%s loads the zoom as 1.0", (_name, content) => {
  expect(loadZoom(fileWith(content))).toBe(1);
});

test("save then load gives the same settings, also in a folder that did not exist", () => {
  const file = join(
    mkdtempSync(join(tmpdir(), "settings-")),
    "new",
    "settings.json",
  );
  const s = {
    showWindowOnGameStart: false,
    closeWithGame: false,
    alwaysOnTop: true,
  };
  saveSettings(file, s);
  expect(loadSettings(file)).toEqual(s);
});

// spec 009 (contracts/ipc.md, SEC-005): the two toggles of the tree, Changes and the share, beside the settings.
const OFF = { changes: false, share: false };

test.each([
  ["a missing file", undefined],
  ["invalid JSON", "{"],
  ["JSON that is not an object", "[true]"],
  ["keys of the wrong type", '{"changes":"yes","share":1}'],
])("%s gives both toggles off", (_name, content) => {
  expect(loadView(fileWith(content))).toEqual(OFF);
});

test("a bad file is read as both off and is never deleted", () => {
  const file = fileWith("{");
  loadView(file);
  expect(readFileSync(file, "utf8")).toBe("{");
});

test("the toggles are saved and loaded, and no save loses the settings, the zoom or the toggles", () => {
  const file = fileWith();
  const s = {
    showWindowOnGameStart: false,
    closeWithGame: true,
    alwaysOnTop: true,
  };
  saveSettings(file, s);
  saveZoom(file, 1.5);
  saveView(file, { changes: true, share: false });
  expect(loadView(file)).toEqual({ changes: true, share: false });
  expect(loadSettings(file)).toEqual(s);
  expect(loadZoom(file)).toBe(1.5);
  saveSettings(file, { ...s, alwaysOnTop: false });
  saveZoom(file, 1.2);
  expect(loadView(file)).toEqual({ changes: true, share: false });
});

test("only the two toggles are saved: no other key of the view reaches the file", () => {
  const file = fileWith();
  saveView(file, { changes: true, share: true, mark: "Mark 1" } as never);
  expect(
    Object.keys(JSON.parse(readFileSync(file, "utf8")) as object),
  ).not.toContain("mark");
});

test("a write goes to .tmp and is renamed over the file: a failed write leaves the file whole", () => {
  const file = fileWith('{"changes":true,"share":true}');
  mkdirSync(`${file}.tmp`);
  expect(() => {
    saveView(file, OFF);
  }).toThrow();
  expect(readFileSync(file, "utf8")).toBe('{"changes":true,"share":true}');
});
