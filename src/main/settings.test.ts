import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { DEFAULT_SETTINGS } from "../shared/index.ts";
import { loadSettings, saveSettings } from "./settings.ts";

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
