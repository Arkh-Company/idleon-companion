// @vitest-environment jsdom
// The tree view of the side panel (spec 008 FR-006, FR-013, FR-014, FR-015a, FR-031; design.md C2, C4, C5, C8, §3.8): the
// whole APG treeview, one Tab stop, the branches opened in place, the leaf tags, the groups that start closed and the
// width of 210 px CSS. Every value and name is invented.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LEAF_KINDS } from "../shared/index.ts";
import type { LeafKind, TreeNode } from "../shared/index.ts";
import { node, ready } from "./formula-fixture.ts";
import { FormulaTree } from "./FormulaTree.tsx";

afterEach(cleanup);

const leafA = node({
  id: "root/A/Leaf",
  name: "Leaf",
  value: 4,
  leaf: "level",
});
const branchA = node({ id: "root/A", name: "Alpha", value: 4, kids: [leafA] });
const branchB = node({ id: "root/B", name: "Beta", value: 6, kids: "lazy" });
const ROOT = node({ kids: [branchA, branchB] });

function draw(root: TreeNode = ROOT) {
  const onExpand = vi.fn<(id: string) => void>();
  const view = render(<FormulaTree tree={ready(root)} onExpand={onExpand} />);
  return { onExpand, ...view };
}
const item = (name: RegExp | string) => screen.getByRole("treeitem", { name });
const key = (k: string) => {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: k });
};
const focused = () => document.activeElement?.getAttribute("aria-label");

test("the tree is named and is one Tab stop: only the active row is in the Tab order", () => {
  draw();
  expect(
    screen.getByRole("tree", { name: "Drop Rate breakdown" }),
  ).toBeDefined();
  const items = screen.getAllByRole("treeitem");
  expect(items.filter((i) => i.tabIndex === 0)).toHaveLength(1);
  expect(items.filter((i) => i.tabIndex === -1)).toHaveLength(items.length - 1);
});

test("aria-level is the depth, with the set size and position of each row", () => {
  draw();
  const root = item(/^Drop Rate/);
  expect(root.getAttribute("aria-level")).toBe("1");
  expect(root.getAttribute("aria-expanded")).toBe("true");
  expect(item(/^Alpha/).getAttribute("aria-level")).toBe("2");
  expect(item(/^Beta/).getAttribute("aria-posinset")).toBe("2");
  expect(item(/^Beta/).getAttribute("aria-setsize")).toBe("2");
});

test("↓ ↑ Home End move along the visible rows, and the Tab stop moves with the focus", () => {
  draw();
  item(/^Drop Rate/).focus();
  key("ArrowDown");
  expect(focused()).toMatch(/^Alpha/);
  expect(item(/^Alpha/).tabIndex).toBe(0);
  expect(item(/^Drop Rate/).tabIndex).toBe(-1);
  key("End");
  expect(focused()).toMatch(/^Beta/);
  key("ArrowUp");
  expect(focused()).toMatch(/^Alpha/);
  key("Home");
  expect(focused()).toMatch(/^Drop Rate/);
});

test("→ opens a closed row, then goes to its first child; ← goes to the parent, then closes", () => {
  draw();
  item(/^Alpha/).focus();
  expect(item(/^Alpha/).getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("treeitem", { name: /^Leaf/ })).toBe(null);
  key("ArrowRight");
  expect(item(/^Alpha/).getAttribute("aria-expanded")).toBe("true");
  key("ArrowRight");
  expect(focused()).toMatch(/^Leaf/);
  key("ArrowLeft");
  expect(focused()).toMatch(/^Alpha/);
  key("ArrowLeft");
  expect(item(/^Alpha/).getAttribute("aria-expanded")).toBe("false");
});

test("Enter opens and closes a row", () => {
  draw();
  item(/^Alpha/).focus();
  key("Enter");
  expect(item(/^Alpha/).getAttribute("aria-expanded")).toBe("true");
  key("Enter");
  expect(item(/^Alpha/).getAttribute("aria-expanded")).toBe("false");
});

test("a lazy branch asks its rows once and says calculating this part… until they come", () => {
  const { onExpand, rerender } = draw();
  item(/^Beta/).focus();
  key("ArrowRight");
  expect(onExpand).toHaveBeenCalledWith("root/B");
  expect(screen.getByText("calculating this part…")).toBeDefined();
  expect(
    screen
      .getByText("calculating this part…")
      .closest('[role="group"]')
      ?.getAttribute("aria-busy"),
  ).toBe("true");

  const built = {
    ...branchB,
    kids: [node({ id: "root/B/Kid", name: "Kid", value: 6, leaf: "quantity" })],
  };
  rerender(
    <FormulaTree
      tree={ready(node({ kids: [branchA, built] }))}
      onExpand={onExpand}
    />,
  );
  expect(screen.queryByText("calculating this part…")).toBe(null);
  expect(item(/^Kid/)).toBeDefined();
  expect(onExpand).toHaveBeenCalledTimes(1);
});

