// @vitest-environment jsdom
// The tree's view in the side panel (spec 009 FR-001, FR-002, FR-013, FR-014, FR-015, NFR-004): no summary above the
// tree, the share and "Changes" toggles (off by default, kept in settings.json, reached by keyboard and read with their
// state), the arrows against the tree frozen at the click, the tree live with no Refresh, and a tree rebuilt by itself
// that keeps open what was open. Replaces the 008's "Game changed · Refresh" and "was …" (ChangeBadge). Every value and
// name is invented.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { FormulaTree, TreeNode, ViewPrefs } from "../shared/index.ts";
import { stubCompanion } from "./companion-stub.ts";
import type { CompanionStub } from "./companion-stub.ts";
import { node, ready } from "./formula-fixture.ts";
import { SidePanel } from "./SidePanel.tsx";

afterEach(cleanup);
let companion: CompanionStub;
beforeEach(() => {
  companion = stubCompanion();
});

const POOL = "root/Additive pool";
const ALCHEMY = `${POOL}/⚗️ Alchemy`;
const part = (
  name: string,
  value: number,
  share: number,
  kids: TreeNode["kids"] = [],
): TreeNode =>
  node({
    id: `${ALCHEMY}/${name}`,
    pieceKey: `[1,"${name}"]`,
    name,
    value,
    fmt: "%",
    share,
    shareMode: "sum",
    kids,
  });
/** A pool 1 + (Alchemy) ÷ 100, the group Alchemy = Sword + Ring (Ring opens lazily), and `more` rows in the pool. */
const tree = (
  sword: number,
  over: Partial<Extract<FormulaTree, { state: "ready" }>> = {},
  more: TreeNode[] = [],
) =>
  ready(
    node({
      kids: [
        node({
          id: POOL,
          name: "Additive pool",
          value: 1 + (sword + 30) / 100,
          fmt: "x",
          role: "pool",
          combine: "onePlusPercent",
          poolKind: "additive",
          share: 1,
          shareMode: "product",
          flags: { closed: true },
          kids: [
            node({
              id: ALCHEMY,
              name: "⚗️ Alchemy",
              value: sword + 30,
              fmt: "%",
              role: "system",
              combine: "sum",
              poolKind: null,
              share: 0.9,
              shareMode: "sum",
              flags: { closed: true },
              kids: [
                part("Sword", sword, 0.26),
                part("Ring", 30, 0.74, "lazy"),
              ],
            }),
            ...more,
          ],
        }),
      ],
    }),
    over,
  );
const SIDE = {
  label: "Drop Rate",
  text: "1,234x",
  trees: [["dropRate", "Drop Rate"]] as const,
  id: "dropRate",
};

async function draw(first: FormulaTree, view?: ViewPrefs) {
  if (view) companion.getView.mockResolvedValue(view);
  const onExpand = vi.fn<(id: string) => void>();
  const panel = (t: FormulaTree) => (
    <SidePanel
      side={SIDE}
      tree={t}
      onClose={vi.fn()}
      onPick={vi.fn()}
      onExpand={onExpand}
      announce={vi.fn()}
      pins={[]}
      onPin={vi.fn()}
      onOpenNumber={vi.fn()}
      characters={null}
      onCharacter={vi.fn()}
    />
  );
  let rerender: (ui: ReactNode) => void = () => undefined;
  await act(async () => {
    rerender = render(panel(first)).rerender;
    await Promise.resolve();
  });
  return {
    onExpand,
    update: (t: FormulaTree) => {
      act(() => {
        rerender(panel(t));
      });
    },
  };
}
const toggle = (name: string) => screen.getByRole("button", { name });
const item = (name: RegExp) => screen.getByRole("treeitem", { name });
const open = (name: RegExp) => {
  fireEvent.click(item(name).querySelector(".row") ?? document.body);
};
const label = (name: RegExp) => item(name).getAttribute("aria-label") ?? "";
const arrow = (name: RegExp) =>
  item(name).querySelector(":scope > .row > .arrow")?.textContent ?? null;

test("no summary above the tree, and both toggles off by default, read with their state (FR-001, NFR-004)", async () => {
  await draw(tree(20));
  expect(document.querySelector(".answer .short")).toBe(null);
  expect(toggle("Changes").getAttribute("aria-pressed")).toBe("false");
  expect(toggle("Share").getAttribute("aria-pressed")).toBe("false");
});

