// @vitest-environment jsdom
// The system panels (spec 008 FR-003, FR-004, FR-033, FR-039, FR-040): a system's screen opening in the game switches the
// window to its panel, without touching the side panel or the focus, and says so once; on top, the numbers the game does
// not show, in closed groups, only the open ones live. Every value is invented.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TREE_CATALOG } from "../shared/index.ts";
import type { GameContext, LiveValues, Stats } from "../shared/index.ts";
import { App } from "./App.tsx";
import { stubCompanion } from "./companion-stub.ts";
import type { CompanionStub } from "./companion-stub.ts";
import { SYSTEM_PANELS } from "./modules/system-panels.ts";
import { SystemTab } from "./SystemPanel.tsx";

const STATS: Stats = {
  state: "ready",
  rows: [{ label: "Drop Rate", text: "1,234x" }],
};
const LIVE: LiveValues = {
  values: { riftStuffGildedStampChance: 0.25 },
  calculatedAt: 1,
  stale: false,
};
const on = (label: string): GameContext => ({
  screen: { world: 1, map: 1, label },
  character: null,
  afk: null,
  names: { map: "Unknown map", afk: "None" },
  updatedAt: 1,
});

let companion: CompanionStub;
let sendContext: (c: GameContext) => void = () => undefined;
let sendPanel: (p: { system: string | null }) => void = () => undefined;
beforeEach(() => {
  companion = stubCompanion();
  companion.onStats.mockImplementation((cb) => {
    cb(STATS);
    return () => undefined;
  });
  companion.onContext.mockImplementation((cb) => {
    sendContext = cb;
    return () => undefined;
  });
  companion.onPanel.mockImplementation((cb) => {
    sendPanel = cb;
    return () => undefined;
  });
});
afterEach(cleanup);

/** One reading of the game: the context, then the panel switch, as the main sends them. */
function gameOn(label: string, system: string | null) {
  act(() => {
    sendContext(on(label));
    sendPanel({ system });
  });
}
const tab = (name: string) => screen.getByRole("tab", { name });
const systems = () =>
  screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
const announced = () => document.querySelector('[aria-live="polite"].sr-only');

async function app() {
  render(<App />);
  fireEvent.click(await screen.findByRole("tab", { name: "Stats" }));
}

test("there is no panel tab before a system's screen opens", async () => {
  await app();
  gameOn("World Map", null);
  expect(screen.queryByRole("tab", { name: "Panel" })).toBe(null);
});

test("a system's screen switches the window to its panel, from any tab (FR-003)", async () => {
  await app();
  gameOn("Stamps", "Stamps");
  expect(tab("Panel").getAttribute("aria-selected")).toBe("true");
  expect(tab("Stats").getAttribute("aria-selected")).toBe("false");
  expect(systems()).toEqual(["Stamps"]);
});

test("a screen that several systems share shows each one's panel", async () => {
  await app();
  gameOn("Items › Skills", "Mining");
  expect(systems()).toEqual(["Mining", "Choppin", "Fishing"]);
});

test("the switch keeps the side panel and its tree (FR-005)", async () => {
  await app();
  fireEvent.click(screen.getByRole("button", { name: "1,234x" }));
  gameOn("Stamps", "Stamps");
  const side = screen.getByRole("complementary", { name: /breakdown/ });
  expect(within(side).getByRole("heading").textContent).toContain("Drop Rate");
  expect(companion.closeFormula).not.toHaveBeenCalled();
  expect(companion.requestFormula).toHaveBeenCalledTimes(1);
});

test("leaving to a screen without a panel keeps the last one (FR-033)", async () => {
  await app();
  gameOn("Stamps", "Stamps");
  gameOn("World Map", null);
  expect(tab("Panel").getAttribute("aria-selected")).toBe("true");
  expect(systems()).toEqual(["Stamps"]);
});

test("the switch does not move the focus (FR-039)", async () => {
  await app();
  fireEvent.click(screen.getByRole("button", { name: "1,234x" }));
  const title = document.activeElement;
  expect(title?.tagName).toBe("H2");
  gameOn("Stamps", "Stamps");
  expect(document.activeElement).toBe(title);

  tab("Stats").focus();
  gameOn("World Map", null);
  gameOn("Bubba", "Bubba");
  expect(document.activeElement).toBe(tab("Stats"));
});

const tabPanel = () => screen.getByRole("tabpanel");

