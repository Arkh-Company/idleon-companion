// The update watch (spec §7.2): a changed game code is scanned for debugger-detection markers before the reader attaches.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { checkGameUpdate, scanGameCode } from "./update-watch.ts";

test("plain code has no markers", () => {
  expect(scanGameCode("var a=1;")).toEqual([]);
});

test("a debugger statement is a marker", () => {
  expect(scanGameCode("x;debugger;y")).toEqual(["debugger"]);
});

test("debugger only counts as a whole word", () => {
  expect(scanGameCode('"debuggerName"')).toEqual([]);
});

test.each([
  "devtools",
  "remote-debugging",
  "isDevToolsOpened",
  "outerWidth",
  "Function.prototype.toString",
])("%s is a marker", (marker) => {
  expect(scanGameCode(`a.${marker}(b)`)).toEqual([marker]);
});

test("markers are case-sensitive", () => {
  expect(scanGameCode("DevTools outerwidth")).toEqual([]);
});

test("the first check, the same code and a different code", () => {
  const state = join(
    mkdtempSync(join(tmpdir(), "idleon-hash-")),
    "sub",
    "game-hash.json",
  );
  const first = checkGameUpdate("x;debugger;y", state);
  expect(first).toMatchObject({ changed: true, markers: ["debugger"] });
  expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
  expect(checkGameUpdate("x;debugger;y", state)).toEqual({
    changed: false,
    hash: first.hash,
    markers: [],
  });
  expect(checkGameUpdate("var a=1;", state).changed).toBe(true);
});
