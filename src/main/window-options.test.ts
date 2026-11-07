import { expect, test } from "vitest";
import { isAllowedNavigation, windowOptions } from "./window-options.ts";

const own = "file:///C:/repo/out/renderer/index.html";

test("the window may stay on its own page, also with a hash", () => {
  expect(isAllowedNavigation(own, own)).toBe(true);
  expect(isAllowedNavigation(`${own}#settings`, own)).toBe(true);
});

test.each([
  ["another file", "file:///C:/Windows/win.ini"],
  ["a web page", "https://example.com/"],
  ["the own page with a query", `${own}?x=1`],
  ["text that is not a URL", "not a url"],
])("the window may not go to %s", (_name, url) => {
  expect(isAllowedNavigation(url, own)).toBe(false);
});

test("the dev server page is the own page in dev", () => {
  expect(
    isAllowedNavigation("http://localhost:5173/", "http://localhost:5173/"),
  ).toBe(true);
  expect(
    isAllowedNavigation("http://localhost:5174/", "http://localhost:5173/"),
  ).toBe(false);
});

test("the window is titled and isolated from Node", () => {
  const options = windowOptions("x/preload.cjs");

  expect(options.title).toBe("IdleOn Companion");
  expect(options.webPreferences?.contextIsolation).toBe(true);
  expect(options.webPreferences?.nodeIntegration).toBe(false);
  expect(options.webPreferences?.sandbox).not.toBe(false);
  expect(options.webPreferences?.preload).toBe("x/preload.cjs");
});
