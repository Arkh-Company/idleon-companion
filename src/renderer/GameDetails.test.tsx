// @vitest-environment jsdom
// Game details and Copy (spec 008 US13, FR-030, CHK009; design.md C10, §3.8): Copy puts one line on the clipboard, the
// row's name, the game's call and the raw number, tab-separated and nothing more; the row says "Copied" for 2 s and the
// page's polite region says it once. The call keeps the character's index, never a name. Every value and name is invented.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Characters, FormulaTree, Stats } from "../shared/index.ts";
import { App } from "./App.tsx";
import { stubCompanion } from "./companion-stub.ts";
import type { CompanionStub } from "./companion-stub.ts";
import { node, ready } from "./formula-fixture.ts";

const STATS: Stats = {
  state: "ready",
  rows: [{ label: "Drop Rate", text: "1,234x" }],
};
const CHARACTERS: Characters = {
  names: ["Quillo", "Quillon"],
  classes: [null, null],
  active: 1,
};
const CALL = 'GoldBonus("(character 1)", 3)';

let companion: CompanionStub;
let sendTree: (t: FormulaTree) => void = () => undefined;
let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;
beforeEach(() => {
  companion = stubCompanion();
  companion.onStats.mockImplementation((cb) => {
    cb(STATS);
    return () => undefined;
  });
  companion.onFormula.mockImplementation((cb) => {
    sendTree = cb;
    return () => undefined;
  });
  companion.onCharacters.mockImplementation((cb) => {
    cb(CHARACTERS);
    return () => undefined;
  });
  writeText = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const item = (name: RegExp | string) => screen.getByRole("treeitem", { name });
const key = (k: string) => {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: k });
};
const region = () => document.querySelector('[aria-live="polite"].sr-only');

/** The App with a Drop Rate tree whose part has `over`, opened down to its Copy row, which has the focus. */
async function copyRow(over: Parameters<typeof node>[0] = {}) {
  render(<App />);
  fireEvent.click(await screen.findByRole("tab", { name: "Stats" }));
  fireEvent.click(screen.getByRole("button", { name: "1,234x" }));
  const part = node({
    id: "root/G",
    name: "Golden Bonus",
    value: 56036.1897541,
    code: CALL,
    ...over,
  });
  act(() => {
    sendTree(ready(node({ value: 56036.1897541, kids: [part] })));
  });
  item(/^Golden/).focus();
  key("Enter");
  item("Game details").focus();
  key("Enter");
  item("Copy").focus();
}
async function copy() {
  await act(async () => {
    key("Enter");
    await Promise.resolve();
  });
}

test("Copy puts the row's name, the call and the raw number on the clipboard, tab-separated (FR-030)", async () => {
  await copyRow();
  await copy();
  expect(writeText).toHaveBeenCalledExactlyOnceWith(
    `Golden Bonus\t${CALL}\t56036.189754`,
  );
  expect(item(`Exact value: 56036.189754`)).toBeDefined();
});

test("a tab or a line break inside a field becomes a space: always three fields", async () => {
  await copyRow({ name: "Golden\tBonus\nTwo" });
  await copy();
  const text = writeText.mock.calls[0]?.[0] ?? "";
  expect(text.split("\t")).toEqual(["Golden Bonus Two", CALL, "56036.189754"]);
  expect(text).not.toMatch(/[\r\n]/);
});

test("after Copy the row says Copied for 2 s, the polite region says it once, and the focus stays", async () => {
  await copyRow();
  vi.useFakeTimers();
  await copy();
  expect(region()?.textContent).toBe("Copied");
  expect(document.activeElement).toBe(item("Copied"));
  expect(item("Copied").getAttribute("aria-live")).toBe(null);
  act(() => {
    vi.advanceTimersByTime(1_999);
  });
  expect(item("Copied")).toBeDefined();
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(document.activeElement).toBe(item("Copy"));
});

test("a second Copy inside the 2 s counts its 2 s from itself", async () => {
  await copyRow();
  vi.useFakeTimers();
  await copy();
  act(() => {
    vi.advanceTimersByTime(1_500);
  });
  await copy();
  act(() => {
    vi.advanceTimersByTime(1_000);
  });
  expect(item("Copied")).toBeDefined();
});

test("a clipboard that refuses never says Copied", async () => {
  writeText.mockRejectedValue(new Error("denied"));
  await copyRow();
  await copy();
  expect(region()?.textContent).toBe("Could not copy");
  expect(screen.queryByRole("treeitem", { name: "Copied" })).toBe(null);
});

test("the call and the copy keep the character's index, never a name", async () => {
  await copyRow();
  await copy();
  const shown = item("Game details").textContent;
  const copied = writeText.mock.calls[0]?.[0] ?? "";
  expect(copied).toContain("(character 1)");
  for (const name of CHARACTERS.names) {
    expect(shown).not.toContain(name);
    expect(copied).not.toContain(name);
  }
});