const LABELS: Record<LeafKind, [label: string, family: string]> = {
  level: ["Level", "grows"],
  quantity: ["Quantity", "grows"],
  investedPoints: ["Invested points", "grows"],
  tier: ["Tier", "grows"],
  record: ["Record", "grows"],
  condition: ["Condition · limit", "pick"],
  choice: ["Choice", "pick"],
  fixedValue: ["Fixed value", "set"],
  rawBonus: ["Raw bonus", "set"],
  unknown: ["?", "unknown"],
};
const FAMILY_TEXT: Record<string, string> = {
  grows: "You can raise this.",
  pick: "You unlock or pick this.",
  set: "Set by the game.",
  unknown: "We don't know yet what kind of number this is.",
};

test.each(LEAF_KINDS.map((k) => [k, ...LABELS[k]] as const))(
  "a %s leaf has the tag %s, the color of its family and the family in text (FR-013)",
  (leaf, label, family) => {
    const kid = node({
      id: "root/Kid",
      name: "Kid",
      value: leaf === "condition" ? false : 3,
      leaf,
      condition: leaf === "condition" ? "limit" : null,
    });
    draw(node({ kids: [kid] }));
    const tag = item(/^Kid/).querySelector(".tag");
    expect(tag?.textContent).toBe(label);
    expect(tag?.classList.contains(`tag--${family}`)).toBe(true);
    item(/^Kid/).focus();
    key("ArrowRight");
    expect(
      screen.getByText(new RegExp(FAMILY_TEXT[family] ?? "-")),
    ).toBeDefined();
  },
);

test("a raw bonus says what it is (FR-013), and a Condition is yes or no", () => {
  draw(
    node({
      kids: [
        node({ id: "root/Raw", name: "Raw", value: 2, leaf: "rawBonus" }),
        node({
          id: "root/If",
          name: "If",
          value: false,
          leaf: "condition",
          condition: "owned",
        }),
      ],
    }),
  );
  item(/^Raw/).focus();
  key("Enter");
  expect(
    screen.getByText(/Set by the game: the bonus this source gives\./),
  ).toBeDefined();
  expect(item(/^If/).textContent).toContain("no");
});

test("a part at 0 and a part at ×1 stay in their places, in the game's order, their values greyed (spec 009, FR-016)", () => {
  draw(
    node({
      kids: [
        node({ id: "root/Z1", name: "Zed", value: 0, leaf: "level" }),
        node({ id: "root/A", name: "Alpha", value: 4, leaf: "level" }),
        node({ id: "root/O", name: "Once", value: 1, fmt: "x", leaf: "level" }),
      ],
    }),
  );
  const rows = screen
    .getAllByRole("treeitem")
    .map((i) => (i.getAttribute("aria-label") ?? "").split(",")[0]);
  expect(rows).toEqual(["Drop Rate", "Zed", "Alpha", "Once"]);
  const value = (name: RegExp) => item(name).querySelector(".num")?.className;
  expect(value(/^Zed/)).toBe("num num--zero");
  expect(value(/^Once/)).toBe("num num--zero");
  expect(value(/^Alpha/)).toBe("num");
});

test("more than 10 parts with shares: all of them, in the game's order, with no Small row and no Show all (spec 009, FR-016)", () => {
  const shares = [
    0.4, 0.002, 0.3, 0.001, 0.1, 0.05, 0.04, 0.03, 0.02, 0.01, 0.003, 0.046,
  ];
  const kids = shares.map((share, i) =>
    node({
      id: `root/P${String(i)}`,
      name: `Part ${String(i)}`,
      value: share * 100,
      fmt: "%",
      leaf: "level",
      share,
      shareMode: "sum",
    }),
  );
  draw(node({ kids }));
  const names = screen
    .getAllByRole("treeitem")
    .map((i) => i.getAttribute("aria-label") ?? "")
    .filter((n) => n.startsWith("Part"));
  expect(names.map((n) => n.split(",")[0])).toEqual(kids.map((k) => k.name));
  expect(screen.queryByRole("treeitem", { name: /^Small/ })).toBe(null);
  expect(screen.queryByRole("treeitem", { name: /^Show all/ })).toBe(null);
});

test("a decay curve with a maximum says how much is reached (FR-015a), and one without says nothing", () => {
  draw(
    node({
      kids: [
        node({
          id: "root/C",
          name: "Curve",
          value: 24.8,
          fmt: "%",
          maxReached: { share: 0.62, max: 40 },
        }),
        node({ id: "root/D", name: "Plain", value: 3 }),
      ],
    }),
  );
  expect(item(/^Curve/).textContent).toContain("62% reached · max +40%");
  expect(item(/^Plain/).textContent).not.toContain("reached");
});

