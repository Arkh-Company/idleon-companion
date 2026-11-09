import { expect, test } from "vitest";
import { DEFAULT_SETTINGS, IPC, moduleChannel } from "./index.ts";

test("IPC holds the fixed channel names", () => {
  expect(IPC).toEqual({
    contextUpdate: "context:update",
    statusUpdate: "status:update",
    settingsGet: "settings:get",
    settingsSet: "settings:set",
    confirmAttach: "reader:confirm-attach",
    steamState: "steam:state",
    steamSetup: "steam:setup",
    steamProgress: "steam:progress",
    readerRelease: "reader:release",
    readerReconnect: "reader:reconnect",
    updateState: "update:state",
    updateInstall: "update:install",
    statsUpdate: "stats:update",
  });
});

test("moduleChannel prefixes the module id", () => {
  expect(moduleChannel("screen-map", "x")).toBe("module:screen-map:x");
});

test("DEFAULT_SETTINGS shows the window, closes with the game and stays below", () => {
  expect(DEFAULT_SETTINGS).toEqual({
    showWindowOnGameStart: true,
    closeWithGame: true,
    alwaysOnTop: false,
  });
});
