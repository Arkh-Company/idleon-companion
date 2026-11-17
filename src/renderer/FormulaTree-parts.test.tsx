// @vitest-environment jsdom
// Every part in its place (spec 009, FR-016): no group "At 0", "At ×1" or "Small" and no "Show all", in any level; a
// Condition among many parts keeps its place, and a 0 in a product still says it zeroes the total. Every value and name
// is invented.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { TreeNode } from "../shared/index.ts";
import { node, ready } from "./formula-fixture.ts";
import { FormulaTree } from "./FormulaTree.tsx";

afterEach(cleanup);

const draw = (root: TreeNode) =>
  render(<FormulaTree tree={ready(root)} onExpand={vi.fn()} />);
const labels = () =>
  screen
    .getAllByRole("treeitem")
    .map((i) => (i.getAttribute("aria-label") ?? "").split(",")[0]);

test("with more than 10 parts, a Condition in the middle stays in its place, and every part shows", () => {
  const shares = [
    0.4,
    0.3,
    0.1,
    0.05,
    0.04,
    null,
    0.03,
    0.02,
    0.02,
    0.02,
    0.01,
    0.01,
  ];
  const kids = shares.map((share, i) =>
    node({
      id: `root/P${String(i)}`,
      name: `Part ${String(i)}`,
      share,
      shareMode: share === null ? "condition" : "sum",
      leaf: share === null ? "condition" : "level",
    }),
  );
  draw(node({ kids }));
  expect(labels().slice(1)).toEqual(kids.map((k) => k.name));
});

test("a 0 in a product stays in its place and says it zeroes the total", () => {
  draw(
    node({
      kids: [
        node({
          id: "root/Z",
          name: "Zed",
          value: 0,
          fmt: "x",
          share: 1,
          shareMode: "productZero",
        }),
        node({
          id: "root/B",
          name: "Big",
          value: 6,
          fmt: "x",
          share: 0,
          shareMode: "productZero",
        }),
      ],
    }),
  );
  expect(labels()).toEqual(["Drop Rate", "Zed", "Big"]);
  expect(
    screen.getByRole("treeitem", { name: /^Zed/ }).getAttribute("aria-label"),
  ).toContain("zeroes the total");
});
