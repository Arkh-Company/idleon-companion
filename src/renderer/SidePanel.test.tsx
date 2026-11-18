// @vitest-environment jsdom
// The side panel (spec 008 FR-001, FR-005, FR-006, FR-019, FR-034, FR-039; design.md C1, C9, §3.5): the Stats value is a
// button that opens the tree beside the window, ✕ closes it and gives the focus back, and no short answer sits above the
// tree (spec 009 FR-001). Every value and name is invented.
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
import { LIVE_MAP_TEXT, TREE_CATALOG } from "../shared/index.ts";
import type { FormulaTree, Stats } from "../shared/index.ts";
import { App } from "./App.tsx";
import { stubCompanion } from "./companion-stub.ts";
import type { CompanionStub } from "./companion-stub.ts";
import { node, ready } from "./formula-fixture.ts";
import { SidePanel } from "./SidePanel.tsx";
import type { Side } from "./SidePanel.tsx";
import { STATS_TREES } from "./StatsPanel.tsx";

const STATS: Stats = {
  state: "ready",
  rows: [
    { label: "Drop Rate", text: "1,234x" },
    { label: "Damage", text: "10 – 20" },
    { label: "HP", text: "500" },
  ],
};

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
});
afterEach(cleanup);

async function statsTab() {
  render(<App />);
  fireEvent.click(await screen.findByRole("tab", { name: "Stats" }));
}
const value = (name: string) => screen.getByRole("button", { name });
const panel = () => screen.queryByRole("complementary", { name: /breakdown/ });

test("each Stats row keeps its header and row, and its value is a button inside the cell (FR-001)", async () => {
  await statsTab();
  expect(screen.getAllByRole("rowheader").map((h) => h.textContent)).toEqual([
    "Drop Rate",
    "Damage",
    "HP",
  ]);
  expect(screen.getByRole("row", { name: "Drop Rate 1,234x" })).toBeDefined();
  const button = value("1,234x");
  expect(button.closest("td")).not.toBe(null);
  expect(button.getAttribute("aria-describedby")).not.toBe(null);
});

test("every Stats tree is a number of the catalog", () => {
  const ids = new Set(TREE_CATALOG.map((n) => n.id));
  for (const [, trees] of Object.entries(STATS_TREES))
    for (const [id] of trees) expect(ids.has(id)).toBe(true);
});

test("tapping a value opens the side panel, widens the window and asks its tree; the focus goes to the title", async () => {
  await statsTab();
  fireEvent.click(value("1,234x"));
  expect(panel()).not.toBe(null);
  expect(companion.setSidePanel).toHaveBeenCalledWith({ open: true });
  expect(companion.requestFormula).toHaveBeenCalledWith({ id: "dropRate" });
  expect(document.activeElement?.tagName).toBe("H2");
  expect(document.activeElement?.textContent).toContain("Drop Rate");
});

/** The main widens the window: to the left moves its left edge (`screenX`) by as much. */
function widenTo(screenX: number) {
  companion.setSidePanel.mockImplementation(({ open }) => {
    if (open)
      Object.defineProperty(window, "screenX", {
        value: screenX,
        configurable: true,
      });
    return Promise.resolve();
  });
}
const main = () => document.querySelector("main");

test.each([
  [
    "to the left, the panel goes on the left: the Stats stays under the cursor",
    580,
    true,
  ],
  ["to the right, the panel stays on the right", 1000, false],
])("when the window widens %s", async (_side, after, left) => {
  Object.defineProperty(window, "screenX", { value: 1000, configurable: true });
  widenTo(after);
  await statsTab();
  await act(async () => {
    fireEvent.click(value("1,234x"));
    await Promise.resolve();
  });
  expect(main()?.classList.contains("with-side--left")).toBe(left);
  fireEvent.click(screen.getByRole("button", { name: "Close the breakdown" }));
  expect(main()?.classList.contains("with-side--left")).toBe(false);
});

