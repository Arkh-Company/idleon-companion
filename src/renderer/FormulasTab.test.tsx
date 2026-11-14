// @vitest-environment jsdom
// The Formulas tab (spec 008 FR-002, FR-008, FR-034, FR-038): every catalog number in closed groups, in the catalog's
// order; an open group asks the main for its live values only, and a tapped value opens the same tree as the Stats.
// Every value is invented.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { TREE_CATALOG } from "../shared/index.ts";
import type { LiveValues, Stats } from "../shared/index.ts";
import { App } from "./App.tsx";
import { stubCompanion } from "./companion-stub.ts";
import type { CompanionStub } from "./companion-stub.ts";
import { FormulasTab } from "./FormulasTab.tsx";

const STATS: Stats = { state: "ready", rows: [{ label: "HP", text: "500" }] };
const SYSTEMS = [...new Set(TREE_CATALOG.map((n) => n.system))];
const idsOf = (system: string) =>
  TREE_CATALOG.filter((n) => n.system === system).map((n) => n.id);
const OTHER = SYSTEMS[1] ?? "";
const LIVE: LiveValues = {
  values: { dropRate: 6.5, hp: 1_234.2, damageMax: null },
  calculatedAt: 1,
  stale: false,
};

let companion: CompanionStub;
beforeEach(() => {
  companion = stubCompanion();
});
afterEach(cleanup);

const group = (name: string) => screen.getByRole("button", { name });
const tab = (live: LiveValues | null = LIVE, stats: Stats | null = STATS) =>
  render(<FormulasTab stats={stats} live={live} onOpen={() => undefined} />);

test("the groups follow the catalog's order, all closed", () => {
  tab();
  const groups = screen.getAllByRole("button", { expanded: false });
  expect(groups.map((b) => b.textContent)).toEqual(SYSTEMS);
  expect(screen.queryAllByRole("rowheader")).toEqual([]);
});

test("opening a group asks for its live values only; closing it asks for none", () => {
  tab();
  fireEvent.click(group(OTHER));
  expect(group(OTHER).getAttribute("aria-expanded")).toBe("true");
  expect(companion.formulaValues).toHaveBeenLastCalledWith({
    ids: idsOf(OTHER),
  });
  expect(screen.getAllByRole("rowheader")).toHaveLength(idsOf(OTHER).length);
  fireEvent.click(group(OTHER));
  expect(companion.formulaValues).toHaveBeenLastCalledWith({ ids: [] });
});

test("leaving the tab asks for no values", () => {
  const { unmount } = tab();
  fireEvent.click(group(OTHER));
  unmount();
  expect(companion.formulaValues).toHaveBeenLastCalledWith({ ids: [] });
});

test("the Stats numbers show the Stats' text; one unavailable or not calculated yet says so", () => {
  tab();
  fireEvent.click(group("Stats"));
  expect(screen.getByRole("row", { name: "Drop Rate 6x" })).toBeDefined();
  expect(screen.getByRole("row", { name: "HP 1,235" })).toBeDefined();
  expect(
    screen.getByRole("row", { name: "Max damage unavailable" }),
  ).toBeDefined();
  expect(screen.getByRole("row", { name: "MP calculating" })).toBeDefined();
});

test.each<[string, Stats | null]>([
  ["no reading", null],
  ["no character", { state: "none" }],
  ["the first calculation", { state: "calculating" }],
])("%s shows Waiting for the game and no number (FR-034)", (_name, stats) => {
  tab(LIVE, stats);
  expect(screen.getByText("Waiting for the game")).toBeDefined();
  expect(screen.queryAllByRole("button")).toEqual([]);
});

test.each<[string, Stats | null]>([
  ["waiting", null],
  ["ready", STATS],
])("%s has no field to fill in: no search", (_name, stats) => {
  const { container } = tab(LIVE, stats);
  fireEvent.click(screen.queryAllByRole("button")[0] ?? document.body);
  expect(container.querySelector("input, textarea, select")).toBe(null);
});

test("the Formulas tab opens a value's tree in the side panel, as the Stats does", async () => {
  companion.onStats.mockImplementation((cb) => {
    cb(STATS);
    return () => undefined;
  });
  companion.onLiveValues.mockImplementation((cb) => {
    cb(LIVE);
    return () => undefined;
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("tab", { name: "Formulas" }));
  fireEvent.click(group("Stats"));
  fireEvent.click(screen.getByRole("button", { name: "6x" }));
  expect(companion.requestFormula).toHaveBeenCalledExactlyOnceWith({
    id: "dropRate",
  });
  expect(companion.setSidePanel).toHaveBeenCalledWith({ open: true });
  expect(
    screen.getByRole("complementary", { name: "Drop Rate breakdown" }),
  ).toBeDefined();
});

test("at 210 px CSS a long catalog id wraps instead of scrolling sideways (FR-031)", () => {
  const { container } = tab();
  fireEvent.click(group(OTHER));
  expect(container.querySelector("table")?.classList.contains("formulas")).toBe(
    true,
  );
  const css = readFileSync(join(import.meta.dirname, "styles.css"), "utf8");
  expect(css).toMatch(/.formulas th {[^}]*overflow-wrap: anywhere/);
});
