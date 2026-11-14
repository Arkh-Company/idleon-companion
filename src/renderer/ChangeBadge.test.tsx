// @vitest-environment jsdom
// "Game changed · Refresh" in the window (spec 008 FR-024, FR-040; design.md C1, C11, §3.8): the band over the tree with
// the number the game shows now, Refresh now, "was …" on the root and on each row that changed, "changed inside" on a
// closed branch, and one sentence for the screen reader each time. Every value and name is invented.
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
import type { FormulaTree, LiveValues, Stats } from "../shared/index.ts";
import { AnswerHeader } from "./AnswerHeader.tsx";
import { App } from "./App.tsx";
import { ChangeBadge } from "./ChangeBadge.tsx";
import { stubCompanion } from "./companion-stub.ts";
import type { CompanionStub } from "./companion-stub.ts";
import { node, ready } from "./formula-fixture.ts";
import { FormulaTree as TreeView } from "./FormulaTree.tsx";

afterEach(cleanup);

const live = (dropRate: number | null, calculatedAt = 2_000): LiveValues => ({
  values: { dropRate },
  calculatedAt,
  stale: false,
});
const band = () => document.querySelector(".band p");

test("the band says what the game shows now and offers Refresh now", () => {
  const onRefresh = vi.fn();
  render(
    <ChangeBadge
      tree={ready(node(), { gameChanged: true })}
      live={live(2_000.7)}
      onRefresh={onRefresh}
    />,
  );
  expect(band()?.textContent).toBe(
    "The game now shows 2,000x. Refresh to see what changed.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Refresh now" }));
  expect(onRefresh).toHaveBeenCalledOnce();
});

test.each([
  ["nothing changed", { gameChanged: false }],
  ["the game is closed", { gameChanged: true, stale: true }],
])("no band when %s", (_name, over) => {
  render(
    <ChangeBadge
      tree={ready(node(), over)}
      live={live(9)}
      onRefresh={vi.fn()}
    />,
  );
  expect(band()).toBe(null);
  expect(screen.queryByRole("button", { name: "Refresh now" })).toBe(null);
});

test.each([
  [1_100, "was 1,100x · up 12.2%"],
  [1_500, "was 1,500x · down 17.7%"],
  [1_234.5, "was 1,234x"],
])("after Refresh the root says what it was: %s", (was, text) => {
  render(
    <ChangeBadge
      tree={ready(node({ value: 1_234.5, was }))}
      live={null}
      onRefresh={vi.fn()}
    />,
  );
  expect(screen.getByText(/^was /).textContent).toBe(text);
});

test("a row that changed shows `was …` in text, and its name says it too (never by color alone)", () => {
  const sword = node({
    id: "root/Sword",
    name: "Sword",
    value: 6,
    fmt: "+",
    was: 4,
  });
  render(<TreeView tree={ready(node({ kids: [sword] }))} onExpand={vi.fn()} />);
  const row = screen.getByRole("treeitem", { name: /^Sword/ });
  expect(row.getAttribute("aria-label")).toContain("was plus 4");
  expect(row.querySelector(".was")?.textContent).toBe("was +4");
  expect(row.querySelector(".row")?.classList.contains("changed")).toBe(true);
});

test("a closed branch with a change inside says `changed inside`; open, it does not", () => {
  const sword = node({
    id: "root/Gear/Sword",
    name: "Sword",
    value: 6,
    was: 4,
  });
  const gear = node({ id: "root/Gear", name: "Gear", value: 6, kids: [sword] });
  render(<TreeView tree={ready(node({ kids: [gear] }))} onExpand={vi.fn()} />);
  const row = screen.getByRole("treeitem", { name: /^Gear/ });
  expect(row.getAttribute("aria-label")).toContain("changed inside");
  expect(row.querySelector(".was")?.textContent).toBe("changed inside");
  fireEvent.click(screen.getByText("Gear"));
  expect(row.getAttribute("aria-label")).not.toContain("changed inside");
});

test("the changed row fades, and stays still with reduced motion (design.md C11)", () => {
  const css = readFileSync(join(import.meta.dirname, "styles.css"), "utf8");
  expect(css).toMatch(/\.row\.changed \{[^}]*animation: changed var\(--fade\)/);
  expect(css).toMatch(
    /prefers-reduced-motion: reduce\) \{\s*\.row\.changed \{[^}]*animation: none;[^}]*background: var\(--changed\)/,
  );
});

// The panel inside the app: Refresh asks again, the focus goes to the title, the live region speaks once each time.
let companion: CompanionStub;
let sendTree: (t: FormulaTree) => void = () => undefined;
let sendLive: (v: LiveValues) => void = () => undefined;
const STATS: Stats = {
  state: "ready",
  rows: [{ label: "Drop Rate", text: "1,234x" }],
};
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
  companion.onLiveValues.mockImplementation((cb) => {
    sendLive = cb;
    return () => undefined;
  });
});
const said = () => document.querySelector('[aria-live="polite"]')?.textContent;

async function openDrop() {
  render(<App />);
  fireEvent.click(await screen.findByRole("tab", { name: "Stats" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "1,234x" }));
    await Promise.resolve();
  });
}

test("the band goes once to the page's live region; Refresh now asks again and the focus goes to the title", async () => {
  await openDrop();
  const tree = ready(node({ value: 1_234.5 }), { gameChanged: true });
  act(() => {
    sendLive(live(2_000));
    sendTree(tree);
  });
  expect(said()).toBe(
    "The game now shows 2,000x. Refresh to see what changed.",
  );
  expect(document.querySelectorAll("[aria-live]")).toHaveLength(1);
  // A newer live value moves the band's number on screen, never a second sentence.
  act(() => {
    sendLive(live(2_100, 3_000));
  });
  expect(band()?.textContent).toContain("2,100x");
  expect(said()).toBe(
    "The game now shows 2,000x. Refresh to see what changed.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Refresh now" }));
  expect(companion.requestFormula).toHaveBeenLastCalledWith({ id: "dropRate" });
  expect(document.activeElement?.tagName).toBe("H2");

  const sword = node({ id: "root/Sword", name: "Sword", value: 6, was: 4 });
  act(() => {
    sendTree({ state: "calculating", request: tree.request });
    sendTree(
      ready(node({ value: 2_000, was: 1_234.5, kids: [sword] }), {
        rootText: "2,000x",
        calculatedAt: 2_000,
      }),
    );
  });
  expect(said()).toBe("Drop Rate updated: 2,000x, up 62%. 1 part changed.");
});

test("with the band, the header no longer says Same as Stats (design.md C1)", () => {
  render(<AnswerHeader tree={ready(node(), { gameChanged: true })} />);
  expect(screen.queryByText("Same as Stats")).toBe(null);
});
