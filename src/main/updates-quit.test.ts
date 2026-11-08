// The app quitting because the game closed (FR-022, US4 scenario 3, SC-006): the install-on-quit flag is settled first.
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { afterGameClosed, startUpdates } from "./updates.ts";
import type { Updater } from "./updates.ts";

class FakeUpdater extends EventEmitter {
  autoDownload = false;
  allowDowngrade = true;
  autoInstallOnAppQuit = false;
  checkForUpdates = vi.fn(() => Promise.resolve(null));
  quitAndInstall = vi.fn();
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const flush = () => vi.advanceTimersByTimeAsync(0);

/** An updater whose every look at the game waits for the test's answer. */
async function started() {
  const updater = new FakeUpdater();
  const answers: ((can: boolean) => void)[] = [];
  const canInstallNow = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        answers.push(resolve);
      }),
  );
  const handle = startUpdates(vi.fn(), canInstallNow, {
    isPackaged: true,
    load: () => Promise.resolve(updater as unknown as Updater),
  });
  await flush();
  return { updater, answers, canInstallNow, handle };
}

/** Downloaded with the game open: the flag ends off. */
async function readyWithGameOpen() {
  const s = await started();
  s.updater.emit("update-downloaded", { version: "1.2.3" });
  s.answers[0]?.(false);
  await flush();
  expect(s.updater.autoInstallOnAppQuit).toBe(false);
  return s;
}

test("quitting waits for the answer, and the flag is on when it runs", async () => {
  const { updater, answers, handle } = await readyWithGameOpen();
  let flagAtQuit: boolean | undefined;
  const quit = vi.fn(() => {
    flagAtQuit = updater.autoInstallOnAppQuit;
  });

  void afterGameClosed(handle.onStatus(), quit);
  await flush();
  expect(quit).not.toHaveBeenCalled();

  answers[1]?.(true);
  await flush();
  expect(quit).toHaveBeenCalledOnce();
  expect(flagAtQuit).toBe(true);
});

test("with no update ready it quits without looking for the game", async () => {
  const { canInstallNow, handle } = await started();
  const quit = vi.fn();

  void afterGameClosed(handle.onStatus(), quit);
  await flush();

  expect(quit).toHaveBeenCalledOnce();
  expect(canInstallNow).not.toHaveBeenCalled();
});

test("a look that fails does not keep the app open", async () => {
  const quit = vi.fn();

  await afterGameClosed(Promise.reject(new Error("tasklist")), quit);

  expect(quit).toHaveBeenCalledOnce();
});

test("a newer look still waiting does not throw away the answer quitting waits for", async () => {
  const { updater, answers, handle } = await readyWithGameOpen();
  const quit = vi.fn();

  // The keeper ends right after "closed", and the link dropping is one more status.
  void afterGameClosed(handle.onStatus(), quit);
  void handle.onStatus();

  answers[1]?.(true);
  await flush();
  expect(quit).toHaveBeenCalledOnce();
  expect(updater.autoInstallOnAppQuit).toBe(true);

  answers[2]?.(false);
  await flush();
  expect(updater.autoInstallOnAppQuit).toBe(false);
});
