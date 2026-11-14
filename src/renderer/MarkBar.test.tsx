// @vitest-environment jsdom
// Antes/depois in the side panel (spec 008 FR-025, FR-037, FR-041; T042): "Mark before" asks a name, a picker chooses
// the mark the tree compares with, each mark has Clear, a fourth is refused, and each row that changed shows the mark's
// value. Every value and name is invented.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Mark } from "../shared/index.ts";
import { stubCompanion } from "./companion-stub.ts";
import type { CompanionStub } from "./companion-stub.ts";
import { node, ready } from "./formula-fixture.ts";
import { SidePanel } from "./SidePanel.tsx";

afterEach(cleanup);

const mark = (name: string, values: Mark["values"] = {}): Mark => ({
  name,
  takenAt: 1,
  values,
});
let companion: CompanionStub;
let saved: Mark[] = [];
beforeEach(() => {
  saved = [];
  companion = stubCompanion();
  companion.listMarks.mockImplementation(() =>
    Promise.resolve({ marks: [...saved], warning: null }),
  );
  companion.saveMark.mockImplementation(({ name }) => {
    saved.push(mark(name));
    return Promise.resolve(null);
  });
  companion.clearMark.mockImplementation(({ name }) => {
    saved = saved.filter((m) => m.name !== name);
    return Promise.resolve(null);
  });
});

const sword = node({
  id: "root/Sword",
  pieceKey: '[1,"Sword"]',
  name: "Sword",
  value: 6,
  fmt: "+",
});
const TREE = ready(node({ kids: [sword] }));
const SIDE = {
  label: "Drop Rate",
  text: "1,234x",
  trees: [["dropRate", "Drop Rate"]] as const,
  id: "dropRate",
};

async function draw(announce = vi.fn()) {
  await act(async () => {
    render(
      <SidePanel
        side={SIDE}
        tree={TREE}
        live={null}
        onClose={vi.fn()}
        onPick={vi.fn()}
        onExpand={vi.fn()}
        announce={announce}
      />,
    );
    await Promise.resolve();
  });
  return announce;
}
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const field = () => screen.getByRole("textbox", { name: "Mark name" });
const picker = () => screen.getByRole("combobox", { name: "Compare with" });
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

test("Mark before asks a name, suggesting the first free Mark N, and takes the focus to the field", async () => {
  saved = [mark("Mark 1")];
  await draw();
  fireEvent.click(button("Mark before"));
  expect(field()).toBe(document.activeElement);
  expect((field() as HTMLInputElement).value).toBe("Mark 2");
  expect(field().getAttribute("maxlength")).toBe("40");
});

test("saving sends the character and the name, chooses the new mark and gives the focus back to Mark before", async () => {
  const announce = await draw();
  fireEvent.click(button("Mark before"));
  fireEvent.change(field(), { target: { value: "Before the swap" } });
  fireEvent.click(button("Save mark"));
  await settle();
  expect(companion.saveMark).toHaveBeenCalledWith({
    character: 1,
    name: "Before the swap",
  });
  expect((picker() as HTMLSelectElement).value).toBe("Before the swap");
  expect(document.activeElement).toBe(button("Mark before"));
  expect(announce).toHaveBeenLastCalledWith("Before the swap saved.");
});

test("Cancel closes the field and gives the focus back", async () => {
  await draw();
  fireEvent.click(button("Mark before"));
  fireEvent.click(button("Cancel"));
  expect(screen.queryByRole("textbox")).toBe(null);
  expect(document.activeElement).toBe(button("Mark before"));
});

test("with 3 marks, Mark before says to clear one first and asks nothing (FR-037)", async () => {
  saved = [mark("Mark 1"), mark("Mark 2"), mark("Mark 3")];
  const announce = await draw();
  fireEvent.click(button("Mark before"));
  expect(screen.queryByRole("textbox")).toBe(null);
  expect(screen.getByText("Up to 3 marks: clear one first.")).toBeDefined();
  expect(announce).toHaveBeenLastCalledWith("Up to 3 marks: clear one first.");
  expect(companion.saveMark).not.toHaveBeenCalled();
});

test("a refusal of the main is shown as it came", async () => {
  companion.saveMark.mockResolvedValueOnce(
    "A mark's name can't have a character's name.",
  );
  await draw();
  fireEvent.click(button("Mark before"));
  fireEvent.click(button("Save mark"));
  await settle();
  expect(
    screen.getByText("A mark's name can't have a character's name."),
  ).toBeDefined();
});

test("a mark chosen shows the mark's value beside the current one on each row that changed", async () => {
  saved = [mark("Mark 1", { '[1,"Sword"]': 4 })];
  await draw();
  fireEvent.change(picker(), { target: { value: "Mark 1" } });
  const row = screen.getByRole("treeitem", { name: /^Sword/ });
  expect(row.querySelector(".was")?.textContent).toBe("was +4");
  fireEvent.change(picker(), { target: { value: "" } });
  expect(row.querySelector(".was")).toBe(null);
});

test("Clear removes the chosen mark, stops the comparison and keeps the focus in the bar", async () => {
  saved = [mark("Mark 1", { '[1,"Sword"]': 4 }), mark("Mark 2")];
  await draw();
  fireEvent.change(picker(), { target: { value: "Mark 1" } });
  button("Clear Mark 1").focus();
  fireEvent.click(button("Clear Mark 1"));
  await settle();
  expect(companion.clearMark).toHaveBeenCalledWith({
    character: 1,
    name: "Mark 1",
  });
  expect(
    [...(picker() as HTMLSelectElement).options].map((o) => o.text),
  ).toEqual(["Nothing", "Mark 2"]);
  expect(
    screen.getByRole("treeitem", { name: /^Sword/ }).querySelector(".was"),
  ).toBe(null);
  expect(document.activeElement).toBe(picker());
});

test("the warning of an unreadable file shows and is said once (FR-041)", async () => {
  companion.listMarks.mockResolvedValueOnce({
    marks: [],
    warning: "Saved marks could not be read and were reset",
  });
  const announce = await draw();
  await settle();
  expect(
    screen.getByText("Saved marks could not be read and were reset"),
  ).toBeDefined();
  expect(announce).toHaveBeenCalledExactlyOnceWith(
    "Saved marks could not be read and were reset",
  );
});
