// What the update flow decides (spec US4, FR-020 to FR-026, FR-032; research R3, R9). The updater is a fake: no test
// loads electron-updater or reaches the network.
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Status, UpdateState } from "../shared/index.ts";
import {
  canInstall,
  installCheck,
  nextUpdateState,
  shouldCheck,
  startUpdates,
  updateStateFrom,
} from "./updates.ts";
import type { Updater } from "./updates.ts";

const RUNNING: Status = { game: "running", reader: "attached" };
const CLOSED: Status = { game: "closed", reader: "error" };
const SIX_HOURS = 6 * 60 * 60 * 1000;

describe("canInstall", () => {
  test("never with the game open by the link", () => {
    expect(canInstall({ status: RUNNING, gameRunning: false })).toBe(false);
  });

  test("never with the game's process running, even with the link down", () => {
    expect(canInstall({ status: null, gameRunning: true })).toBe(false);
    expect(canInstall({ status: CLOSED, gameRunning: true })).toBe(false);
  });

  test("with the game closed and no process", () => {
    expect(canInstall({ status: CLOSED, gameRunning: false })).toBe(true);
    expect(canInstall({ status: null, gameRunning: false })).toBe(true);
  });
});

describe("updateStateFrom", () => {
  test.each<[Parameters<typeof updateStateFrom>, UpdateState]>([
    [["checking"], { state: "none" }],
    [["available", "1.2.3"], { state: "downloading", version: "1.2.3" }],
    [["progress", "1.2.3"], { state: "downloading", version: "1.2.3" }],
    [
      ["downloaded", "1.2.3", true],
      { state: "ready", version: "1.2.3", canInstall: true },
    ],
    [
      ["downloaded", "1.2.3", false],
      { state: "ready", version: "1.2.3", canInstall: false },
    ],
    [["error"], { state: "check-failed" }],
  ])("%j", (args, expected) => {
    expect(updateStateFrom(...args)).toEqual(expected);
  });

  test("a download nobody said can install does not", () => {
    expect(updateStateFrom("downloaded", "1.2.3")).toEqual({
      state: "ready",
      version: "1.2.3",
      canInstall: false,
    });
  });
});

test("only the packaged app checks", () => {
  expect(shouldCheck({ isPackaged: true })).toBe(true);
  expect(shouldCheck({ isPackaged: false })).toBe(false);
});

describe("nextUpdateState", () => {
  const READY: UpdateState = {
    state: "ready",
    version: "1.2.3",
    canInstall: true,
  };
  const DOWNLOADING: UpdateState = { state: "downloading", version: "1.2.3" };

  test("a check that runs or fails does not take back a finished download", () => {
    expect(nextUpdateState(READY, "checking")).toBe(READY);
    expect(nextUpdateState(READY, "error")).toBe(READY);
  });

  test("the same version found again stays ready", () => {
    expect(nextUpdateState(READY, "available", "1.2.3")).toBe(READY);
  });

  test("a newer version replaces the one that was ready", () => {
    expect(nextUpdateState(READY, "available", "1.3.0")).toEqual({
      state: "downloading",
      version: "1.3.0",
    });
  });

  test("a download that ends takes the newest canInstall", () => {
    expect(nextUpdateState(READY, "downloaded", "1.2.3", false)).toEqual({
      state: "ready",
      version: "1.2.3",
      canInstall: false,
    });
  });

  test("a check during a download keeps the download", () => {
    expect(nextUpdateState(DOWNLOADING, "checking")).toBe(DOWNLOADING);
  });

  test("progress has no version of its own and keeps the download's", () => {
    expect(nextUpdateState(DOWNLOADING, "progress")).toEqual(DOWNLOADING);
  });

  test("a download that fails is a failed check", () => {
    expect(nextUpdateState(DOWNLOADING, "error")).toEqual({
      state: "check-failed",
    });
  });

  test("a new check clears a failed one", () => {
    expect(nextUpdateState({ state: "check-failed" }, "checking")).toEqual({
      state: "none",
    });
  });
});

