import { readFileSync } from "node:fs";
import { join, win32 } from "node:path";
import { expect, test } from "vitest";
import {
  libraryPaths,
  mostRecentAccount,
  readSteam,
  steamPathFromReg,
} from "./locate.ts";
import type { FsLike, Runner } from "./locate.ts";

const fixture = (name: string) =>
  readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
const LOGINUSERS = fixture("loginusers.vdf");
const LIBRARIES = fixture("libraryfolders.vdf");
const LOCALCONFIG = fixture("localconfig.vdf");

const STEAM = "c:\\program files (x86)\\steam";
const REG_OUTPUT = [
  "",
  "HKEY_CURRENT_USER\\Software\\Valve\\Steam",
  "    SteamPath    REG_SZ    c:/program files (x86)/steam",
  "",
].join("\r\n");

test("the most recent account: its 32-bit id from the SteamID64 and its PersonaName", () => {
  expect(mostRecentAccount(LOGINUSERS)).toEqual({
    id: "102",
    name: 'Test "Two"',
  });
});

test("no account marked MostRecent gives null", () => {
  expect(
    mostRecentAccount(
      LOGINUSERS.replace('"MostRecent"\t\t"1"', '"MostRecent"\t\t"0"'),
    ),
  ).toBeNull();
});

test("a SteamID64 near 2^63 is converted exactly (BigInt, not floats)", () => {
  const text =
    '"users" { "9223372036854775807" { "PersonaName" "X" "MostRecent" "1" } }';
  expect(mostRecentAccount(text)?.id).toBe("9146810838894510079");
});

test("an account key that is not a SteamID64 is skipped", () => {
  expect(
    mostRecentAccount('"users" { "abc" { "MostRecent" "1" } }'),
  ).toBeNull();
  expect(mostRecentAccount('"users" { "5" { "MostRecent" "1" } }')).toBeNull();
});

test("library paths, unescaped", () => {
  expect(libraryPaths(LIBRARIES)).toEqual([
    "C:\\Program Files (x86)\\Steam",
    "D:\\Games\\SteamLibrary",
  ]);
});

test("library paths in the old format, numbered keys with the path as value", () => {
  const text = '"LibraryFolders" { "TimeNextStatsReport" "1" "1" "E:\\\\Lib" }';
  expect(libraryPaths(text)).toEqual(["E:\\Lib"]);
});

test("the Steam folder from reg query, with backslashes", () => {
  expect(steamPathFromReg(REG_OUTPUT)).toBe(STEAM);
  expect(
    steamPathFromReg("\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n"),
  ).toBeNull();
});

/** A fake file system over a map, case-insensitive like Windows; a missing file reads as undefined. */
function fakeFs(files: Record<string, string>): FsLike {
  const byPath = new Map(
    Object.entries(files).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return { readText: (p) => Promise.resolve(byPath.get(p.toLowerCase())) };
}

const steamFiles = {
  [win32.join(STEAM, "config", "loginusers.vdf")]: LOGINUSERS,
  [win32.join(STEAM, "config", "libraryfolders.vdf")]: LIBRARIES,
  [win32.join(
    "D:\\Games\\SteamLibrary",
    "steamapps",
    "appmanifest_1476970.acf",
  )]: '"AppState" { }',
  [win32.join(STEAM, "userdata", "102", "config", "localconfig.vdf")]:
    LOCALCONFIG,
};

test("readSteam runs reg query without a shell and reads the account's files", async () => {
  const calls: [string, readonly string[]][] = [];
  const run: Runner = (file, args) => {
    calls.push([file, args]);
    return Promise.resolve(REG_OUTPUT);
  };
  const path = win32.join(
    STEAM,
    "userdata",
    "102",
    "config",
    "localconfig.vdf",
  );

  expect(await readSteam(run, fakeFs(steamFiles))).toEqual({
    steamPath: STEAM,
    account: { id: "102", name: 'Test "Two"' },
    gameInstalled: true,
    localConfig: { path },
  });
  expect(calls).toEqual([
    ["reg", ["query", "HKCU\\Software\\Valve\\Steam", "/v", "SteamPath"]],
  ]);
});

test("readSteam without Steam in the registry finds nothing and reads no file", async () => {
  const fs: FsLike = {
    readText: () => Promise.reject(new Error("no file may be read")),
  };
  expect(
    await readSteam(() => Promise.reject(new Error("reg exit 1")), fs),
  ).toEqual({
    steamPath: null,
    account: null,
    gameInstalled: false,
    localConfig: null,
  });
});

test("readSteam without the game's manifest in any library: not installed", async () => {
  const files = Object.fromEntries(
    Object.entries(steamFiles).filter(([k]) => !k.endsWith(".acf")),
  );
  const r = await readSteam(() => Promise.resolve(REG_OUTPUT), fakeFs(files));
  expect(r.gameInstalled).toBe(false);
});

test("readSteam without loginusers.vdf: no account and no localconfig", async () => {
  const files = Object.fromEntries(
    Object.entries(steamFiles).filter(([k]) => !k.endsWith("loginusers.vdf")),
  );
  const r = await readSteam(() => Promise.resolve(REG_OUTPUT), fakeFs(files));
  expect(r).toMatchObject({
    account: null,
    localConfig: null,
    gameInstalled: true,
  });
});

test("readSteam with the account's localconfig.vdf missing still gives its path", async () => {
  const files = Object.fromEntries(
    Object.entries(steamFiles).filter(([k]) => !k.endsWith("localconfig.vdf")),
  );
  const r = await readSteam(() => Promise.resolve(REG_OUTPUT), fakeFs(files));
  expect(r.localConfig).toEqual({
    path: win32.join(STEAM, "userdata", "102", "config", "localconfig.vdf"),
  });
});
