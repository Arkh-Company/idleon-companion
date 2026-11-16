// @vitest-environment jsdom
// The tabs of the window (contracts/ipc.md): the Screen map, by default, the Stats and the Formulas (spec 008).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { GameContext } from "../shared/index.ts";
import { App } from "./App.tsx";
import { stubCompanion } from "./companion-stub.ts";

const ctx: GameContext = {
  screen: { world: 1, map: 0, label: "Invented screen" },
  character: null,
  afk: null,
  names: { map: "Invented map", afk: "None" },
  updatedAt: 1,
};

beforeEach(() => {
  const companion = stubCompanion();
  companion.onContext.mockImplementation((cb) => {
    cb(ctx);
    return () => undefined;
  });
  companion.onStats.mockImplementation((cb) => {
    cb({ state: "calculating" });
    return () => undefined;
  });
});
afterEach(cleanup);

const tab = (name: string) => screen.getByRole("tab", { name });
const map = () => screen.queryByRole("rowheader", { name: "Screen" });
const stats = () => screen.queryByText("Calculating");

test("there are three tabs and the Screen map is selected by default", async () => {
  render(<App />);
  const tabs = await screen.findAllByRole("tab");

  expect(tabs.map((t) => t.textContent)).toEqual([
    "Screen map",
    "Stats",
    "Formulas",
  ]);
  expect(tab("Screen map").getAttribute("aria-selected")).toBe("true");
  expect(tab("Stats").getAttribute("aria-selected")).toBe("false");
  expect(tab("Formulas").getAttribute("aria-selected")).toBe("false");
  expect(map()).not.toBe(null);
  expect(stats()).toBe(null);
});

test("choosing Stats shows its panel and hides the map", async () => {
  render(<App />);
  await screen.findAllByRole("tab");

  fireEvent.click(tab("Stats"));

  expect(tab("Stats").getAttribute("aria-selected")).toBe("true");
  expect(stats()).not.toBe(null);
  expect(map()).toBe(null);
});

test("going back shows the map again", async () => {
  render(<App />);
  await screen.findAllByRole("tab");

  fireEvent.click(tab("Stats"));
  fireEvent.click(tab("Screen map"));

  expect(map()).not.toBe(null);
  expect(stats()).toBe(null);
});

// The APG tabs (review of the feature): one Tab stop on the selected tab, the arrows, Home and End move and select.
test("the arrows, Home and End move the selection along the tabs, which are one Tab stop", async () => {
  render(<App />);
  await screen.findAllByRole("tab");
  const stops = () =>
    screen.getAllByRole("tab").filter((t) => t.tabIndex === 0);
  expect(stops()).toEqual([tab("Screen map")]);
  tab("Screen map").focus();
  fireEvent.keyDown(tab("Screen map"), { key: "ArrowRight" });
  expect(tab("Stats").getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(tab("Stats"));
  expect(stops()).toEqual([tab("Stats")]);
  fireEvent.keyDown(tab("Stats"), { key: "End" });
  expect(document.activeElement).toBe(tab("Formulas"));
  fireEvent.keyDown(tab("Formulas"), { key: "ArrowRight" });
  expect(document.activeElement).toBe(tab("Screen map"));
  fireEvent.keyDown(tab("Screen map"), { key: "ArrowLeft" });
  expect(document.activeElement).toBe(tab("Formulas"));
  fireEvent.keyDown(tab("Formulas"), { key: "Home" });
  expect(tab("Screen map").getAttribute("aria-selected")).toBe("true");
});
