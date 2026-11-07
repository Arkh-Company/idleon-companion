import { expect, test } from "vitest";
import { windowOptions } from "./window-options.ts";

test("the window is titled and isolated from Node", () => {
  const options = windowOptions("x/preload.cjs");

  expect(options.title).toBe("IdleOn Companion");
  expect(options.webPreferences?.contextIsolation).toBe(true);
  expect(options.webPreferences?.nodeIntegration).toBe(false);
  expect(options.webPreferences?.sandbox).not.toBe(false);
  expect(options.webPreferences?.preload).toBe("x/preload.cjs");
});
