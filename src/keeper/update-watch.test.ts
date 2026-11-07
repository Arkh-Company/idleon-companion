// The update watch (spec §7.2): a changed game code is scanned for debugger-detection markers before the reader attaches.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import {
  checkGameUpdate,
  readInstalledGameCode,
  recordGameHash,
  scanGameCode,
} from "./update-watch.ts";

// Electron's asar-aware fs (the keeper runs under it) says false from existsSync for an app.asar it cannot open; the
// same here for every path, so the app.asar tests fail if readInstalledGameCode trusts existsSync again.
vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  existsSync: () => false,
}));

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
  recordGameHash(first.hash, state); // the keeper records clean code (checkGameUpdate writes nothing)
  expect(checkGameUpdate("var a=1;", state)).toEqual({
    changed: false,
    hash: first.hash,
    markers: [],
  });
  expect(checkGameUpdate("var b=2;", state).changed).toBe(true);
});

test("checking clean code writes nothing", () => {
  const state = statePath();
  checkGameUpdate("var a=1;", state);
  expect(() => readFileSync(state)).toThrow();
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

/** A temp game folder: `exe(name)` is an exe path in it, `resources` the folder next to the exe (not created). */
function gameFolder() {
  const dir = mkdtempSync(join(tmpdir(), "idleon-game-"));
  return {
    exe: (name = "msedge.exe") => join(dir, name),
    resources: join(dir, "resources"),
  };
}
const N_JS = ["distBuild", "static", "game", "N.js"];

test("no app.asar and no unpacked game means there is no installed game code to check", () => {
  const g = gameFolder();
  mkdirSync(g.resources);
  expect(readInstalledGameCode(g.exe())).toBeUndefined();
});

test("a missing resources folder means there is no installed game code to check", () => {
  expect(readInstalledGameCode(gameFolder().exe())).toBeUndefined();
});

test("a resources path that cannot be listed throws", () => {
  const g = gameFolder();
  writeFileSync(g.resources, "");
  expect(() => readInstalledGameCode(g.exe())).toThrow();
});

test("an app.asar without a readable N.js throws", () => {
  const g = gameFolder();
  mkdirSync(join(g.resources, "app.asar"), { recursive: true });
  expect(() => readInstalledGameCode(g.exe())).toThrow();
});

test("an app.asar that cannot be opened as an archive throws", () => {
  const g = gameFolder();
  mkdirSync(g.resources);
  writeFileSync(join(g.resources, "app.asar"), "not an asar archive");
  expect(() => readInstalledGameCode(g.exe())).toThrow();
});

test("the N.js inside app.asar is read as text", () => {
  const g = gameFolder();
  const game = join(g.resources, "app.asar", ...N_JS.slice(0, -1));
  mkdirSync(game, { recursive: true });
  writeFileSync(join(game, "N.js"), "var a=1;");
  expect(readInstalledGameCode(g.exe())).toBe("var a=1;");
});

test("without app.asar, the N.js of an unpacked game is read as text", () => {
  const g = gameFolder();
  const game = join(g.resources, "app", ...N_JS.slice(0, -1));
  mkdirSync(game, { recursive: true });
  writeFileSync(join(game, "N.js"), "var b=2;");
  expect(readInstalledGameCode(g.exe())).toBe("var b=2;");
});

test("an unpacked N.js that cannot be read throws", () => {
  const g = gameFolder();
  mkdirSync(join(g.resources, "app", ...N_JS), { recursive: true });
  expect(() => readInstalledGameCode(g.exe())).toThrow();
});

test("the game's exe with neither app.asar nor an unpacked N.js throws", () => {
  const g = gameFolder();
  mkdirSync(g.resources);
  expect(() => readInstalledGameCode(g.exe("LegendsOfIdleon.exe"))).toThrow(
    "no game code to check",
  );
});

test("the game's exe without a resources folder throws", () => {
  expect(() =>
    readInstalledGameCode(gameFolder().exe("LegendsOfIdleon.exe")),
  ).toThrow("no game code to check");
});
