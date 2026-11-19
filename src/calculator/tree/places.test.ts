// A level is built when its parent gets its place, only to decide the parent's name and its one child (spec Open
// Questions, 15/11): that level is kept, and the expand of the parent gives it, with no second build. Over a context
// written by hand (tree/places.ts `PlaceContext`), whose `explain` counts its calls.
import { expect, test } from "vitest";
import { makePlaces } from "./places.ts";
import type { PlaceContext } from "./places.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { read, recNode } from "./tree-fixture.ts";

const lazy = (code: string, open: number, value = 6): Row => ({
  node: row({ pieceKey: code, value, code, kids: "lazy" }),
  open,
});

function counted(levels: Record<number, Row[]>) {
  const calls: number[] = [];
  const ctx: PlaceContext = {
    nodes: [recNode(0, "Root"), recNode(1, "Upper"), recNode(2, "Lower")],
    bugs: [],
    keyOf: (n) => String(n.id),
    openXf: new Map(),
    explain: (id) => {
      calls.push(id);
      return levels[id] ?? null;
    },
    opened: () => null,
  };
  return { calls, places: makePlaces(ctx) };
}

test("a row's level is built when the row gets its place, and its expand gives that level with no second build", () => {
  const { calls, places } = counted({
    1: [read("Invented.a", 2), lazy("Lower()", 2, 3)],
    2: [read("Invented.b", 1), read("Invented.c", 2)],
  });
  const [upper] = places.place(
    { id: "root", code: "Root()" },
    [lazy("Upper()", 1, 5)],
    1,
    [0],
  );
  // the level under the row, and only that one
  expect(calls).toEqual([1]);
  const opened = places.expand(upper?.id ?? "");
  // its rows are the kept level; placing them builds the level under each of them
  expect(calls).toEqual([1, 2]);
  const kids = Array.isArray(opened?.kids) ? opened.kids : [];
  expect(kids.map((k) => [k.code, k.value])).toEqual([
    ["Invented.a", 2],
    ["Lower()", 3],
  ]);
  places.expand(kids[1]?.id ?? "");
  expect(calls).toEqual([1, 2]);
});

test("a level cut by the depth limit or a cycle is kept as cut: the expand says so, with no second build", () => {
  const { calls, places } = counted({});
  const [upper] = places.place(
    { id: "root", code: "Root()" },
    [lazy("Upper()", 1)],
    1,
    [0],
  );
  expect(places.expand(upper?.id ?? "")).toMatchObject({
    kids: [],
    flags: { truncated: true },
  });
  expect(calls).toEqual([1]);
});

const named = (name: string, value: number): Row => ({
  node: row({ pieceKey: null, value, code: null, name, leaf: "rawBonus" }),
  open: null,
});
test("the parts at ×1 stay in their places, each with its own name (spec 009, FR-016: no group at ×1)", () => {
  const { places } = counted({});
  const rows = places.place(
    { id: "root", code: "Root()" },
    [named("X bonus value", 1), named("Slot", 1)],
    1,
    [0],
  );
  expect(rows.map((r) => [r.name, r.value])).toEqual([
    ["X bonus value", 1],
    ["Slot", 1],
  ]);
});

test("the parts at ×1 are named as any level's (pieces.cjs fixNames): a system the rows above show leaves their name", () => {
  const { places } = counted({
    1: [
      named("Bonus per level (Grimoire)", 1),
      named("Other", 1),
      named("Rest", 5),
    ],
  });
  const upgrade: Row = {
    node: row({
      pieceKey: null,
      value: 5,
      code: 'Summoning("GrimoireUpgBonus", 5)',
      name: "Upgrade",
      kids: "lazy",
    }),
    open: 1,
  };
  const [placed] = places.place(
    { id: "root", code: "Root()" },
    [upgrade],
    1,
    [0],
  );
  const kids = places.expand(placed?.id ?? "");
  expect(
    (Array.isArray(kids?.kids) ? kids.kids : []).map((k) => k.name),
  ).toEqual(["Bonus per level", "Other", "Rest"]);
});