async function openDropRate() {
  await act(async () => {
    fireEvent.click(value("1,234x"));
    await Promise.resolve();
  });
}
const closePanel = () => {
  fireEvent.click(screen.getByRole("button", { name: "Close the breakdown" }));
};

test("a panel opened on the left and closed opens on the right next time, when the window grows to the right", async () => {
  Object.defineProperty(window, "screenX", { value: 1000, configurable: true });
  widenTo(580);
  await statsTab();
  await openDropRate();
  closePanel();
  Object.defineProperty(window, "screenX", { value: 1000, configurable: true });
  widenTo(1000);
  await openDropRate();
  expect(main()?.classList.contains("with-side--left")).toBe(false);
});

test("a widening that ends after ✕ does not put the next panel on the left", async () => {
  Object.defineProperty(window, "screenX", { value: 1000, configurable: true });
  let finish: () => void = () => undefined;
  companion.setSidePanel.mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        finish = () => {
          Object.defineProperty(window, "screenX", {
            value: 580,
            configurable: true,
          });
          done();
        };
      }),
  );
  await statsTab();
  fireEvent.click(value("1,234x"));
  closePanel();
  await act(async () => {
    finish();
    await Promise.resolve();
  });
  Object.defineProperty(window, "screenX", { value: 1000, configurable: true });
  widenTo(1000);
  await openDropRate();
  expect(main()?.classList.contains("with-side--left")).toBe(false);
});

test("the panel on the left comes first in the grid", () => {
  const css = readFileSync(join(import.meta.dirname, "styles.css"), "utf8");
  expect(css).toMatch(/\.with-side--left \.side-panel \{[^}]*order: -1/);
});

test("another value while open changes the tree, and the window is widened only once", async () => {
  await statsTab();
  fireEvent.click(value("1,234x"));
  fireEvent.click(value("500"));
  expect(companion.requestFormula).toHaveBeenLastCalledWith({ id: "hp" });
  expect(companion.setSidePanel).toHaveBeenCalledTimes(1);
});

test("✕ closes the panel, the window and the tree, and gives the focus back to the number (FR-039)", async () => {
  await statsTab();
  fireEvent.click(value("1,234x"));
  fireEvent.click(screen.getByRole("button", { name: "Close the breakdown" }));
  expect(panel()).toBe(null);
  expect(companion.setSidePanel).toHaveBeenLastCalledWith({ open: false });
  expect(companion.closeFormula).toHaveBeenCalled();
  expect(document.activeElement).toBe(value("1,234x"));
});

test("Damage opens a choice of its two trees, and a choice asks that tree", async () => {
  await statsTab();
  fireEvent.click(value("10 – 20"));
  expect(companion.requestFormula).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Max damage" }));
  expect(companion.requestFormula).toHaveBeenCalledWith({ id: "damageMax" });
});

test("the tree the main sends shows in the panel", async () => {
  await statsTab();
  fireEvent.click(value("1,234x"));
  act(() => {
    sendTree(ready(node({ kids: [node({ id: "root/A", name: "Alpha" })] })));
  });
  expect(
    screen.getByRole("tree", { name: "Drop Rate breakdown" }),
  ).toBeDefined();
});

const SIDE = {
  label: "Drop Rate",
  text: "1,234x",
  trees: [["dropRate", "Drop Rate"]] as const,
  id: "dropRate",
};
function drawPanel(tree: FormulaTree, side: Side = SIDE) {
  render(
    <SidePanel
      side={side}
      tree={tree}
      live={null}
      onClose={vi.fn()}
      onPick={vi.fn()}
      onExpand={vi.fn()}
      announce={vi.fn()}
      pins={[]}
      onPin={vi.fn()}
      onOpenNumber={vi.fn()}
      characters={null}
      onCharacter={vi.fn()}
    />,
  );
}
const lines = () =>
  [...document.querySelectorAll(".answer .short")].map((p) => p.textContent);

