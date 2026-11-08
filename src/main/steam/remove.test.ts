// "Remove from Steam" and the uninstaller over fake system operations: no Steam, no registry, no process, no file.
import { win32 } from "node:path";
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
  STEAM,
  steamFiles,
} from "./fake-system.ts";
import type { World } from "./fake-system.ts";
import { getLaunchOptions, VdfShapeError } from "./vdf.ts";

const OTHER = win32.join(STEAM, "userdata", "101", "config", "localconfig.vdf");
const withOption = (option: string) =>
  Buffer.from(LOCALCONFIG.toString("utf8").replace(esc(BEFORE), esc(option)));
const WITH_PART = withOption(AFTER);
const BROKEN = Buffer.from('"UserLocalConfigStore" {');
const record = (inserted = PART) => ({
  inserted,
  before: BEFORE,
  backupFile: "C:\\Data\\copy.vdf",
  setAt: 1,
});
const configured = (o: Partial<World> = {}) =>
  setup({
    disk: new Map([
      [FILE, WITH_PART],
      [OTHER, WITH_PART],
    ]),
    records: { accounts: { "101": record(), "102": record() } },
    ...o,
  });
const optionOf = (b: Buffer | undefined) =>
  getLaunchOptions(b?.toString("utf8") ?? "", "1476970");

test("two configured accounts: each file loses only the inserted text, and both leave the records", async () => {
  const s = configured();
  expect(await s.remove()).toBe("done");
  expect(s.w.disk.get(FILE)).toEqual(LOCALCONFIG);
  expect(s.w.disk.get(OTHER)).toEqual(LOCALCONFIG);
  expect(s.saved()).toEqual({ accounts: {} });
  // the fake write throws while Steam is still up: these ran after it was gone
  expect(s.changes()).toEqual([
    `shutdown ${STEAM}`,
    `write ${OTHER}`,
    "save",
    `write ${FILE}`,
    "save",
    `start ${STEAM}`,
  ]);
  expect(s.progress).toEqual([
    "closing-steam",
    "setting-up",
    "opening-steam",
    "done",
  ]);
});

test("what the user changed after the setup stays", async () => {
  const s = configured({
    disk: new Map([[FILE, withOption(`-low ${PART}%command% -extra`)]]),
    records: { accounts: { "102": record() } },
  });
  expect(await s.remove()).toBe("done");
  expect(optionOf(s.w.disk.get(FILE))).toBe("-low %command% -extra");
});

test("the inserted text already gone: that file is not written, and the record goes", async () => {
  const s = configured({
    disk: new Map([
      [FILE, LOCALCONFIG],
      [OTHER, WITH_PART],
    ]),
  });
  expect(await s.remove()).toBe("done");
  expect(s.changes()).not.toContain(`write ${FILE}`);
  expect(s.w.disk.get(FILE)).toBe(LOCALCONFIG);
  expect(s.saved()).toEqual({ accounts: {} });
});

test("a record whose inserted text is gone while the companion's part is there: the part is taken out", async () => {
  const s = configured({
    disk: new Map([[FILE, WITH_PART]]),
    records: { accounts: { "102": record("not in the option") } },
  });
  expect(await s.remove()).toBe("done");
  expect(optionOf(s.w.disk.get(FILE))).toBe(BEFORE);
});

test("with the game open: game-open, nothing touched", async () => {
  const s = configured({
    running: new Set(["steam.exe", "LegendsOfIdleon.exe"]),
  });
  expect(await s.remove()).toEqual({ step: "failed", reason: "game-open" });
  expect(s.changes()).toEqual([]);
  expect(s.w.disk.get(FILE)).toBe(WITH_PART);
});

test("Steam still running after 30 s: steam-did-not-close, nothing written, the records stay", async () => {
  const s = configured({ closesAfterMs: Infinity });
  expect(await s.remove()).toEqual({
    step: "failed",
    reason: "steam-did-not-close",
  });
  expect(s.changes()).toEqual([`shutdown ${STEAM}`]);
  expect(s.w.disk.get(FILE)).toBe(WITH_PART);
  expect(Object.keys(s.saved().accounts)).toEqual(["101", "102"]);
});

test("one account's file unreadable: it stays in the records, the other is done, unreadable-config", async () => {
  const s = configured({
    disk: new Map([
      [FILE, BROKEN],
      [OTHER, WITH_PART],
    ]),
  });
  expect(await s.remove()).toEqual({
    step: "failed",
    reason: "unreadable-config",
  });
  expect(s.w.disk.get(FILE)).toBe(BROKEN);
  expect(s.w.disk.get(OTHER)).toEqual(LOCALCONFIG);
  expect(Object.keys(s.saved().accounts)).toEqual(["102"]);
  expect(s.changes().at(-1)).toBe(`start ${STEAM}`);
});

