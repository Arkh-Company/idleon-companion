// @vitest-environment jsdom
// The farm strip (spec 008 FR-028, FR-031, FR-039, FR-040; T047): two short lines under the status bar on every tab,
// while the character farms or the count is paused; "Items" opens the items per hour. The numbers change with each
// update and are never announced. Every value and item name is invented.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { FarmUpdate } from "../shared/index.ts";
import { App } from "./App.tsx";
import { stubCompanion } from "./companion-stub.ts";
import { perHour } from "./FarmStrip.tsx";

const FARMING: FarmUpdate = {
  state: "counting",
  minutes: 12,
  xpPerHour: 1_234_567,
  goldPerHour: 48_000,
  items: [
    { name: "Copper Ore", perHour: 120 },
    { name: "Oak Logs", perHour: 0.5 },
  ],
};

let sendFarm: (f: FarmUpdate) => void = () => undefined;
beforeEach(() => {
  const companion = stubCompanion();
  companion.onFarm.mockImplementation((cb) => {
    sendFarm = cb;
    return () => undefined;
  });
});
afterEach(cleanup);

async function app() {
  await act(async () => {
    render(<App />);
    await Promise.resolve();
  });
  await screen.findByRole("tab", { name: "Stats" });
}
const farm = (f: FarmUpdate) => {
  act(() => {
    sendFarm(f);
  });
};
const strip = () => screen.queryByRole("region", { name: "Farm" });
const inStrip = () => {
  const s = strip();
  if (!s) throw new Error("no farm strip");
  return within(s);
};
/** The text a sighted player reads: without what only a screen reader gets. */
function shown(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  for (const sr of copy.querySelectorAll(".sr-only")) sr.remove();
  return copy.textContent;
}
const lines = () =>
  [...(strip()?.querySelectorAll("p") ?? [])].map((p) => shown(p));

test("rates read as the game shows big numbers, per hour", () => {
  expect(perHour(1_234_567)).toBe("1.2M");
  expect(perHour(48_000)).toBe("48K");
  expect(perHour(120)).toBe("120");
  expect(perHour(0.5)).toBe("0.5");
  expect(perHour(0)).toBe("0");
});

test("no strip while idle; counting shows two short lines (FR-028)", async () => {
  await app();
  expect(strip()).toBe(null);
  farm({ ...FARMING, state: "idle" });
  expect(strip()).toBe(null);
  farm(FARMING);
  expect(lines()).toEqual([
    "Farming 12 min",
    "XP 1.2M/h · Gold 48K/h · Items ▸",
  ]);
});

test("a town shows the count paused", async () => {
  await app();
  farm({ ...FARMING, state: "paused" });
  expect(lines()[0]).toBe("Paused in town · 12 min");
});

test("the strip stays on every tab", async () => {
  await app();
  farm(FARMING);
  for (const name of ["Stats", "Formulas", "Screen map"]) {
    fireEvent.click(screen.getByRole("tab", { name }));
    expect(strip()).not.toBe(null);
  }
});

test("Items opens the items per hour, and says so to a screen reader", async () => {
  await app();
  farm(FARMING);
  const items = inStrip().getByRole("button", { name: "Items" });
  expect(items.getAttribute("aria-expanded")).toBe("false");
  expect(inStrip().queryByRole("list")).toBe(null);
  fireEvent.click(items);
  expect(items.getAttribute("aria-expanded")).toBe("true");
  expect(
    inStrip()
      .getAllByRole("listitem")
      .map((li) => shown(li)),
  ).toEqual(["Copper Ore 120/h", "Oak Logs 0.5/h"]);
  fireEvent.click(items);
  expect(inStrip().queryByRole("list")).toBe(null);
});

test("no item yet says so", async () => {
  await app();
  farm({ ...FARMING, items: [] });
  fireEvent.click(inStrip().getByRole("button", { name: "Items" }));
  expect(inStrip().getByText("No items yet.")).toBeDefined();
});

test("a rate reads as words, and its numbers are never announced (FR-040)", async () => {
  await app();
  farm(FARMING);
  const s = strip();
  expect(s?.querySelector("[aria-live]")).toBe(null);
  expect(s?.closest("[aria-live]")).toBe(null);
  // "/h" is hidden from a screen reader, which reads "per hour".
  for (const h of s?.querySelectorAll('[aria-hidden="true"]') ?? [])
    expect(["/h", "▸"]).toContain(h.textContent);
  expect(s?.textContent).toContain("1.2M/h per hour");
  farm({ ...FARMING, minutes: 13, xpPerHour: 2_000_000 });
  expect(
    document.querySelector('.main-panel > [aria-live="polite"]')?.textContent,
  ).toBe("");
});

test("the strip going away with the focus on it gives the focus to the tab's content (FR-039)", async () => {
  await app();
  farm(FARMING);
  inStrip().getByRole("button", { name: "Items" }).focus();
  farm({ ...FARMING, state: "idle" });
  expect(strip()).toBe(null);
  expect(document.activeElement?.id).toBe("tab-content");
});

test("the strip fits 210 px CSS without sideways scroll (FR-031)", async () => {
  await app();
  farm(FARMING);
  expect(strip()?.querySelector("[style]")).toBe(null);
  const css = readFileSync(join(import.meta.dirname, "styles.css"), "utf8");
  expect(css).toMatch(/\.farm \{[^}]*overflow-wrap: anywhere/);
});
