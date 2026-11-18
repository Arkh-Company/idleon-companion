// @vitest-environment jsdom
// The character picker (spec 008 FR-020; design.md C19): it opens on the active character, another one asks that
// character's tree, its tree has the band and no parity with the Stats, and the live region says the new breakdown
// once. The names and classes are invented; on screen a character shows by its name and class (FR-010).
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
import { SidePanel } from "./SidePanel.tsx";

const STATS: Stats = {
  state: "ready",
  rows: [{ label: "Drop Rate", text: "1,234x" }],
};
const CHARACTERS: Characters = {
  names: ["Wren", "Wrenna", "Ash"],
  classes: ["Novice", "Star Seeker", null],
  active: 1,
};
const BAND =
  "Not the active character. These numbers can't be compared with Stats.";

let companion: CompanionStub;
let sendTree: (t: FormulaTree) => void = () => undefined;
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
});
afterEach(cleanup);

async function openDropRate() {
  render(<App />);
  fireEvent.click(await screen.findByRole("tab", { name: "Stats" }));
  fireEvent.click(screen.getByRole("button", { name: "1,234x" }));
}
const picker = () =>
  screen.getByRole<HTMLSelectElement>("combobox", { name: "Character" });
const SIDE = {
  label: "Drop Rate",
  text: "1,234x",
  trees: [["dropRate", "Drop Rate"]] as const,
  id: "dropRate",
};
const treeOf = (character: number) =>
  ready(node(), {
    request: { type: "number", id: "dropRate", character },
    character,
    activeCharacter: 1,
  });

test("the picker opens on the active character, each one by its name and class, when known", async () => {
  await openDropRate();
  expect(picker().value).toBe("1");
  expect([...picker().options].map((o) => o.textContent)).toEqual([
    "Wren (Novice)",
    "Wrenna (Star Seeker) · active",
    "Ash",
  ]);
  expect(screen.queryByText(BAND)).toBe(null);
});

test("another character asks its tree for the open number", async () => {
  await openDropRate();
  fireEvent.change(picker(), { target: { value: "2" } });
  expect(companion.requestFormula).toHaveBeenLastCalledWith({
    id: "dropRate",
    character: 2,
  });
});

test("another character's tree has the band and no Same as Stats, and the picker stays on it", async () => {
  await openDropRate();
  act(() => {
    sendTree(treeOf(2));
  });
  expect(screen.getByText(BAND)).toBeDefined();
  expect(screen.queryByText(/Same as Stats/)).toBe(null);
  expect(picker().value).toBe("2");
});

test("the active character's tree has no band", async () => {
  await openDropRate();
  act(() => {
    sendTree(treeOf(1));
  });
  expect(screen.queryByText(BAND)).toBe(null);
  expect(screen.getByText(/Same as Stats/)).toBeDefined();
});

test("the picker keeps the focus while the tree is calculated again", async () => {
  await openDropRate();
  picker().focus();
  fireEvent.change(picker(), { target: { value: "0" } });
  act(() => {
    sendTree({
      state: "calculating",
      request: { type: "number", id: "dropRate", character: 0 },
    });
  });
  act(() => {
    sendTree(treeOf(0));
  });
  expect(document.activeElement).toBe(picker());
});

test("the live region says the picked character's breakdown once, when it is ready", () => {
  const announce = vi.fn();
  const panel = (tree: FormulaTree) => (
    <SidePanel
      side={SIDE}
      tree={tree}
      onClose={vi.fn()}
      onPick={vi.fn()}
      onExpand={vi.fn()}
      announce={announce}
      pins={[]}
      onPin={vi.fn()}
      onOpenNumber={vi.fn()}
      characters={CHARACTERS}
      onCharacter={vi.fn()}
    />
  );
  const { rerender } = render(panel(treeOf(1)));
  fireEvent.change(picker(), { target: { value: "2" } });
  rerender(panel({ state: "calculating", request: treeOf(2).request }));
  expect(announce).not.toHaveBeenCalled();
  rerender(panel(treeOf(2)));
  // Another tree of the same character is no new pick.
  rerender(panel({ ...treeOf(2), calculatedAt: 2_000 }));
  expect(announce.mock.calls).toEqual([["Breakdown for Ash"]]);
});

test("no picker before the game's list of characters is known", async () => {
  companion.onCharacters.mockImplementation(() => () => undefined);
  await openDropRate();
  expect(screen.queryByRole("combobox", { name: "Character" })).toBe(null);
});

test("the picker is a target of at least 24 px (design.md C8)", () => {
  const css = readFileSync(join(import.meta.dirname, "styles.css"), "utf8");
  expect(css).toMatch(/\.character-picker select \{[^}]*min-height: 24px/);
});
