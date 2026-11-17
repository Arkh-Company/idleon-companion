// @vitest-environment jsdom
// The pools and the system groups in the tree view (spec 009, FR-002, FR-012): every pool and group starts closed, and
// a group shows its emoji name and its value in the format of the parts ("×45,582", "+80%"). Every value is invented.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { TreeNode } from "../shared/index.ts";
import { node, ready } from "./formula-fixture.ts";
import { FormulaTree } from "./FormulaTree.tsx";

afterEach(cleanup);

const source = (id: string, value: number): TreeNode =>
  node({ id, name: `Source ${id}`, value, code: `Invented(${id})` });
const system = (
  id: string,
  name: string,
  value: number,
  fmt: TreeNode["fmt"],
  kids: TreeNode[],
): TreeNode =>
  node({
    id,
    name,
    value,
    fmt,
    role: "system",
    combine: fmt === "x" ? "product" : "sum",
    poolKind: null,
    flags: { closed: true },
    kids,
  });
const pool = (id: string, value: number, kids: TreeNode[]): TreeNode =>
  node({
    id,
    name: id.slice("root/".length),
    value,
    fmt: "x",
    role: "pool",
    combine: id.includes("Additive") ? "onePlusPercent" : "product",
    poolKind: id.includes("Additive") ? "additive" : "multi",
    flags: { closed: true },
    kids,
  });

const ROOT = node({
  kids: [
    pool("root/Additive pool", 1.8, [
      system("root/Additive pool/⚗️ Alchemy", "⚗️ Alchemy", 80, "%", [
        source("1", 50),
        source("2", 30),
      ]),
    ]),
    pool("root/Multi pool", 45_582, [
      system("root/Multi pool/🃏 Cards", "🃏 Cards", 45_582, "x", [
        source("3", 2),
        source("4", 22_791),
      ]),
    ]),
  ],
});

const item = (name: RegExp) => screen.getByRole("treeitem", { name });
const open = (name: RegExp) => {
  item(name).focus();
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Enter" });
};

test("every pool and system group starts closed when the tree opens", () => {
  render(<FormulaTree tree={ready(ROOT)} onExpand={vi.fn()} />);
  expect(item(/^Additive pool/).getAttribute("aria-expanded")).toBe("false");
  expect(item(/^Multi pool/).getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("treeitem", { name: /Alchemy/ })).toBe(null);
  open(/^Additive pool/);
  expect(item(/^⚗️ Alchemy/).getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("treeitem", { name: /^Source 1/ })).toBe(null);
});

test("a system group shows its emoji name and its value in the format of the parts", () => {
  render(<FormulaTree tree={ready(ROOT)} onExpand={vi.fn()} />);
  open(/^Additive pool/);
  open(/^Multi pool/);
  expect(item(/^⚗️ Alchemy/).textContent).toContain("+80%");
  expect(item(/^🃏 Cards/).textContent).toContain("×45,582");
  expect(item(/^🃏 Cards/).getAttribute("aria-label")).toMatch(
    /^🃏 Cards, times 45,582/,
  );
});