const adds = node({
  id: "root/Adds",
  name: "Adds",
  value: 100,
  kids: [
    node({
      id: "root/Adds/Golden",
      name: "Golden",
      value: 66,
      fmt: "%",
      share: 0.66,
      shareMode: "sum",
    }),
    node({
      id: "root/Adds/Other",
      name: "Other",
      value: 34,
      fmt: "%",
      share: 0.34,
      shareMode: "sum",
    }),
  ],
});
const mults = node({
  id: "root/Mults",
  name: "Mults",
  value: 38.16,
  kids: [
    node({
      id: "root/Mults/Equip",
      name: "Equip",
      value: 31.8,
      fmt: "x",
      share: 0.9,
      shareMode: "product",
    }),
    node({
      id: "root/Mults/Small",
      name: "Little",
      value: 1.2,
      fmt: "x",
      share: 0.1,
      shareMode: "product",
    }),
  ],
});

test("no short answer above the tree, even with a part that adds and a multiplier: the title keeps its number (spec 009 FR-001)", () => {
  drawPanel(ready(node({ kids: [adds, mults] })));
  expect(lines()).toEqual([]);
  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
    "Drop Rate 1,234x",
  );
});

test.each<[string, FormulaTree, string]>([
  ["waiting", { state: "waiting" }, "Waiting for the game"],
  [
    "calculating",
    { state: "calculating", request: SIDE_REQUEST() },
    "Calculating the breakdown…",
  ],
  [
    "unavailable",
    { state: "unavailable", request: SIDE_REQUEST() },
    "Calculator unavailable. The formulas can't be calculated now.",
  ],
  [
    "diverged",
    { state: "diverged", request: SIDE_REQUEST(), statsText: "1,234x" },
    "Breakdown unavailable",
  ],
])(
  "%s says so, with the Stats number on top and no tree",
  (_name, tree, text) => {
    drawPanel(tree);
    expect(screen.getByText(text)).toBeDefined();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Drop Rate 1,234x",
    );
    expect(screen.queryByRole("tree")).toBe(null);
  },
);

function SIDE_REQUEST() {
  return { type: "number" as const, id: "dropRate", character: 1 };
}

test("a live-game number that is unavailable says why, in the player's words (US12)", () => {
  const id = TREE_CATALOG.find((n) => n.live)?.id ?? "";
  drawPanel(
    {
      state: "unavailable",
      request: { type: "number", id, character: 1 },
      liveMap: true,
    },
    { label: id, text: "", trees: [[id, id]], id },
  );
  expect(screen.getByText(LIVE_MAP_TEXT)).toBeDefined();
  expect(screen.queryByText(/Calculator unavailable/)).toBe(null);
});

test("a live-game number whose calculator failed says the calculator is unavailable, not the live map", () => {
  const id = TREE_CATALOG.find((n) => n.live)?.id ?? "";
  drawPanel(
    { state: "unavailable", request: { type: "number", id, character: 1 } },
    { label: id, text: "", trees: [[id, id]], id },
  );
  expect(screen.getByText(/Calculator unavailable/)).toBeDefined();
  expect(screen.queryByText(LIVE_MAP_TEXT)).toBe(null);
});

test("a tree of another number is not shown: the panel waits for its own", () => {
  drawPanel(
    ready(node(), { request: { type: "number", id: "hp", character: 1 } }),
  );
  expect(screen.queryByRole("tree")).toBe(null);
  expect(screen.getByText("Calculating the breakdown…")).toBeDefined();
});

test("with the game closed the tree says it is the last reading, and an older game version gets one band", () => {
  drawPanel(ready(node(), { stale: true, checkedOnThisGame: false }));
  expect(screen.getByText(/^Game closed · last reading/)).toBeDefined();
  expect(
    screen.getByText(
      "Names and tags were checked on an older game version. Values are live.",
    ),
  ).toBeDefined();
  expect(screen.queryByText(/Same as Stats/)).toBe(null);
});

test("the active character's tree says it is the same as the Stats", () => {
  drawPanel(ready(node()));
  expect(screen.getByText(/Same as Stats/)).toBeDefined();
});
