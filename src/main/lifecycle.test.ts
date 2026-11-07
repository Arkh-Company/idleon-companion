// The app's lifecycle decisions (plan Task 10; Review Focus 5 for second-instance).
import { expect, test } from "vitest";
import { DEFAULT_SETTINGS } from "../shared/index.ts";
import { decide } from "./lifecycle.ts";

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
