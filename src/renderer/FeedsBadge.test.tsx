// @vitest-environment jsdom
// Where this goes in the tree view (spec 008 US8, FR-027): a part that 2 or more catalog numbers use shows a badge with
// how many, said in its row's name; a tap lists them, by name, inside the treeview, and each one opens its tree. A part
// of 1 number shows nothing. Every value and name is invented.
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
import type { FormulaTree as Tree, TreeNode } from "../shared/index.ts";
import { App } from "./App.tsx";
import { stubCompanion } from "./companion-stub.ts";
import type { CompanionStub } from "./companion-stub.ts";
import { node, ready } from "./formula-fixture.ts";
import { FormulaTree } from "./FormulaTree.tsx";

let companion: CompanionStub;
beforeEach(() => {
  companion = stubCompanion();
  companion.feedsList.mockResolvedValue(["dropRate", "hp", "str"]);
});
afterEach(cleanup);

const sword = node({
  id: "root/Sword",
  pieceKey: '[1,"Sword"]',
  name: "Sword",
  value: 4,
  feeds: 3,
});
const once = node({ id: "root/Once", pieceKey: '[1,"Once"]', name: "Once" });

function draw(root: TreeNode = node({ kids: [sword, once] })) {
  const onOpen = vi.fn<(id: string) => void>();
  render(
    <FormulaTree tree={ready(root)} onExpand={vi.fn()} onOpenNumber={onOpen} />,
  );
  return { onOpen };
}
const item = (name: RegExp | string) => screen.getByRole("treeitem", { name });
const key = (k: string) => {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: k });
};
const focused = () => document.activeElement?.getAttribute("aria-label");
const settle = () => act(() => Promise.resolve());

test("a part of 3 numbers shows the badge 3, said in its row's name; a part of 1 shows nothing", () => {
  draw();
  const row = item(/^Sword/);
  expect(row.getAttribute("aria-label")).toContain("feeds 3 numbers");
  expect(row.querySelector(".feeds")?.textContent).toBe("3");
  expect(row.querySelector(".feeds")?.getAttribute("aria-hidden")).toBe("true");
  expect(item(/^Once/).querySelector(".feeds")).toBe(null);
  expect(item(/^Once/).getAttribute("aria-label")).not.toContain("feeds");
});

test("a tap on the badge lists the numbers by name, with the focus on the list's row", async () => {
  draw();
  const badge = item(/^Sword/).querySelector(".feeds");
  if (!badge) throw new Error("no badge");
  fireEvent.click(badge);
  await settle();
  expect(companion.feedsList).toHaveBeenCalledExactlyOnceWith({
    pieceKey: '[1,"Sword"]',
  });
  expect(item(/^Sword/).getAttribute("aria-expanded")).toBe("true");
  expect(focused()).toBe("Feeds 3 numbers");
  expect(item("Feeds 3 numbers").getAttribute("aria-expanded")).toBe("true");
  expect(item("Drop Rate, this number")).toBeDefined();
  expect(item("Open HP")).toBeDefined();
  expect(item("Open STR")).toBeDefined();
});

test("each number of the list opens its tree, by Enter or a tap; this number opens nothing", async () => {
  const { onOpen } = draw();
  item(/^Sword/).focus();
  key("ArrowRight");
  key("ArrowRight");
  expect(focused()).toBe("Feeds 3 numbers");
  key("ArrowRight");
  await settle();
  key("ArrowDown");
  expect(focused()).toBe("Drop Rate, this number");
  key("Enter");
  expect(onOpen).not.toHaveBeenCalled();
  key("ArrowDown");
  key("Enter");
  expect(onOpen).toHaveBeenLastCalledWith("hp");
  fireEvent.click(screen.getByText("STR"));
  expect(onOpen).toHaveBeenLastCalledWith("str");
});

test("the list is asked once per part, and says it is loading until it comes", async () => {
  let answer: (ids: string[]) => void = () => undefined;
  companion.feedsList.mockReturnValue(
    new Promise((r) => {
      answer = r;
    }),
  );
  draw();
  item(/^Sword/).focus();
  key("ArrowRight");
  key("ArrowRight");
  key("ArrowRight");
  expect(screen.getByText("finding the numbers…")).toBeDefined();
  key("ArrowLeft");
  key("ArrowRight");
  expect(companion.feedsList).toHaveBeenCalledOnce();
  await act(() => {
    answer(["hp", "str"]);
    return Promise.resolve();
  });
  expect(item("Open HP")).toBeDefined();
});

test("in the side panel, a number of the list opens its tree with the focus on its title, and ✕ gives the focus back to the first number", async () => {
  let sendTree: (t: Tree) => void = () => undefined;
  companion.onStats.mockImplementation((cb) => {
    cb({ state: "ready", rows: [{ label: "Drop Rate", text: "1,234x" }] });
    return () => undefined;
  });
  companion.onFormula.mockImplementation((cb) => {
    sendTree = cb;
    return () => undefined;
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("tab", { name: "Stats" }));
  const opener = screen.getByRole("button", { name: "1,234x" });
  fireEvent.click(opener);
  act(() => {
    sendTree(ready(node({ kids: [sword] })));
  });
  const badge = item(/^Sword/).querySelector(".feeds");
  if (!badge) throw new Error("no badge");
  fireEvent.click(badge);
  await settle();
  fireEvent.click(screen.getByText("HP"));
  expect(companion.requestFormula).toHaveBeenLastCalledWith({ id: "hp" });
  const title = screen.getByRole("heading", { level: 2, name: /^HP/ });
  expect(document.activeElement).toBe(title);
  expect(companion.setSidePanel).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Close the breakdown" }));
  expect(document.activeElement).toBe(opener);
});

test("the badge is a round count with no fixed width: a row at 210 px CSS still wraps (FR-031)", () => {
  const css = readFileSync(join(import.meta.dirname, "styles.css"), "utf8");
  const rule = /\.feeds \{([^}]*)\}/.exec(css)?.[1] ?? "";
  expect(rule).toMatch(/border-radius/);
  expect(rule).not.toMatch(/(^|[^-])width:|white-space/);
});