describe("installCheck", () => {
  const sys = (running: boolean) => ({
    isRunning: vi.fn<(image: string) => Promise<boolean>>(() =>
      Promise.resolve(running),
    ),
  });

  test("the link saying the game runs is enough: no tasklist on every status", async () => {
    const s = sys(false);
    await expect(installCheck(() => RUNNING, s)()).resolves.toBe(false);
    expect(s.isRunning).not.toHaveBeenCalled();
  });

  test("with the link quiet it looks for the game's process", async () => {
    const s = sys(true);
    await expect(installCheck(() => CLOSED, s)()).resolves.toBe(false);
    expect(s.isRunning).toHaveBeenCalledWith("LegendsOfIdleon.exe");
  });

  test("no game anywhere: it can install", async () => {
    await expect(installCheck(() => null, sys(false))()).resolves.toBe(true);
  });

  test("a tasklist that fails counts as the game being open", async () => {
    const isRunning = () => Promise.reject(new Error("tasklist"));
    await expect(installCheck(() => CLOSED, { isRunning })()).resolves.toBe(
      false,
    );
  });

  test("a status that arrives during the tasklist counts", async () => {
    let status: Status = CLOSED;
    const isRunning = () => {
      status = RUNNING;
      return Promise.resolve(false);
    };
    await expect(installCheck(() => status, { isRunning })()).resolves.toBe(
      false,
    );
  });
});

class FakeUpdater extends EventEmitter {
  autoDownload = false;
  allowDowngrade = true;
  autoInstallOnAppQuit = false;
  checkForUpdates = vi.fn(() => Promise.resolve(null));
  quitAndInstall = vi.fn();
}

