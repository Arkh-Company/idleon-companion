// @vitest-environment jsdom
// Game details beyond the call (spec 008 design.md C10): a row's state reads, and, in the root's Game details at the
// end of the page, the whole tree as the bench counts it, its rows, those with How it adds up, those of unknown type
// and the repeated steps, which show only when asked. Every line is a treeitem read aloud with no loose symbol. Every
// value and name is invented.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { TreeNode } from "../shared/index.ts";
import { node, ready } from "./formula-fixture.ts";
import { FormulaTree } from "./FormulaTree.tsx";

afterEach(cleanup);

const item = (name: RegExp | string) => screen.getByRole("treeitem", { name });
const no = (name: RegExp | string) => screen.queryByRole("treeitem", { name });
const key = (k: string) => {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: k });
};
const draw = (root: TreeNode) =>
  render(<FormulaTree tree={ready(root)} onExpand={vi.fn()} />);
/** Opens a row and then its Game details, as the arrows do. */
function details(row: RegExp, detailsAt = 1) {
  item(row).focus();
  key("ArrowRight");
  for (let i = 0; i < detailsAt; i++) key("ArrowDown");
  expect(document.activeElement?.getAttribute("aria-label")).toBe(
    "Game details",
  );
  key("Enter");
}

const read = (id: string, code: string, value: number) =>
  node({ id: `root/P/${id}`, name: id, value, code });

test("a call's Game details says the state it reads, between the call and the exact value", () => {
  draw(
    node({
      kids: [
        node({
          id: "root/P",
          name: "Part",
          value: 7,
          code: "Block(1)",
          kids: [
            read("R1", "Levels[3]", 100),
            node({ id: "root/P/C", name: "Call", value: 2, code: "Other(2)" }),
            read("R2", "Holes[1][2]", 0.5),
          ],
        }),
      ],
    }),
  );
  details(/^Part/, 4);
  key("ArrowRight");
  expect(document.activeElement?.getAttribute("aria-label")).toBe(
    "Game call: Block(1)",
  );
  key("ArrowDown");
  expect(document.activeElement?.getAttribute("aria-label")).toBe(
    "Reads: Levels[3] = 100, Holes[1][2] = 0.5",
  );
  key("ArrowDown");
  expect(document.activeElement?.getAttribute("aria-label")).toBe(
    "Exact value: 7",
  );
});

test("a row that is a read says what it reads, and no game call", () => {
  draw(
    node({
      kids: [
        node({ id: "root/R", name: "Kills", value: 3, code: "Holes[11][26]" }),
      ],
    }),
  );
  details(/^Kills/);
  expect(item("Reads: Holes[11][26] = 3")).toBeDefined();
  expect(no(/^Game call/)).toBe(null);
});

/** A root with its call, holding every kind the summary counts. */
const WHOLE = node({
  code: "Top()",
  formula: [
    ["Part", "+", "Step"],
    [1, 2, 3],
  ],
  kids: [
    node({
      id: "root/P",
      name: "Part",
      value: 1,
      leaf: "unknown",
      code: "Own()",
    }),
    node({ id: "root/Q", name: "Odd", value: 1, flags: { unknown: true } }),
    node({ id: "root/S", name: "Step", value: 2, flags: { progress: true } }),
    node({ id: "root/L", name: "Later", value: 4, kids: "lazy" }),
  ],
});

test("the root's Game details counts the whole tree, each line read aloud in words", () => {
  draw(WHOLE);
  // The parts first, then How it adds up, then Game details (the repeated step is hidden).
  details(/^Drop Rate/, 4);
  for (const label of [
    "Rows in this tree: 5",
    "Rows with How it adds up: 1",
    "Rows of unknown type: 2",
    "Repeated steps: 1",
    "Branches not calculated yet: 1",
  ])
    expect(item(label)).toBeDefined();
  expect(item("Rows of unknown type: 2").textContent).toContain("?");
});

test("repeated steps stay out of the lists until Show repeated steps (N), then show in place with their tag", () => {
  draw(WHOLE);
  expect(no(/^Step/)).toBe(null);
  details(/^Drop Rate/, 4);
  const show = item("Show repeated steps (1)");
  show.focus();
  key("Enter");
  expect(item(/^Step/).textContent).toContain("repeated step");
  expect(document.activeElement).toBe(item("Hide repeated steps (1)"));
  key("Enter");
  expect(no(/^Step/)).toBe(null);
  expect(item("Show repeated steps (1)")).toBeDefined();
});

test("without a repeated step there is no Show repeated steps", () => {
  draw(node({ code: "Top()", kids: [node({ id: "root/P", name: "Part" })] }));
  details(/^Drop Rate/);
  expect(item("Repeated steps: 0")).toBeDefined();
  expect(no(/repeated steps \(/)).toBe(null);
  expect(no(/^Branches not calculated/)).toBe(null);
});

test("a part's own Game details has no count of the tree", () => {
  draw(WHOLE);
  // Its type's phrase, then its Game details.
  details(/^Part/, 2);
  expect(item("Game call: Own()")).toBeDefined();
  expect(no(/^Rows in this tree/)).toBe(null);
});
