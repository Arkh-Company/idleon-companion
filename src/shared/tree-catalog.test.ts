// The catalog of numbers (T007, data-model.md): the bench's audited trees, in the game's order (FR-038), with only
// identifiers and the app's own screen names (FR-032).
import { expect, test } from "vitest";
import { SCREEN_CATALOG } from "./screens/index.ts";
import { NUMBER_IDS } from "./state.ts";
import { isCatalogId, TREE_CATALOG } from "./tree-catalog.ts";

const ids = TREE_CATALOG.map((n) => n.id);

test("the catalog holds the bench's audited trees, each id once", () => {
  expect(TREE_CATALOG.length).toBe(597);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_]+$/);
});

test("the Stats numbers open the catalog, as their own system", () => {
  expect(ids.slice(0, NUMBER_IDS.length).sort()).toEqual(
    [...NUMBER_IDS].sort(),
  );
  expect(
    TREE_CATALOG.filter((n) => n.system === "Stats").map((n) => n.id),
  ).toEqual(ids.slice(0, NUMBER_IDS.length));
});

test("each field has one of its allowed values", () => {
  const screens = new Set(
    [...SCREEN_CATALOG.overlays, ...SCREEN_CATALOG.screens].map((r) => r.name),
  );
  for (const n of TREE_CATALOG) {
    expect([null, "cost", "cap", "chance", "rate"]).toContain(n.notShown);
    expect(typeof n.live).toBe("boolean");
    expect(n.system).toMatch(/^[\w' -]+$/);
    if (n.screen !== null) expect(screens).toContain(n.screen);
  }
});

test("the live-game numbers are in the catalog, marked live", () => {
  expect(TREE_CATALOG.filter((n) => n.live).length).toBe(35);
});

test("isCatalogId takes only an own id of the catalog", () => {
  expect(isCatalogId("dropRate")).toBe(true);
  expect(isCatalogId(ids.at(-1))).toBe(true);
  for (const id of ["__proto__", "constructor", "", 1, null])
    expect(isCatalogId(id)).toBe(false);
});