test("a switch that removes the focused number puts the focus on the tab's panel, never on the page (FR-039)", async () => {
  await app();
  screen.getByRole("button", { name: "1,234x" }).focus();
  gameOn("Stamps", "Stamps");
  expect(document.activeElement).not.toBe(document.body);
  expect(document.activeElement).toBe(tabPanel());
  expect(tabPanel().getAttribute("aria-labelledby")).toBe(tab("Panel").id);
  expect(tab("Panel").getAttribute("aria-controls")).toBe(tabPanel().id);

  screen.getByRole("button", { name: "Chances" }).focus();
  gameOn("Stamps › Bribes", "Bribes");
  expect(document.activeElement).not.toBe(document.body);
  expect(document.activeElement).toBe(tabPanel());
});

test("✕ after a switch removed the number that opened the tree puts the focus on the tab's panel (FR-039)", async () => {
  await app();
  fireEvent.click(screen.getByRole("button", { name: "1,234x" }));
  gameOn("Stamps", "Stamps");
  fireEvent.click(screen.getByRole("button", { name: "Close the breakdown" }));
  expect(document.activeElement).not.toBe(document.body);
  expect(document.activeElement).toBe(tabPanel());
});

test("the switch is said once in a polite live region, and again on the next switch (FR-040)", async () => {
  await app();
  expect(announced()?.textContent).toBe("");
  gameOn("Stamps", "Stamps");
  gameOn("Stamps › Combat", "Stamps");
  expect(announced()?.textContent).toBe("Stamps panel");

  fireEvent.click(tab("Stats"));
  gameOn("World Map", null);
  expect(announced()?.textContent).toBe("");
  expect(tab("Stats").getAttribute("aria-selected")).toBe("true");
  gameOn("Stamps", "Stamps");
  expect(announced()?.textContent).toBe("Stamps panel");
  expect(tab("Panel").getAttribute("aria-selected")).toBe("true");
});

// The panel itself (FR-004, FR-034).
const panelOf = (
  system: string,
  stats: Stats | null = STATS,
  live: LiveValues = LIVE,
) => {
  const onOpen = vi.fn();
  render(
    <SystemTab
      modules={SYSTEM_PANELS.filter((m) => m.id === system)}
      ctx={on("Stamps")}
      stats={stats}
      live={live}
      onOpen={onOpen}
    />,
  );
  return onOpen;
};
const groups = () =>
  screen
    .queryAllByRole("button", { expanded: false })
    .map((b) => b.textContent);
const idsOf = (system: string, open: readonly string[] = []) =>
  TREE_CATALOG.filter(
    (n) =>
      n.system === system && (n.notShown === null || open.includes(n.notShown)),
  ).map((n) => n.id);

test("the numbers the game does not show come in closed groups, Costs, Caps, Chances, Rates", () => {
  panelOf("The Hole");
  expect(groups()).toEqual(["Costs", "Caps", "Chances", "Rates"]);
});

test("a panel has only the groups its system has", () => {
  panelOf("Stamps");
  expect(groups()).toEqual(["Chances"]);
});

test("only the open groups' numbers go live, with the system's other numbers", () => {
  panelOf("The Hole");
  expect(companion.formulaValues).toHaveBeenLastCalledWith({
    ids: idsOf("The Hole"),
  });
  fireEvent.click(screen.getByRole("button", { name: "Costs" }));
  expect(companion.formulaValues).toHaveBeenLastCalledWith({
    ids: idsOf("The Hole", ["cost"]),
  });
  fireEvent.click(screen.getByRole("button", { name: "Costs" }));
  expect(companion.formulaValues).toHaveBeenLastCalledWith({
    ids: idsOf("The Hole"),
  });
});

test("tapping the gilded chance opens its tree", () => {
  const onOpen = panelOf("Stamps");
  fireEvent.click(screen.getByRole("button", { name: "Chances" }));
  fireEvent.click(screen.getByRole("button", { name: "0.25" }));
  expect(onOpen).toHaveBeenCalledWith(
    expect.objectContaining({ id: "riftStuffGildedStampChance" }),
    expect.any(HTMLButtonElement),
  );
});

test("before the first reading the panel waits, and asks for no values (FR-034)", () => {
  panelOf("Stamps", null);
  expect(screen.getByText("Waiting for the game")).toBeDefined();
  expect(companion.formulaValues).toHaveBeenLastCalledWith({ ids: [] });
});

test("with the game closed the panel says when its values were read (FR-022)", () => {
  panelOf("Stamps", STATS, { ...LIVE, stale: true, calculatedAt: Date.now() });
  expect(screen.getByText("last reading 0 s ago")).toBeDefined();
});