test("a configured account whose file no longer exists: forgotten, nothing written", async () => {
  const s = configured({ disk: new Map([[OTHER, WITH_PART]]) });
  expect(await s.remove()).toBe("done");
  expect(s.changes()).not.toContain(`write ${FILE}`);
  expect(s.saved()).toEqual({ accounts: {} });
});

test("nothing configured and no part in the last account: done, Steam untouched", async () => {
  const s = setup();
  expect(await s.remove()).toBe("done");
  expect(s.changes()).toEqual([]);
  expect(s.progress).toEqual(["done"]);
});

test("no record but the last account has the part: taken out, after keeping the first copy", async () => {
  const s = setup({ disk: new Map([[FILE, WITH_PART]]) });
  expect(await s.remove()).toBe("done");
  expect(optionOf(s.w.disk.get(FILE))).toBe(BEFORE);
  expect(s.w.disk.get(BACKUP)).toBe(WITH_PART);
  expect(s.changes()).toEqual([
    `shutdown ${STEAM}`,
    `copy ${FILE} ${BACKUP}`,
    `write ${FILE}`,
    `start ${STEAM}`,
  ]);
});

test("no record and the option is only the companion's: the game is left starting by itself", async () => {
  const s = setup({
    disk: new Map([[FILE, withOption(`${PART}%command%`)]]),
  });
  expect(await s.remove()).toBe("done");
  expect(optionOf(s.w.disk.get(FILE))).toBe("%command%");
});

test("the last account without the part and without a record is not written", async () => {
  const s = configured({
    disk: new Map([
      [FILE, LOCALCONFIG],
      [OTHER, WITH_PART],
    ]),
    records: { accounts: { "101": record() } },
  });
  expect(await s.remove()).toBe("done");
  expect(s.changes()).toEqual([
    `shutdown ${STEAM}`,
    `write ${OTHER}`,
    "save",
    `start ${STEAM}`,
  ]);
});

test("no record and the last account's file unreadable: unreadable-config, nothing written, Steam reopened", async () => {
  const s = setup({ disk: new Map([[FILE, BROKEN]]) });
  expect(await s.remove()).toEqual({
    step: "failed",
    reason: "unreadable-config",
  });
  expect(s.changes()).toEqual([`shutdown ${STEAM}`, `start ${STEAM}`]);
  expect(s.w.disk.get(FILE)).toBe(BROKEN);
});

test("Steam not installed: done, nothing touched, the records stay", async () => {
  const s = configured({
    files: {
      ...steamFiles(),
      steamPath: null,
      account: null,
      localConfig: null,
    },
  });
  expect(await s.remove()).toBe("done");
  expect(s.changes()).toEqual([]);
  expect(Object.keys(s.saved().accounts)).toEqual(["101", "102"]);
});

test("a broken loginusers.vdf: unreadable-config, Steam untouched", async () => {
  const s = configured({ files: new VdfShapeError("unclosed block") });
  expect(await s.remove()).toEqual({
    step: "failed",
    reason: "unreadable-config",
  });
  expect(s.changes()).toEqual([]);
});

test("isRunning failing after -shutdown: Steam is not left closed, the error passed on", async () => {
  const s = configured();
  s.w.onShutdown = () => {
    s.sys.isRunning = () => Promise.reject(new Error("tasklist failed"));
  };
  await expect(s.remove()).rejects.toThrow("tasklist failed");
  expect(s.changes()).toEqual([`shutdown ${STEAM}`, `start ${STEAM}`]);
});

test("a copy that fails: nothing written, Steam reopened, the error passed on", async () => {
  const s = setup({
    disk: new Map([[FILE, WITH_PART]]),
    copyFails: true,
  });
  await expect(s.remove()).rejects.toThrow("disk full");
  expect(s.changes()).toEqual([`shutdown ${STEAM}`, `start ${STEAM}`]);
  expect(s.w.disk.get(FILE)).toBe(WITH_PART);
});

test("Steam failing to reopen: steam-did-not-open, the option is already clean", async () => {
  const s = configured({ startFails: true });
  expect(await s.remove()).toEqual({
    step: "failed",
    reason: "steam-did-not-open",
  });
  expect(s.w.disk.get(FILE)).toEqual(LOCALCONFIG);
});
