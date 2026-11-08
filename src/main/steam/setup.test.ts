// The setup flow over fake system operations: no Steam, no registry, no process and no file is touched.
import { expect, expectTypeOf, test } from "vitest";
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
import type { SteamSystem } from "./setup.ts";
import { getLaunchOptions, VdfShapeError } from "./vdf.ts";

test("SteamSystem has no way to kill a process", () => {
  expectTypeOf<keyof SteamSystem>().toEqualTypeOf<
    | "readSteam"
    | "isRunning"
    | "shutdownSteam"
    | "startSteam"
    | "copyFile"
    | "writeFileAtomic"
    | "readFile"
    | "now"
    | "sleep"
  >();
});

test("setup closes Steam, waits for it, copies, writes, reopens Steam and records the part", async () => {
  const s = setup();
  expect(await s.run()).toBe("done");
  expect(s.progress).toEqual([
    "closing-steam",
    "setting-up",
    "opening-steam",
    "done",
  ]);
  // the fake copy and write throw while Steam is still up: these ran after it was gone
  expect(s.changes()).toEqual([
    `shutdown ${STEAM}`,
    `copy ${FILE} ${BACKUP}`,
    `write ${FILE}`,
    "save",
    `start ${STEAM}`,
  ]);
  expect(s.w.disk.get(BACKUP)).toEqual(LOCALCONFIG);
  expect(s.saved().accounts["102"]).toEqual({
    inserted: PART,
    before: BEFORE,
    backupFile: BACKUP,
    setAt: s.time(),
  });
});

const WITH_OTHER_COMPANION = Buffer.from(
  LOCALCONFIG.toString("utf8").replace(
    esc(BEFORE),
    esc('"C:\\Old.exe" --keeper %command%'),
  ),
);
const NOT_WRITTEN = { step: "failed", reason: "unreadable-config" };

test("another companion in the option: Steam stays open and nothing is written", async () => {
  const s = setup({ disk: new Map([[FILE, WITH_OTHER_COMPANION]]) });
  expect(await s.run()).toEqual(NOT_WRITTEN);
  expect(s.changes()).toEqual([]);
});

test("another companion in the file Steam leaves when it closes: nothing is written and Steam reopens", async () => {
  const s = setup({
    onShutdown: () => s.w.disk.set(FILE, WITH_OTHER_COMPANION),
  });
  expect(await s.run()).toEqual(NOT_WRITTEN);
  expect(s.changes()).toEqual([`shutdown ${STEAM}`, `start ${STEAM}`]);
});

test("the written file differs from the read one only in the option's text", async () => {
  const s = setup();
  await s.run();
  const written = s.w.disk.get(FILE)?.toString("utf8") ?? "";
  expect(getLaunchOptions(written, "1476970")).toBe(AFTER);
  expect(written).toBe(
    LOCALCONFIG.toString("utf8").replace(esc(BEFORE), esc(AFTER)),
  );
});

test("an existing copy is never overwritten", async () => {
  const old = Buffer.from("the first copy");
  const s = setup();
  s.w.disk.set(BACKUP, old);
  expect(await s.run()).toBe("done");
  expect(s.changes().some((c) => c.startsWith("copy"))).toBe(false);
  expect(s.w.disk.get(BACKUP)).toBe(old);
});

test("with Steam already closed there is no shutdown, and the option is still written and Steam opened", async () => {
  const s = setup({ running: new Set() });
  expect(await s.run()).toBe("done");
  expect(s.changes()).toEqual([
    `copy ${FILE} ${BACKUP}`,
    `write ${FILE}`,
    "save",
    `start ${STEAM}`,
  ]);
});

test("with the game open: game-open, and Steam is not closed", async () => {
  const s = setup({ running: new Set(["steam.exe", "LegendsOfIdleon.exe"]) });
  expect(await s.run()).toEqual({ step: "failed", reason: "game-open" });
  expect(s.changes()).toEqual([]);
  expect(s.progress).toEqual([{ step: "failed", reason: "game-open" }]);
});

test("Steam still running after 30 s: steam-did-not-close, nothing copied nor written", async () => {
  const s = setup({ closesAfterMs: Infinity });
  const t0 = s.time();
  expect(await s.run()).toEqual({
    step: "failed",
    reason: "steam-did-not-close",
  });
  expect(s.time() - t0).toBeGreaterThanOrEqual(30_000);
  expect(s.time() - t0).toBeLessThan(31_000);
  expect(s.changes()).toEqual([`shutdown ${STEAM}`]);
  expect(s.progress).toEqual([
    "closing-steam",
    { step: "failed", reason: "steam-did-not-close" },
  ]);
});

test("Steam closing at 29 s is waited for", async () => {
  const s = setup({ closesAfterMs: 29_000 });
  expect(await s.run()).toBe("done");
});