test("the toggles start as saved, and each tap saves both states (SEC-005)", async () => {
  await draw(tree(20), { changes: false, share: true });
  expect(toggle("Share").getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(toggle("Changes"));
  expect(toggle("Changes").getAttribute("aria-pressed")).toBe("true");
  expect(companion.setView).toHaveBeenLastCalledWith({
    changes: true,
    share: true,
  });
});

test("both toggles are reached by keyboard: buttons in the Tab order", async () => {
  await draw(tree(20));
  for (const name of ["Changes", "Share"]) {
    const b = toggle(name);
    expect(b.tagName).toBe("BUTTON");
    expect(b.tabIndex).toBe(0);
    b.focus();
    expect(document.activeElement).toBe(b);
  }
});

test("the share is hidden by default; on, each row shows only its number, read aloud with the row (FR-014)", async () => {
  await draw(tree(20));
  open(/^Additive pool/);
  open(/^⚗️ Alchemy/);
  expect(item(/^Sword/).textContent).not.toContain("26%");
  expect(label(/^Sword/)).not.toContain("26%");
  fireEvent.click(toggle("Share"));
  expect(item(/^Sword/).querySelector(".share")?.textContent).toBe("26%");
  expect(label(/^Sword/)).toBe("Sword, plus 20%, 26%");
  expect(document.querySelector("meter")).toBe(null);
});

test("a pool and a group are read with their name, value, share when on, and N sources (FR-002)", async () => {
  await draw(tree(20), { changes: false, share: true });
  expect(label(/^Additive pool/)).toBe(
    "Additive pool, times 1.5, 100%, 1 source",
  );
  open(/^Additive pool/);
  expect(label(/^⚗️ Alchemy/)).toBe("⚗️ Alchemy, plus 50%, 90%, 2 sources");
});

test("Changes off shows no mark of change when a value changes", async () => {
  const { update } = await draw(tree(20));
  update(tree(30));
  expect(document.querySelector(".arrow")).toBe(null);
  expect(document.querySelector(".was")).toBe(null);
});

test("the band is gone: a live value updates the row and its group and pool, with no button (FR-015)", async () => {
  const { update } = await draw(tree(20));
  open(/^Additive pool/);
  open(/^⚗️ Alchemy/);
  // The main writes the part's live value; the group and the pool are rebuilt from it in the window.
  update(withSword(tree(20), 30));
  expect(item(/^Sword/).textContent).toContain("+30%");
  expect(item(/^⚗️ Alchemy/).textContent).toContain("+60%");
  expect(item(/^Additive pool/).textContent).toContain("×1.6");
  expect(screen.queryByRole("button", { name: /Refresh/ })).toBe(null);
  expect(document.querySelector(".band")).toBe(null);
});

/** The tree the main sends after a live value: only the part's value changes, the groups keep their built values. */
function withSword(t: ReturnType<typeof tree>, value: number) {
  const copy = structuredClone(t);
  const pool = Array.isArray(copy.root.kids) ? copy.root.kids[0] : undefined;
  const alchemy = Array.isArray(pool?.kids) ? pool.kids[0] : undefined;
  const sword = Array.isArray(alchemy?.kids) ? alchemy.kids[0] : undefined;
  if (sword) sword.value = value;
  return copy;
}

test("Changes on, live: the tree frozen at the click; a change shows an arrow in text and in the reader's label on the part, its group and its pool, closed or open (FR-013)", async () => {
  const { update } = await draw(tree(20));
  fireEvent.click(toggle("Changes"));
  update(withSword(tree(20), 30));
  // Closed, the pool says its own change.
  expect(arrow(/^Additive pool/)).toBe("▲ +0.1");
  expect(label(/^Additive pool/)).toContain("up 0.1");
  open(/^Additive pool/);
  expect(arrow(/^⚗️ Alchemy/)).toBe("▲ +10%");
  open(/^⚗️ Alchemy/);
  expect(arrow(/^Sword/)).toBe("▲ +10%");
  expect(label(/^Sword/)).toContain("up 10%");
  expect(item(/^Sword/).querySelector(".arrow--up")).not.toBe(null);
  expect(arrow(/^Ring/)).toBe(null);
  // Off and on again: a new click freezes the tree as it is now.
  fireEvent.click(toggle("Changes"));
  expect(document.querySelector(".arrow")).toBe(null);
  fireEvent.click(toggle("Changes"));
  expect(document.querySelector(".arrow")).toBe(null);
  update(withSword(tree(20), 27));
  expect(arrow(/^Sword/)).toBe("▼ −3%");
  expect(item(/^Sword/).querySelector(".arrow--down")).not.toBe(null);
});

test("a tree rebuilt by itself keeps open what was open; only the new rows come closed, and an open lazy row is asked again (FR-015)", async () => {
  const { update, onExpand } = await draw(tree(20));
  open(/^Additive pool/);
  open(/^⚗️ Alchemy/);
  open(/^Ring/);
  expect(onExpand).toHaveBeenCalledExactlyOnceWith(`${ALCHEMY}/Ring`);
  const cards = node({
    id: `${POOL}/🃏 Cards`,
    name: "🃏 Cards",
    value: 5,
    fmt: "%",
    role: "system",
    combine: "sum",
    poolKind: null,
    flags: { closed: true },
    kids: [node({ id: `${POOL}/🃏 Cards/Card`, name: "Card", value: 5 })],
  });
  update(tree(25, { calculatedAt: 2_000 }, [cards]));
  expect(item(/^Additive pool/).getAttribute("aria-expanded")).toBe("true");
  expect(item(/^⚗️ Alchemy/).getAttribute("aria-expanded")).toBe("true");
  expect(item(/^Ring/).getAttribute("aria-expanded")).toBe("true");
  expect(item(/^🃏 Cards/).getAttribute("aria-expanded")).toBe("false");
  expect(onExpand).toHaveBeenCalledTimes(2);
  expect(onExpand).toHaveBeenLastCalledWith(`${ALCHEMY}/Ring`);
});
