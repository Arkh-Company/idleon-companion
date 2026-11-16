// @vitest-environment jsdom
// The Pin strip (spec 008 FR-026, FR-031, FR-036, FR-040, FR-041; T043): any number that opens a tree can be pinned, up
// to 5, in a strip under the status bar that wraps after 3; a value that changes is highlighted, with text and without
// an announcement; the pins come back after a restart, without values. Every value and name is invented.
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
import { PINS_FULL } from "../shared/index.ts";
import type { LiveValues, Pin, Stats } from "../shared/index.ts";
import { App } from "./App.tsx";
import { stubCompanion } from "./companion-stub.ts";
import type { CompanionStub } from "./companion-stub.ts";

const STATS: Stats = {
  state: "ready",
  rows: [
    { label: "Drop Rate", text: "1,234x" },
    { label: "HP", text: "500" },
  ],
};
const pin = (treeId: string): Pin => ({ treeId, nodeId: null });
const FIVE = ["hp", "str", "agi", "wis", "luk"].map(pin);

let companion: CompanionStub;
let saved: Pin[];
let warning: string | null;
let sendLive: (v: LiveValues) => void = () => undefined;
beforeEach(() => {
  saved = [];
  warning = null;
  companion = stubCompanion();
  companion.onStats.mockImplementation((cb) => {
    cb(STATS);
    return () => undefined;
  });
  companion.onLiveValues.mockImplementation((cb) => {
    sendLive = cb;
    return () => undefined;
  });
  companion.getPins.mockImplementation(() =>
    Promise.resolve({ pins: [...saved], warning }),
  );
  companion.setPins.mockImplementation((pins) => {
    saved = [...pins];
    return Promise.resolve(null);
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
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}
async function openDropRate() {
  fireEvent.click(screen.getByRole("tab", { name: "Stats" }));
  fireEvent.click(screen.getByRole("button", { name: "1,234x" }));
  await settle();
}
const strip = () => screen.queryByRole("region", { name: "Pinned numbers" });
const inStrip = () => {
  const s = strip();
  if (!s) throw new Error("no pin strip");
  return within(s);
};
const live = (values: LiveValues["values"]) => {
  act(() => {
    sendLive({ values, calculatedAt: 1, stale: false });
  });
};
const liveRegion = () => document.querySelector('[aria-live="polite"]');

test("a number open in the side panel is pinned, and unpinned from the strip (FR-036)", async () => {
  await app();
  expect(strip()).toBe(null);
  await openDropRate();
  fireEvent.click(screen.getByRole("button", { name: "Pin" }));
  await settle();
  expect(companion.setPins).toHaveBeenLastCalledWith([pin("dropRate")]);
  expect(
    inStrip().getByRole("button", { name: /^Drop Rate calculating$/ }),
  ).toBeDefined();
  // The side panel's button now unpins.
  expect(screen.getByRole("button", { name: "Unpin" })).toBeDefined();

  fireEvent.click(inStrip().getByRole("button", { name: "Unpin Drop Rate" }));
  await settle();
  expect(companion.setPins).toHaveBeenLastCalledWith([]);
  expect(strip()).toBe(null);
  // The strip is gone: the focus goes to the tab's content, never to the page.
  expect(document.activeElement?.id).toBe("tab-content");
  expect(screen.getByRole("button", { name: "Pin" })).toBeDefined();
});

test("a sixth pin is refused with its sentence, said once; unpinning one clears it and keeps the focus in the strip (FR-036)", async () => {
  saved = [...FIVE];
  await app();
  expect(inStrip().getAllByRole("listitem")).toHaveLength(5);
  await openDropRate();
  fireEvent.click(screen.getByRole("button", { name: "Pin" }));
  await settle();
  expect(companion.setPins).not.toHaveBeenCalled();
  expect(inStrip().getByText(PINS_FULL)).toBeDefined();
  expect(liveRegion()?.textContent).toBe(PINS_FULL);

  fireEvent.click(inStrip().getByRole("button", { name: "Unpin HP" }));
  await settle();
  expect(companion.setPins).toHaveBeenLastCalledWith(FIVE.slice(1));
  expect(inStrip().queryByText(PINS_FULL)).toBe(null);
  // The next pin's Unpin takes the place of the one removed.
  expect(document.activeElement).toBe(
    inStrip().getByRole("button", { name: "Unpin STR" }),
  );
});

test("the same refusal twice is said twice: the region changes at each one (§3.8)", async () => {
  saved = [...FIVE];
  await app();
  await openDropRate();
  const live = liveRegion();
  if (!live) throw new Error("no live region");
  const changes: string[] = [];
  const watch = new MutationObserver(() => {
    changes.push(live.textContent);
  });
  watch.observe(live, { childList: true, characterData: true, subtree: true });
  for (let i = 0; i < 2; i++) {
    changes.length = 0;
    fireEvent.click(screen.getByRole("button", { name: "Pin" }));
    await settle();
    expect(changes.length).toBeGreaterThan(0);
    expect(live.textContent).toBe(PINS_FULL);
  }
  watch.disconnect();
});

test("after a restart the pins are back without values; a change is highlighted with text, never announced (FR-026, FR-040)", async () => {
  saved = [pin("hp")];
  await app();
  expect(
    inStrip().getByRole("button", { name: "HP calculating" }),
  ).toBeDefined();
  live({ hp: 500 });
  const item = () => inStrip().getByRole("listitem");
  expect(item().classList.contains("pin--changed")).toBe(false);
  expect(inStrip().getByRole("button", { name: "HP 500" })).toBeDefined();

  live({ hp: 510 });
  expect(item().classList.contains("pin--changed")).toBe(true);
  expect(
    inStrip().getByRole("button", { name: "HP 510 changed" }),
  ).toBeDefined();
  expect(strip()?.querySelector("[aria-live]")).toBe(null);
  expect(liveRegion()?.textContent).toBe("");

  // A tap opens its tree, and the number counts as seen.
  fireEvent.click(inStrip().getByRole("button", { name: "HP 510 changed" }));
  await settle();
  expect(companion.requestFormula).toHaveBeenLastCalledWith({ id: "hp" });
  expect(item().classList.contains("pin--changed")).toBe(false);

  // Another character: its first value is not a change.
  live({});
  live({ hp: 900 });
  expect(item().classList.contains("pin--changed")).toBe(false);
});

test("an unreadable pins file is said once, and the strip starts empty (FR-041)", async () => {
  warning = "Saved pins could not be read and were reset";
  await app();
  expect(inStrip().getByText(warning)).toBeDefined();
  expect(inStrip().queryAllByRole("listitem")).toHaveLength(0);
  expect(liveRegion()?.textContent).toBe(warning);
});

test("a pin that could not be written stays for this session, with the sentence", async () => {
  companion.setPins.mockResolvedValue(
    "The pins could not be saved on this computer.",
  );
  await app();
  await openDropRate();
  fireEvent.click(screen.getByRole("button", { name: "Pin" }));
  await settle();
  expect(
    inStrip().getByText("The pins could not be saved on this computer."),
  ).toBeDefined();
  expect(inStrip().getAllByRole("listitem")).toHaveLength(1);
});

test("the strip wraps after 3 and fits 210 px CSS without sideways scroll (FR-026, FR-031)", async () => {
  saved = FIVE.slice(0, 4);
  await app();
  expect(strip()?.querySelector("[style]")).toBe(null);
  const css = readFileSync(join(import.meta.dirname, "styles.css"), "utf8");
  expect(css).toMatch(
    /\.pins ul \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
  );
  expect(css).toMatch(/\.pins \{[^}]*overflow-wrap: anywhere/);
});