test("How it adds up shows the names and the numbers, with the row's value after =", () => {
  draw(
    node({
      kids: [
        node({
          id: "root/F",
          name: "Calc",
          value: 62.5,
          formula: [
            ["Points", "×", "Bonus"],
            [25, 2.5, 62.5],
          ],
          kids: [
            node({
              id: "root/F/Points",
              name: "Points",
              value: 25,
              leaf: "investedPoints",
            }),
          ],
        }),
      ],
    }),
  );
  item(/^Calc/).focus();
  key("ArrowRight");
  const how = item(/^How it adds up = 62\.5/);
  how.focus();
  key("ArrowRight");
  key("ArrowRight");
  expect(focused()).toBe("Points × Bonus");
  expect(document.activeElement?.getAttribute("aria-level")).toBe("4");
  key("ArrowDown");
  expect(focused()).toBe("25 × 2.5 = 62.5");
});

test("a rule's How it adds up shows its two lines as they come, with its last number after =", () => {
  draw(
    node({
      kids: [
        node({
          id: "root/R",
          name: "Picked",
          value: 35,
          formula: { rule: ["If Owned bonus: 35", "yes → 35"] },
        }),
      ],
    }),
  );
  item(/^Picked/).focus();
  key("ArrowRight");
  item(/^How it adds up = 35/).focus();
  key("ArrowRight");
  key("ArrowRight");
  expect(focused()).toBe("If Owned bonus: 35");
  key("ArrowDown");
  expect(focused()).toBe("yes → 35");
});

test("Game details opens into its rows, each one reached by the arrows", () => {
  draw(
    node({
      kids: [
        node({ id: "root/G", name: "Call", value: 62.5, code: "Block(1, 2)" }),
      ],
    }),
  );
  item(/^Call/).focus();
  key("ArrowRight");
  key("ArrowRight");
  expect(focused()).toBe("Game details");
  key("ArrowRight");
  key("ArrowRight");
  expect(focused()).toBe("Game call: Block(1, 2)");
  key("ArrowDown");
  expect(focused()).toBe("Exact value: 62.5");
});

test("a row without a proven name says no name yet, and an unavailable one shows — and says so", () => {
  draw(
    node({
      kids: [
        node({
          id: "root/G",
          name: "Game value",
          value: 3,
          flags: { unnamed: true },
        }),
        node({
          id: "root/U",
          name: "Gone",
          value: null,
          flags: { unavailable: true },
        }),
      ],
    }),
  );
  expect(item(/^Game value/).textContent).toContain("no name yet");
  expect(item(/^Gone/).textContent).toContain("—");
  expect(item(/^Gone/).getAttribute("aria-label")).toContain("unavailable");
});

test("a tree of 5,000 rows draws only the root and the first level until a branch opens", () => {
  const kids = Array.from({ length: 10 }, (_, b) =>
    node({
      id: `root/B${String(b)}`,
      name: `Branch ${String(b)}`,
      value: 1,
      kids: Array.from({ length: 499 }, (_, k) =>
        node({ id: `root/B${String(b)}/K${String(k)}`, name: "Kid", value: 1 }),
      ),
    }),
  );
  const { container } = draw(node({ kids }));
  expect(container.querySelectorAll('[role="treeitem"]')).toHaveLength(11);
});

test("at 210 px CSS nothing scrolls sideways: no inline style, indent capped, rows that wrap (FR-031)", () => {
  let deep = node({ id: "d9", name: "Deep 9", value: 1, leaf: "level" });
  for (let i = 8; i >= 1; i--)
    deep = node({
      id: `d${String(i)}`,
      name: `Deep ${String(i)}`,
      value: 1,
      kids: [deep],
    });
  const { container } = draw(node({ kids: [deep] }));
  for (let i = 1; i <= 8; i++) {
    item(new RegExp(`^Deep ${String(i)},`)).focus();
    key("ArrowRight");
  }
  expect(container.querySelector("[style]")).toBe(null);
  const row = item(/^Deep 9/).querySelector(".row");
  expect(row?.className).toMatch(/\blvl-6\b/);
  // Past the cap the row says its level, hidden from the reader (aria-level says it); past 4, only in a narrow panel.
  const tag = (name: string) =>
    item(new RegExp(`^${name},`)).querySelector(":scope > .row > .lvl-tag");
  expect(tag("Deep 8")?.textContent).toBe("L9");
  expect(tag("Deep 8")?.getAttribute("aria-hidden")).toBe("true");
  expect(tag("Deep 8")?.classList.contains("lvl-tag--narrow")).toBe(false);
  expect(tag("Deep 5")?.classList.contains("lvl-tag--narrow")).toBe(true);
  expect(tag("Deep 3")).toBe(null);
  const css = readFileSync(join(import.meta.dirname, "styles.css"), "utf8");
  expect(css).toMatch(/@container side \(max-width: 300px\)/);
  expect(css).toMatch(/\.row \{[^}]*flex-wrap: wrap/);
  expect(css).toMatch(/\.side-panel \{[^}]*overflow-wrap: anywhere/);
});
