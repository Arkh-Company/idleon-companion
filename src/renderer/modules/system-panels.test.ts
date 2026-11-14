// The system panels (spec 008 FR-003, FR-033): one module per catalog system with a screen, shown while that screen,
// or one of its tabs, is open in the game; the deepest screen of the catalog wins.
import { expect, test } from "vitest";
import { TREE_CATALOG } from "../../shared/index.ts";
import type { GameContext } from "../../shared/index.ts";
import { SYSTEM_PANELS } from "./system-panels.ts";

const on = (label: string): GameContext => ({
  screen: { world: 1, map: 1, label },
  character: null,
  afk: null,
  names: { map: "Unknown map", afk: "None" },
  updatedAt: 1,
});
const shownOn = (label: string) =>
  SYSTEM_PANELS.filter((m) => m.matches(on(label))).map((m) => m.id);

test("one module per catalog system with a screen, in the catalog's order", () => {
  const systems = [
    ...new Set(TREE_CATALOG.filter((n) => n.screen).map((n) => n.system)),
  ];
  expect(SYSTEM_PANELS.map((m) => m.id)).toEqual(systems);
  expect(SYSTEM_PANELS.map((m) => m.title)).toEqual(systems);
});

test("each module matches each screen of its system, and that screen's tabs", () => {
  for (const n of TREE_CATALOG.filter((x) => x.screen !== null)) {
    const screen = n.screen ?? "";
    expect(shownOn(screen)).toContain(n.system);
    expect(shownOn(`${screen} › Unknown tab`)).toContain(n.system);
  }
  expect(shownOn("Stamps › Combat")).toEqual(["Stamps"]);
});

test("the deepest screen of the catalog wins; systems that share it are all shown", () => {
  expect(shownOn("Stamps › Bribes")).toEqual(["Bribes"]);
  expect(shownOn("Items › Skills")).toEqual(["Mining", "Choppin", "Fishing"]);
  expect(shownOn("Items › Skills › Catching")).toEqual(["Catching"]);
  expect(shownOn("Items › Info")).toEqual(["Combat"]);
});

test("a screen without a panel, or a name that only starts like one, matches none", () => {
  for (const label of ["World Map", "Unknown screen", "None", "Stampsy"])
    expect(shownOn(label)).toEqual([]);
});

test("a system without a screen has no panel: only the Formulas tab lists it", () => {
  const ids = SYSTEM_PANELS.map((m) => m.id);
  for (const system of ["Stats", "Equinox", "Dungeons"]) {
    expect(TREE_CATALOG.some((n) => n.system === system)).toBe(true);
    expect(ids).not.toContain(system);
  }
});
