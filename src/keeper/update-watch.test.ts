// The update watch (spec §7.2): a changed game code is scanned for debugger-detection markers before the reader attaches.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  checkGameUpdate,
  readInstalledGameCode,
  recordGameHash,
  scanGameCode,
} from "./update-watch.ts";

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

const statePath = () =>
  join(mkdtempSync(join(tmpdir(), "idleon-hash-")), "sub", "game-hash.json");

test("the first check, the same clean code and a different code", () => {
  const state = statePath();
  const first = checkGameUpdate("var a=1;", state);
  expect(first).toMatchObject({ changed: true, markers: [] });
  expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
  expect(checkGameUpdate("var a=1;", state)).toEqual({
    changed: false,
    hash: first.hash,
    markers: [],
  });
  expect(checkGameUpdate("var b=2;", state).changed).toBe(true);
});

test("code with markers warns on every check until its hash is recorded", () => {
  const state = statePath();
  const first = checkGameUpdate("x;debugger;y", state);
  expect(first).toMatchObject({ changed: true, markers: ["debugger"] });
  expect(checkGameUpdate("x;debugger;y", state)).toEqual(first);
  recordGameHash(first.hash, state);
  expect(checkGameUpdate("x;debugger;y", state)).toEqual({
    changed: false,
    hash: first.hash,
    markers: [],
  });
});

test("no app.asar means there is no installed game code to check", () => {
  const dir = mkdtempSync(join(tmpdir(), "idleon-asar-"));
  expect(readInstalledGameCode(join(dir, "app.asar"))).toBeUndefined();
});

test("an app.asar without a readable N.js throws", () => {
  const asar = join(mkdtempSync(join(tmpdir(), "idleon-asar-")), "app.asar");
  mkdirSync(asar);
  expect(() => readInstalledGameCode(asar)).toThrow();
});

test("an app.asar that cannot be opened as an archive throws", () => {
  const asar = join(mkdtempSync(join(tmpdir(), "idleon-asar-")), "app.asar");
  writeFileSync(asar, "not an asar archive");
  expect(() => readInstalledGameCode(asar)).toThrow();
});

test("the N.js inside app.asar is read as text", () => {
  const asar = join(mkdtempSync(join(tmpdir(), "idleon-asar-")), "app.asar");
  const game = join(asar, "distBuild", "static", "game");
  mkdirSync(game, { recursive: true });
  writeFileSync(join(game, "N.js"), "var a=1;");
  expect(readInstalledGameCode(asar)).toBe("var a=1;");
});
