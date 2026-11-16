// @vitest-environment jsdom
// The patch radar's band (spec 008 FR-029, FR-031, FR-035, FR-039, FR-041; T049): at the top, under the status bar, on
// every tab, after a game update; "Show" lists each tree that changed, up to 5 named changes each; Close puts it out.
// An unreadable shapes file is said on it, and once to a screen reader. Every part name is invented.
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
import { TREE_CATALOG } from "../shared/index.ts";
import type { RadarUpdate } from "../shared/index.ts";
import { App } from "./App.tsx";
import { stubCompanion } from "./companion-stub.ts";
import { nameOf } from "./FormulasTab.tsx";

const [A = "", B = "", C = ""] = TREE_CATALOG.map((n) => n.id);
const RESET = "Saved tree shapes could not be read and were reset";
const UPDATED: NonNullable<RadarUpdate> = {
  changed: [
    {
      catalogId: A,
      added: ["Shield", "Ring", "Axe", "Bow"],
      removed: ["Sword", "Club"],
      renamed: [["Card", "Card bonus"]],
    },
    { catalogId: B, added: [], removed: ["Talent"], renamed: [] },
    { catalogId: C, added: ["Star"], removed: [], renamed: [] },
  ],
  checking: false,
  warning: null,
};

let companion: ReturnType<typeof stubCompanion>;
let sendRadar: (r: RadarUpdate) => void = () => undefined;
beforeEach(() => {
  companion = stubCompanion();
  companion.onRadar.mockImplementation((cb) => {
    sendRadar = cb;
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
const radar = (r: RadarUpdate) => {
  act(() => {
    sendRadar(r);
  });
};
const band = () => screen.queryByRole("region", { name: "Game update" });
const inBand = () => {
  const b = band();
  if (!b) throw new Error("no patch band");
  return within(b);
};
/** The text a sighted player reads: without what only a screen reader gets. */
function shown(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  for (const sr of copy.querySelectorAll(".sr-only")) sr.remove();
  return copy.textContent.replace(/\s+/g, " ").trim();
}
const said = () =>
  document.querySelector('.main-panel > [aria-live="polite"]')?.textContent;

test("no update, no band; a game update says how many trees changed (FR-035)", async () => {
  await app();
  expect(band()).toBe(null);
  radar(UPDATED);
  const first = band()?.querySelector("p");
  expect(first && shown(first)).toBe("Game updated: 3 trees changed · Show");
  radar({ ...UPDATED, changed: UPDATED.changed.slice(0, 1) });
  expect(shown(band()?.querySelector("p") ?? document.body)).toBe(
    "Game updated: 1 tree changed · Show",
  );
  radar(null);
  expect(band()).toBe(null);
});

test("while old trees are still compared, the count says so far (FR-035)", async () => {
  await app();
  radar({ ...UPDATED, checking: true });
  expect(shown(band()?.querySelector("p") ?? document.body)).toBe(
    "Game updated: 3 trees changed so far · Show",
  );
});

test("a band that comes back starts with its list closed", async () => {
  await app();
  radar(UPDATED);
  fireEvent.click(inBand().getByRole("button", { name: "Show what changed" }));
  radar(null);
  radar(UPDATED);
  expect(
    inBand()
      .getByRole("button", { name: "Show what changed" })
      .getAttribute("aria-expanded"),
  ).toBe("false");
  expect(inBand().queryByRole("list")).toBe(null);
});

test("the band is at the top, before the pins and the farm, and stays on every tab", async () => {
  await app();
  radar(UPDATED);
  const farm = screen.getByRole("region", { name: "Farm" });
  expect(band()?.compareDocumentPosition(farm) ?? 0).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  for (const name of ["Stats", "Formulas", "Screen map"]) {
    fireEvent.click(screen.getByRole("tab", { name }));
    expect(band()).not.toBe(null);
  }
});

test("Show lists each tree that changed, up to 5 named changes each, and how many more", async () => {
  await app();
  radar(UPDATED);
  const show = inBand().getByRole("button", { name: "Show what changed" });
  expect(show.getAttribute("aria-expanded")).toBe("false");
  expect(inBand().queryByRole("list")).toBe(null);
  fireEvent.click(show);
  expect(show.getAttribute("aria-expanded")).toBe("true");
  const trees = inBand().getAllByRole("list")[0]?.children ?? [];
  expect([...trees].map((li) => li.firstChild?.textContent)).toEqual([
    nameOf(A),
    nameOf(B),
    nameOf(C),
  ]);
  const first = trees[0];
  if (!first) throw new Error("no tree");
  expect(
    within(first as HTMLElement)
      .getAllByRole("listitem")
      .map((li) => shown(li)),
  ).toEqual([
    "New: Shield",
    "New: Ring",
    "New: Axe",
    "New: Bow",
    "Gone: Sword",
    "2 more changes",
  ]);
  fireEvent.click(show);
  expect(inBand().queryByRole("list")).toBe(null);
});

test("a renamed part reads as words", async () => {
  await app();
  radar({
    changed: [
      {
        catalogId: A,
        added: [],
        removed: [],
        renamed: [["Card", "Card bonus"]],
      },
    ],
    checking: false,
    warning: null,
  });
  fireEvent.click(inBand().getByRole("button", { name: "Show what changed" }));
  expect(
    inBand()
      .getAllByRole("listitem")
      .map((li) => shown(li))
      .at(-1),
  ).toBe("Renamed: Card, now Card bonus");
});

test("Close tells the main, puts the band out and gives the focus to the tab's content (FR-039)", async () => {
  await app();
  radar(UPDATED);
  const close = inBand().getByRole("button", { name: "Close the game update" });
  close.focus();
  fireEvent.click(close);
  expect(companion.dismissRadar).toHaveBeenCalledOnce();
  expect(band()).toBe(null);
  expect(document.activeElement?.id).toBe("tab-content");
});

test("an unreadable shapes file is said on the band, and once to a screen reader (FR-041)", async () => {
  await app();
  radar({ changed: [], checking: false, warning: RESET });
  expect(
    [...(band()?.querySelectorAll("p") ?? [])].map((p) => shown(p)),
  ).toEqual([RESET]);
  expect(inBand().queryByRole("button", { name: /Show/ })).toBe(null);
  expect(said()).toBe(RESET);
  expect(band()?.querySelector("[aria-live]")).toBe(null);
});

test("each update carries the warning, and it is said only at the first (FR-041)", async () => {
  await app();
  radar({ changed: [], checking: false, warning: RESET });
  const live = document.querySelector('.main-panel > [aria-live="polite"]');
  if (!live) throw new Error("no live region");
  const watch = new MutationObserver(() => undefined);
  watch.observe(live, { childList: true, characterData: true, subtree: true });
  radar({ ...UPDATED, warning: RESET });
  expect(watch.takeRecords()).toEqual([]);
  watch.disconnect();
  expect(said()).toBe(RESET);
});

test("the count is never announced, and the dot is hidden from a screen reader", async () => {
  await app();
  radar(UPDATED);
  expect(said()).toBe("");
  for (const h of band()?.querySelectorAll('[aria-hidden="true"]') ?? [])
    expect(h.textContent).toBe("·");
  expect(band()?.querySelector("[aria-live]")).toBe(null);
});

test("the band fits 210 px CSS without sideways scroll (FR-031)", async () => {
  await app();
  radar(UPDATED);
  expect(band()?.querySelector("[style]")).toBe(null);
  const css = readFileSync(join(import.meta.dirname, "styles.css"), "utf8");
  expect(css).toMatch(/\.patch \{[^}]*overflow-wrap: anywhere/);
});
