// What the setup screen is given (data-model.md SteamState), read over fake system operations; nothing is changed.
import { expect, test } from "vitest";
import {
  AFTER,
  BACKUP,
  BEFORE,
  esc,
  FILE,
  LOCALCONFIG,
  PART,
  setup,
  steamFiles,
} from "./fake-system.ts";
import { steamState } from "./setup.ts";
import { VdfShapeError } from "./vdf.ts";

const MANUAL = '"C:\\Apps\\IdleOn Companion.exe" --keeper %command%';

test("steamState gives the option, the account, the game, the files and never changes anything", async () => {
  const s = setup();
  expect(await steamState(s.sys, s.store, PART)).toEqual({
    steam: "found",
    account: { id: "102", name: "Test Two" },
    game: "installed",
    option: {
      current: BEFORE,
      next: AFTER,
      state: "other",
      consoleScript: false,
    },
    configured: false,
    gameOpen: false,
    details: { file: FILE, backup: BACKUP },
    manualOption: MANUAL,
  });
  expect(s.changes()).toEqual([]);
});

test("steamState with a localconfig.vdf that is not UTF-8: the error, no option, nothing changed", async () => {
  // 0xff is not UTF-8: decoding and encoding again would change the file's bytes
  const s = setup({
    disk: new Map([
      [FILE, Buffer.concat([Buffer.from("// \xff\n", "latin1"), LOCALCONFIG])],
    ]),
  });
  const r = await steamState(s.sys, s.store, PART);
  expect(r.option).toBeNull();
  expect(r.configured).toBe(false);
  expect(r.error).toContain("UTF-8");
  expect(r.manualOption).toBe(MANUAL);
  expect(s.changes()).toEqual([]);
});

test.each([
  ["with the companion's part", AFTER, "companion", true, false],
  ["empty", "", "not-set", false, false],
  ["with a console script", '"C:\\x\\run.cmd" %command%', "other", false, true],
  [
    "of another companion",
    '"C:\\Old.exe" --keeper %command%',
    "other-companion",
    false,
    false,
  ],
])(
  "steamState with an option %s",
  async (_name, current, state, configured, consoleScript) => {
    const text = LOCALCONFIG.toString("utf8").replace(
      esc(BEFORE),
      esc(current),
    );
    const s = setup({ disk: new Map([[FILE, Buffer.from(text)]]) });
    const r = await steamState(s.sys, s.store, PART);
    expect(r.option).toMatchObject({ current, state, consoleScript });
    expect(r.configured).toBe(configured);
  },
);

test("steamState with the game open and the game not installed", async () => {
  const s = setup({
    files: { ...steamFiles(), gameInstalled: false },
    running: new Set(["LegendsOfIdleon.exe"]),
  });
  expect(await steamState(s.sys, s.store, PART)).toMatchObject({
    game: "not-installed",
    gameOpen: true,
  });
});

test("steamState without Steam: not found, no option, no details, no error", async () => {
  const s = setup({
    files: {
      steamPath: null,
      account: null,
      gameInstalled: false,
      localConfig: null,
    },
  });
  const r = await steamState(s.sys, s.store, PART);
  expect(r).toMatchObject({
    steam: "not-found",
    account: null,
    option: null,
    configured: false,
    details: null,
    manualOption: MANUAL,
  });
  expect(r.error).toBeUndefined();
});

test("steamState with a broken loginusers.vdf: the error and no option", async () => {
  const s = setup({ files: new VdfShapeError("unclosed block") });
  const r = await steamState(s.sys, s.store, PART);
  expect(r).toMatchObject({
    steam: "found",
    option: null,
    configured: false,
    details: null,
    manualOption: MANUAL,
  });
  expect(r.error).toContain("unclosed block");
});

test.each([
  ["broken", new Map([[FILE, Buffer.from('"UserLocalConfigStore" {')]])],
  ["without the apps block", new Map([[FILE, Buffer.from('"A" { }')]])],
  ["missing", new Map<string, Buffer>()],
])(
  "steamState with a localconfig.vdf %s: the error and the files",
  async (_name, disk) => {
    const s = setup({ disk });
    const r = await steamState(s.sys, s.store, PART);
    expect(r.option).toBeNull();
    expect(r.configured).toBe(false);
    expect(r.error).toBeTruthy();
    expect(r.details).toEqual({ file: FILE, backup: BACKUP });
    expect(s.changes()).toEqual([]);
  },
);