test("a broken loginusers.vdf or libraryfolders.vdf: unreadable-config, Steam untouched", async () => {
  const s = setup({ files: new VdfShapeError("unclosed block") });
  expect(await s.run()).toEqual({
    step: "failed",
    reason: "unreadable-config",
  });
  expect(s.changes()).toEqual([]);
});

test("a broken localconfig.vdf: unreadable-config, Steam untouched", async () => {
  const s = setup({
    disk: new Map([[FILE, Buffer.from('"UserLocalConfigStore" {')]]),
  });
  expect(await s.run()).toEqual({
    step: "failed",
    reason: "unreadable-config",
  });
  expect(s.changes()).toEqual([]);
});

test("a localconfig.vdf without the apps block: unreadable-config, Steam untouched", async () => {
  const s = setup({
    disk: new Map([[FILE, Buffer.from('"UserLocalConfigStore" { }')]]),
  });
  expect(await s.run()).toEqual({
    step: "failed",
    reason: "unreadable-config",
  });
  expect(s.changes()).toEqual([]);
});

test("a localconfig.vdf that is not UTF-8: unreadable-config, Steam is not closed", async () => {
  const s = setup({
    disk: new Map([
      [FILE, Buffer.concat([Buffer.from("// \xff\n", "latin1"), LOCALCONFIG])],
    ]),
  });
  expect(await s.run()).toEqual({
    step: "failed",
    reason: "unreadable-config",
  });
  expect(s.changes()).toEqual([]);
});

test.each([
  ["no Steam", { ...steamFiles(), steamPath: null }],
  ["no account", { ...steamFiles(), account: null, localConfig: null }],
  [
    "no localconfig.vdf",
    { ...steamFiles(), localConfig: { path: "C:\\none.vdf" } },
  ],
])("with %s: unreadable-config, Steam untouched", async (_name, files) => {
  const s = setup({ files });
  expect(await s.run()).toEqual({
    step: "failed",
    reason: "unreadable-config",
  });
  expect(s.changes()).toEqual([]);
});

test.each([
  ["of an unexpected shape", Buffer.from('"UserLocalConfigStore" {')],
  // 0xff is not UTF-8: decoding and encoding again would change the file's bytes
  [
    "that is not UTF-8",
    Buffer.concat([Buffer.from("// \xff\n", "latin1"), LOCALCONFIG]),
  ],
])(
  "a localconfig.vdf %s once Steam closed: unreadable-config, nothing written, Steam reopened",
  async (_name, bytes) => {
    const s = setup();
    s.w.onShutdown = () => s.w.disk.set(FILE, bytes);
    expect(await s.run()).toEqual({
      step: "failed",
      reason: "unreadable-config",
    });
    expect(s.changes()).toEqual([`shutdown ${STEAM}`, `start ${STEAM}`]);
    expect(s.w.disk.get(FILE)).toBe(bytes);
    expect(s.saved()).toEqual({ accounts: {} });
  },
);

test("startSteam failing after the write: steam-did-not-open, the option is set", async () => {
  const s = setup({ startFails: true });
  expect(await s.run()).toEqual({
    step: "failed",
    reason: "steam-did-not-open",
  });
  expect(
    getLaunchOptions(s.w.disk.get(FILE)?.toString("utf8") ?? "", "1476970"),
  ).toBe(AFTER);
  expect(s.saved().accounts["102"]?.inserted).toBe(PART);
});

test("an option that already has the companion's part: done, Steam untouched", async () => {
  const text = LOCALCONFIG.toString("utf8").replace(esc(BEFORE), esc(AFTER));
  const s = setup({ disk: new Map([[FILE, Buffer.from(text)]]) });
  expect(await s.run()).toBe("done");
  expect(s.changes()).toEqual([]);
  expect(s.progress).toEqual(["done"]);
});

test("a copy that fails: nothing written, Steam reopened, the error passed on", async () => {
  const s = setup({ copyFails: true });
  await expect(s.run()).rejects.toThrow("disk full");
  expect(s.changes()).toEqual([`shutdown ${STEAM}`, `start ${STEAM}`]);
  expect(s.w.disk.get(FILE)).toBe(LOCALCONFIG);
});

test("the part found once Steam closed: done, nothing written, Steam reopened", async () => {
  const text = LOCALCONFIG.toString("utf8").replace(esc(BEFORE), esc(AFTER));
  const s = setup();
  s.w.onShutdown = () => s.w.disk.set(FILE, Buffer.from(text));
  expect(await s.run()).toBe("done");
  expect(s.changes()).toEqual([`shutdown ${STEAM}`, `start ${STEAM}`]);
});

test("isRunning failing after -shutdown: Steam is not left closed, the error passed on", async () => {
  const s = setup();
  s.w.onShutdown = () => {
    s.sys.isRunning = () => Promise.reject(new Error("tasklist failed"));
  };
  await expect(s.run()).rejects.toThrow("tasklist failed");
  expect(s.changes()).toEqual([`shutdown ${STEAM}`, `start ${STEAM}`]);
  expect(s.w.disk.get(FILE)).toBe(LOCALCONFIG);
});
