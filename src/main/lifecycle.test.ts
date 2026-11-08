// The app's lifecycle decisions (plan Task 10; Review Focus 5 for second-instance).
import { expect, test } from "vitest";
import { DEFAULT_SETTINGS } from "../shared/index.ts";
import {
  NOT_CONNECTED,
  decide,
  launchEvent,
  oneAtATime,
  shouldReload,
  statusOnLinkDrop,
  trayItems,
} from "./lifecycle.ts";

test("a start from Steam shows the window when the setting says so", () => {
  expect(decide("start-from-steam", { ...DEFAULT_SETTINGS }, false)).toEqual([
    "show-window",
  ]);
});

test("a start from Steam keeps the window hidden when the setting is off", () => {
  expect(
    decide(
      "start-from-steam",
      { ...DEFAULT_SETTINGS, showWindowOnGameStart: false },
      false,
    ),
  ).toEqual([]);
});

test("a manual start always shows the window", () => {
  expect(decide("start-manual", DEFAULT_SETTINGS, false)).toEqual([
    "show-window",
  ]);
});

test("a second instance focuses the first window", () => {
  expect(decide("second-instance", DEFAULT_SETTINGS, false)).toEqual([
    "focus-window",
  ]);
});

test("the game exiting quits the app when the setting says so", () => {
  expect(decide("game-exited", DEFAULT_SETTINGS, true)).toEqual(["quit"]);
});

test("the game exiting keeps the app when the setting is off", () => {
  expect(
    decide("game-exited", { ...DEFAULT_SETTINGS, closeWithGame: false }, true),
  ).toEqual([]);
});

test("a tray click hides a visible window", () => {
  expect(decide("tray-click", DEFAULT_SETTINGS, true)).toEqual(["hide-window"]);
});

test("a tray click shows a hidden window", () => {
  expect(decide("tray-click", DEFAULT_SETTINGS, false)).toEqual([
    "show-window",
  ]);
});

test("closing the window with X hides it in the tray", () => {
  expect(decide("window-close", DEFAULT_SETTINGS, true)).toEqual([
    "hide-window",
  ]);
});

test("closing the window while the app quits lets it close", () => {
  expect(decide("window-close", DEFAULT_SETTINGS, true, true)).toEqual([]);
});

test("a link that drops after the game closed keeps the closed status and its last reading", () => {
  const closed = { game: "closed", reader: "error", lastReadingAt: 5 } as const;
  expect(statusOnLinkDrop(closed)).toBe(closed);
});

test("a link that drops while the game runs means not connected", () => {
  expect(statusOnLinkDrop({ game: "running", reader: "attached" })).toBe(
    NOT_CONNECTED,
  );
});

test("a launch from Steam is a Steam start, also in a second instance", () => {
  expect(launchEvent(["electron", ".", "--from-steam"], false)).toBe(
    "start-from-steam",
  );
  expect(launchEvent(["electron", ".", "--from-steam"], true)).toBe(
    "start-from-steam",
  );
});

test("a manual launch starts the app, or brings the first window forward", () => {
  expect(launchEvent(["electron", "."], true)).toBe("start-manual");
  expect(launchEvent(["electron", "."], false)).toBe("second-instance");
});

const MINUTE = 60_000;

test("a crashed window reloads", () => {
  expect(shouldReload("crashed", true, [], 10 * MINUTE)).toBe(true);
});

test("a window that exited cleanly does not reload", () => {
  expect(shouldReload("clean-exit", true, [], 10 * MINUTE)).toBe(false);
});

test("a window already destroyed does not reload", () => {
  expect(shouldReload("crashed", false, [], 10 * MINUTE)).toBe(false);
});

test("a window reloads at most 3 times a minute", () => {
  const now = 10 * MINUTE;
  const three = [now - 3000, now - 2000, now - 1000];
  expect(shouldReload("crashed", true, three, now)).toBe(false);
  expect(
    shouldReload(
      "crashed",
      true,
      three.map((t) => t - MINUTE),
      now,
    ),
  ).toBe(true);
});

test("while reading, the tray offers Let the game close", () => {
  expect(trayItems({ game: "running", reader: "attached" })).toEqual([
    "Show/Hide",
    "Let the game close",
    "Quit",
  ]);
});

test("once released, the tray offers Reconnect", () => {
  expect(trayItems({ game: "running", reader: "released" })).toEqual([
    "Show/Hide",
    "Reconnect",
    "Quit",
  ]);
});

test.each([
  { game: "closed", reader: "attached" },
  { game: "closed", reader: "released" },
  { game: "not-launched", reader: "attached" },
  { game: "not-launched", reader: "released" },
  { game: "running", reader: "connecting" },
  { game: "running", reader: "error" },
] as const)(
  "with no game to let go (%o) the tray has only its two items",
  (status) => {
    expect(trayItems(status)).toEqual(["Show/Hide", "Quit"]);
  },
);

test("one job at a time: a call while one runs gets that job's result and starts nothing", async () => {
  const one = oneAtATime<string>();
  let finishFirst = (_v: string): void => undefined;
  const first = one(
    () =>
      new Promise<string>((resolve) => {
        finishFirst = resolve;
      }),
  );
  let started = false;
  const second = one(() => {
    started = true;
    return Promise.resolve("second");
  });

  finishFirst("first");

  expect(await first).toBe("first");
  expect(await second).toBe("first");
  expect(started).toBe(false);
});

test("the next job runs once the last one ended, also after a failure", async () => {
  const one = oneAtATime<string>();
  await expect(one(() => Promise.reject(new Error("no")))).rejects.toThrow(
    "no",
  );
  expect(await one(() => Promise.resolve("next"))).toBe("next");
  expect(await one(() => Promise.resolve("and next"))).toBe("and next");
});
