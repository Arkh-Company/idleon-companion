// @vitest-environment jsdom
// The honesty of a tree (spec 008 FR-012, FR-016, FR-018; design.md C7, C18): every case that does not close has its tag
// in text, read aloud with no loose symbol, and its phrase in the row's detail; a game bug keeps the game's value; one
// band says the names and tags come from another game version. Every value and name is invented.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { TreeNode } from "../shared/index.ts";
import { node, ready } from "./formula-fixture.ts";
import { FormulaTree } from "./FormulaTree.tsx";
import { VersionBand } from "./VersionBand.tsx";

afterEach(cleanup);

const draw = (kids: TreeNode[], over: Parameters<typeof ready>[1] = {}) =>
  render(<FormulaTree tree={ready(node({ kids }), over)} onExpand={vi.fn()} />);
const item = (name: RegExp) => screen.getByRole("treeitem", { name });
const open = (name: RegExp) => {
  item(name).focus();
  fireEvent.keyDown(item(name), { key: "ArrowRight" });
};

/** id of the FR-012 table, the row's own fields, the tag on screen, the tag read aloud, the phrase of its detail. */
const CASES: [string, Partial<TreeNode>, string, string, string | null][] = [
  ["unknown", { flags: { unknown: true } }, "?", "unknown type", null],
  [
    "unnamed",
    { flags: { unnamed: true } },
    "no name yet",
    "no name yet",
    "No player name yet for this game value.",
  ],
  [
    "unavailable",
    { value: null, flags: { unavailable: true } },
    "unavailable",
    "unavailable",
    "Could not be calculated with this reading. The rest is still right.",
  ],
  [
    "fromCache",
    { flags: { fromCache: true } },
    "saved by the game",
    "saved by the game",
    "The game had this result saved. Open it to see how the game worked it out.",
  ],
  [
    "fromGame",
    { flags: { fromGame: true } },
    "from the game",
    "from the game",
    "Read straight from the running game. Nothing to open below it.",
  ],
  [
    "runtime",
    { flags: { runtime: true } },
    "changes while you play",
    "changes while you play",
    "The game changes this value while it runs.",
  ],
  [
    "truncated",
    { flags: { truncated: true } },
    "stopped here",
    "stopped here",
    "This part is too big to show whole here.",
  ],
  [
    "overTheCap",
    { cap: "overTheCap" },
    "over the cap",
    "over the cap",
    "A limit decides this number right now, so this part changes nothing today.",
  ],
  ["notReached", { cap: "notReached" }, "not reached", "not reached", null],
  [
    "productZero",
    { value: 0, share: 0, shareMode: "productZero" },
    "zeroes the total",
    "zeroes the total",
    null,
  ],
  [
    "progress",
    { flags: { progress: true } },
    "repeated step",
    "repeated step",
    null,
  ],
  [
    "gameBug",
    { flags: { gameBug: "inventedTwice" } },
    "game bug: counted twice",
    "game bug, counted twice",
    "The game itself counts this twice. The app shows what the game calculates.",
  ],
];

test.each(CASES)(
  "%s: the row shows its tag, reads it aloud with no loose symbol and explains it (FR-012)",
  (_id, fields, text, spoken, phrase) => {
    // No leaf, no math and no game call: the phrase alone is what opens the row.
    draw([node({ id: "root/Kid", name: "Kid", value: 3, ...fields })]);
    const row = item(/^Kid,/);
    expect(row.querySelector(":scope > .row")?.textContent).toContain(text);
    const label = row.getAttribute("aria-label") ?? "";
    expect(label).toContain(spoken);
    expect(label.split(", ")).not.toContain("?");
    expect(label).not.toContain(":");
    if (phrase === null) return;
    open(/^Kid,/);
    expect(screen.getByRole("treeitem", { name: phrase })).toBeDefined();
  },
);

test("a known game bug shows the value the game calculates, on both rows that count it, each with the tag (FR-016)", () => {
  const twice = (n: number) =>
    node({
      id: `root/Source${n > 1 ? `#${String(n)}` : ""}`,
      name: "Source",
      value: 3,
      fmt: "+",
      flags: { gameBug: "inventedTwice" },
    });
  draw([twice(1), twice(2)]);
  const rows = screen.getAllByRole("treeitem", { name: /^Source,/ });
  expect(rows).toHaveLength(2);
  for (const r of rows) {
    const line = r.querySelector(":scope > .row")?.textContent ?? "";
    expect(line).toContain("+3");
    expect(line).toContain("game bug: counted twice");
  }
});

test("rules of another game version show one band, the values stay and no row is marked (FR-018)", () => {
  const BAND =
    "Names and tags were checked on an older game version. Values are live.";
  const tree = ready(node({ kids: [node({ id: "root/Kid", name: "Kid" })] }), {
    checkedOnThisGame: false,
  });
  render(
    <>
      <VersionBand tree={tree} />
      <FormulaTree tree={tree} onExpand={vi.fn()} />
    </>,
  );
  expect(screen.getAllByText(BAND)).toHaveLength(1);
  expect(item(/^Drop Rate,/).textContent).toContain("1,234x");
  for (const r of screen.getAllByRole("treeitem"))
    expect(r.getAttribute("aria-label")).not.toMatch(/older|version/);
});

test("the game the rules were checked on, or a tree not ready, has no band", () => {
  const { container, rerender } = render(<VersionBand tree={ready(node())} />);
  expect(container.textContent).toBe("");
  rerender(<VersionBand tree={{ state: "waiting" }} />);
  expect(container.textContent).toBe("");
});