describe("startUpdates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const flush = () => vi.advanceTimersByTimeAsync(0);
  const loaded = (updater: FakeUpdater) => ({
    isPackaged: true,
    load: () => Promise.resolve(updater as unknown as Updater),
  });

  async function started(can = true, updater = new FakeUpdater()) {
    const sent: UpdateState[] = [];
    const answer = { can };
    const canInstallNow = vi.fn(() => Promise.resolve(answer.can));
    const handle = startUpdates(
      (u) => {
        sent.push(u);
      },
      canInstallNow,
      loaded(updater),
    );
    await flush();
    return { updater, sent, answer, canInstallNow, handle };
  }

  async function ready(can = true) {
    const s = await started(can);
    s.updater.emit("update-downloaded", { version: "1.2.3" });
    await flush();
    return s;
  }
  const READY_YES = { state: "ready", version: "1.2.3", canInstall: true };
  const READY_NO = { state: "ready", version: "1.2.3", canInstall: false };

  test("not packaged: the updater is not even loaded", async () => {
    const load = vi.fn(() => Promise.reject(new Error("loaded")));
    const canInstallNow = vi.fn(() => Promise.resolve(true));
    const send = vi.fn();
    const h = startUpdates(send, canInstallNow, { isPackaged: false, load });
    await vi.advanceTimersByTimeAsync(SIX_HOURS);
    void h.onStatus();
    await h.install();

    expect(load).not.toHaveBeenCalled();
    expect(canInstallNow).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  test("it downloads alone and never goes back a version", async () => {
    const { updater } = await started();

    expect(updater.autoDownload).toBe(true);
    expect(updater.allowDowngrade).toBe(false);
  });

  test("the quit flag is on when electron-updater looks at it, right after the download event", async () => {
    const { updater } = await started(false);
    expect(updater.autoInstallOnAppQuit).toBe(true);

    updater.emit("update-downloaded", { version: "1.2.3" });
    expect(updater.autoInstallOnAppQuit).toBe(true);

    await flush();
    expect(updater.autoInstallOnAppQuit).toBe(false);
  });

  test("a status before any download leaves the flag on", async () => {
    const { updater, handle } = await started(false);

    void handle.onStatus();
    await flush();

    expect(updater.autoInstallOnAppQuit).toBe(true);
  });

  test("it checks at start and every 6 hours", async () => {
    const { updater } = await started();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(SIX_HOURS - 1);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  test("a check that rejects only becomes check-failed (FR-025)", async () => {
    const updater = new FakeUpdater();
    updater.checkForUpdates.mockRejectedValue(new Error("offline"));
    const { sent } = await started(true, updater);

    expect(sent).toEqual([{ state: "check-failed" }]);
  });

  test("an updater that does not load only becomes check-failed", async () => {
    const send = vi.fn();
    startUpdates(send, () => Promise.resolve(true), {
      isPackaged: true,
      load: () => Promise.reject(new Error("no module")),
    });
    await flush();

    expect(send).toHaveBeenCalledExactlyOnceWith({ state: "check-failed" });
  });

  test("the window follows a check, a download and its end", async () => {
    const { updater, sent } = await started();

    updater.emit("checking-for-update");
    updater.emit("update-available", { version: "1.2.3" });
    updater.emit("download-progress", { percent: 10 });
    updater.emit("download-progress", { percent: 20 });
    expect(sent).toEqual([{ state: "downloading", version: "1.2.3" }]);

    updater.emit("update-downloaded", { version: "1.2.3" });
    await flush();
    expect(sent.at(-1)).toEqual(READY_YES);
  });

  test("an error event is a failed check", async () => {
    const { updater, sent } = await started();
    updater.emit("error", new Error("hash mismatch"));
    expect(sent).toEqual([{ state: "check-failed" }]);
  });

  test("a download that ends with the game open says it cannot install", async () => {
    const { updater, sent } = await ready(false);
    expect(sent.at(-1)).toEqual(READY_NO);
    expect(updater.autoInstallOnAppQuit).toBe(false);
  });

  test("every status decides again, also for quitting", async () => {
    const { updater, sent, answer, handle } = await ready(true);
    expect(updater.autoInstallOnAppQuit).toBe(true);

    answer.can = false;
    void handle.onStatus();
    await flush();

    expect(updater.autoInstallOnAppQuit).toBe(false);
    expect(sent.at(-1)).toEqual(READY_NO);
  });

  test("an older answer that arrives last does not count", async () => {
    const answers: ((can: boolean) => void)[] = [];
    const updater = new FakeUpdater();
    const h = startUpdates(
      vi.fn(),
      () =>
        new Promise<boolean>((resolve) => {
          answers.push(resolve);
        }),
      loaded(updater),
    );
    await flush();
    updater.emit("update-downloaded", { version: "1.2.3" });
    void h.onStatus();

    answers[1]?.(false);
    await flush();
    answers[0]?.(true);
    await flush();

    expect(updater.autoInstallOnAppQuit).toBe(false);
  });

  test("with no status arriving, a ready update still sees the game close", async () => {
    const { updater, sent, answer } = await ready(false);

    answer.can = true;
    await vi.advanceTimersByTimeAsync(5000);

    expect(sent.at(-1)).toEqual(READY_YES);
    expect(updater.autoInstallOnAppQuit).toBe(true);
  });

  test("nothing looks for the game while no update is ready", async () => {
    const { canInstallNow, handle } = await started();

    void handle.onStatus();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(canInstallNow).not.toHaveBeenCalled();
  });

  test("install restarts silently into the new version", async () => {
    const { updater, handle } = await ready(true);

    await handle.install();

    expect(updater.quitAndInstall).toHaveBeenCalledExactlyOnceWith(true, true);
  });

  test("install asks again: a game opened since the last look stops it", async () => {
    const { updater, sent, answer, handle } = await ready(true);

    answer.can = false;
    await handle.install();

    expect(updater.quitAndInstall).not.toHaveBeenCalled();
    expect(sent.at(-1)).toEqual(READY_NO);
  });

  test("install does nothing without a finished download", async () => {
    const { updater, handle } = await started(true);

    await handle.install();

    expect(updater.quitAndInstall).not.toHaveBeenCalled();
  });

  test("replay gives a reloaded window the current state", async () => {
    const { sent, handle } = await ready(true);
    const count = sent.length;

    handle.replay();

    expect(sent.length).toBe(count + 1);
    expect(sent.at(-1)).toEqual(READY_YES);
  });
});
