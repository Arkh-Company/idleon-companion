// The arrows of "Changes" (spec 009 FR-013, NFR-003; research R5): each row's change against the tree frozen at the
// click ("live") or a mark, in the row's own unit; a pool's or group's value rebuilt from its rows by `combine`, so the
// base is kept by piece only. Every value and name is invented.
import { expect, test } from "vitest";
import type { Mark, TreeNode } from "../shared/index.ts";
import { node } from "./formula-fixture.ts";
import {
  arrowOf,
  arrowsOf,
  baseOf,
  groupValue,
  growBase,
  valuesOf,
} from "./tree-changes.ts";

const piece = (
  id: string,
  value: TreeNode["value"],
  fmt: TreeNode["fmt"] = "%",
): TreeNode =>
  node({ id, name: id, pieceKey: `[0,"${id}"]`, value, fmt, role: "piece" });
const group = (
  id: string,
  combine: NonNullable<TreeNode["combine"]>,
  kids: TreeNode[] | "lazy",
  value: TreeNode["value"] = null,
  fmt: TreeNode["fmt"] = "%",
): TreeNode =>
  node({ id, name: id, value, fmt, role: "system", combine, kids });
const values = (...pairs: [string, number | null][]) => new Map(pairs);

/** Drop-Rate-like: a pool 1 + (Alchemy) ÷ 100 with the group Alchemy (Sword + Ring) and a lone Card. */
const tree = (sword: number | null): TreeNode =>
  node({
    id: "root",
    role: "root",
    value: 1.6,
    kids: [
      node({
        id: "root/Additive pool",
        name: "Additive pool",
        value: 1.6,
        fmt: "x",
        role: "pool",
        combine: "onePlusPercent",
        poolKind: "multi",
        kids: [
          group("root/Additive pool/⚗️ Alchemy", "sum", [
            piece("Sword", sword),
            piece("Ring", 30),
          ]),
          piece("Card", 10),
        ],
      }),
    ],
  });

test.each<
  [string, TreeNode["fmt"], TreeNode["combine"], number, number, string]
>([
  ["a +% row in points", "%", undefined, 20, 30, "▲ +10%"],
  ["a +% row going down", "%", undefined, 30, 27, "▼ −3%"],
  [
    "a × row as the multiplier's difference",
    "x",
    undefined,
    1.2,
    1.32,
    "▲ +0.12",
  ],
  ["a + row", "+", undefined, 4, 9, "▲ +5"],
  [
    "a group of bonuses in % as their sum in %",
    "%",
    "percent",
    0.16,
    0.26,
    "▲ +10%",
  ],
])("%s: %s → %s", (_name, fmt, combine, before, now, text) => {
  expect(arrowOf({ fmt, combine: combine ?? null }, before, now)).toEqual({
    up: now > before,
    text,
  });
});

test.each<
  [string, TreeNode["value"] | undefined, TreeNode["value"] | undefined]
>([
  ["no change", 4, 4],
  ["an unavailable value now", 4, null],
  ["no value before", undefined, 4],
  ["a yes or no", false, true],
])("%s shows no arrow", (_name, before, now) => {
  expect(arrowOf({ fmt: "%" }, before, now)).toBe(null);
});

test.each<[NonNullable<TreeNode["combine"]>, number]>([
  ["sum", 2 + 3 + 5],
  ["product", 2 * 3 * 5],
  ["onePlusPercent", 1 + 10 / 100],
  ["max", 5],
  ["min", 2],
  ["percent", 10 / 100],
])("a group of combine %s is rebuilt from its rows", (combine, value) => {
  const kids = [piece("a", 0), piece("b", 0), piece("c", 0)];
  expect(
    groupValue(group("g", combine, kids), values(["a", 2], ["b", 3], ["c", 5])),
  ).toBeCloseTo(value);
});

test("a group with an unavailable source has no value; a group not built yet keeps its own", () => {
  const kids = [piece("a", 0), piece("b", 0)];
  expect(
    groupValue(group("g", "sum", kids), values(["a", 2], ["b", null])),
  ).toBe(null);
  expect(groupValue(group("g", "sum", "lazy", 7), values())).toBe(7);
});

test("every row's value: a piece's from the pieces given, a pool's and a group's rebuilt from their rows", () => {
  const v = valuesOf(tree(20), { '[0,"Sword"]': 40 });
  expect(v.get("Sword")).toBe(40);
  expect(v.get("Ring")).toBe(30);
  expect(v.get("root/Additive pool/⚗️ Alchemy")).toBe(70);
  expect(v.get("root/Additive pool")).toBeCloseTo(1.8);
  expect(valuesOf(tree(20)).get("root/Additive pool")).toBeCloseTo(1.6);
});

test("live: the tree is frozen at the click, and a part's change shows on the part, its group and its pool", () => {
  const base = baseOf(tree(20));
  expect(base.mark).toBe(null);
  expect(arrowsOf(tree(20), base.values).size).toBe(0);
  const arrows = arrowsOf(tree(30), base.values);
  expect(arrows.get("Sword")).toEqual({ up: true, text: "▲ +10%" });
  expect(arrows.get("root/Additive pool/⚗️ Alchemy")).toEqual({
    up: true,
    text: "▲ +10%",
  });
  expect(arrows.get("root/Additive pool")).toEqual({
    up: true,
    text: "▲ +0.1",
  });
  expect(arrows.has("Ring")).toBe(false);
  expect(arrows.has("Card")).toBe(false);
});

const mark = (name: string, v: Mark["values"]): Mark => ({
  name,
  takenAt: 1,
  values: v,
});

test("against a mark of the 008, the base is the mark's values by piece", () => {
  const m = mark("Mark 1", { '[0,"Ring"]': 25, '[0,"Card"]': 10 });
  const base = baseOf(tree(20), m);
  expect(base).toEqual({ mark: "Mark 1", values: m.values });
  const arrows = arrowsOf(tree(20), base.values);
  expect(arrows.get("Ring")).toEqual({ up: true, text: "▲ +5%" });
  expect(arrows.get("root/Additive pool/⚗️ Alchemy")).toEqual({
    up: true,
    text: "▲ +5%",
  });
  expect(arrows.has("Card")).toBe(false);
});

test("an unavailable source leaves its group with no arrow, and the rest of the tree with theirs", () => {
  const base = baseOf(tree(20));
  const arrows = arrowsOf(tree(null), base.values);
  expect(arrows.has("Sword")).toBe(false);
  expect(arrows.has("root/Additive pool/⚗️ Alchemy")).toBe(false);
  expect(arrows.has("root/Additive pool")).toBe(false);
});

test("two groups of the same name: a rebuilt tree whose first one left gives no false arrow on the one that kept its name", () => {
  const other = (id: string, kids: TreeNode[]) => group(id, "sum", kids);
  const before = node({
    id: "root",
    role: "root",
    kids: [
      other("root/🔹 Other", [piece("a", 1), piece("b", 2)]),
      other("root/🔹 Other#2", [piece("c", 3), piece("d", 4)]),
    ],
  });
  // The game dropped the first group: the second one is now "🔹 Other", with the same pieces and values.
  const after = node({
    id: "root",
    role: "root",
    kids: [other("root/🔹 Other", [piece("c", 3), piece("d", 4)])],
  });
  expect(arrowsOf(after, baseOf(before).values).size).toBe(0);
});

test("a part beyond the live limit of 200 parts shows no arrow, nor moves its group's", () => {
  const parts = Array.from({ length: 205 }, (_, i) =>
    piece(`p${String(i)}`, 1),
  );
  const root = node({
    id: "root",
    role: "root",
    kids: [group("g", "sum", parts)],
  });
  const base = Object.fromEntries(
    parts.map((p) => [p.pieceKey ?? "", 2] as const),
  );
  const arrows = arrowsOf(root, base);
  expect(arrows.get("p0")).toEqual({ up: false, text: "▼ −1%" });
  expect(arrows.get("p199")).toEqual({ up: false, text: "▼ −1%" });
  expect(arrows.has("p200")).toBe(false);
  expect(arrows.has("p204")).toBe(false);
  // The group follows only what is followed: 200 parts went down by one.
  expect(arrows.get("g")).toEqual({ up: false, text: "▼ −200%" });
});

test("the root, followed live with its number, shows its own arrow", () => {
  const root = (value: number) =>
    node({
      id: "root",
      role: "root",
      pieceKey: '[0,"Total"]',
      value,
      fmt: "x",
    });
  expect(arrowsOf(root(2.5), baseOf(root(2)).values).get("root")).toEqual({
    up: true,
    text: "▲ +0.5",
  });
});

test("live grows with the pieces it did not have, at their value then, and never changes those it has; a mark's never grows", () => {
  const live = baseOf(tree(20));
  const extra = node({
    id: "root/Gem",
    role: "root",
    kids: [tree(30), piece("Gem", 5)],
  });
  const grown = growBase(live, extra);
  expect(grown.values).toEqual({ ...live.values, '[0,"Gem"]': 5 });
  expect(growBase(grown, extra)).toBe(grown);
  const m = baseOf(tree(20), mark("Mark 1", { '[0,"Ring"]': 25 }));
  expect(growBase(m, extra)).toBe(m);
});

test("a mark of the 0.8.0 keyed a scratch box by its path: it still holds the one piece of that box the tree has now", () => {
  const box = (id: string, key: string, value: number) =>
    node({ id, name: id, pieceKey: key, value, fmt: "+", role: "piece" });
  const root = node({
    id: "root",
    role: "root",
    kids: [
      box("Box", '[0,"DNSM.Box","Writer(1)",2]', 30),
      box("Twin A", '[0,"DNSM.Twin","Writer(1)",0]', 4),
      box("Twin B", '[0,"DNSM.Twin","Writer(1)",1]', 6),
    ],
  });
  const old = mark("Mark 1", { '[0,"DNSM.Box"]': 20, '[0,"DNSM.Twin"]': 1 });
  const arrows = arrowsOf(root, baseOf(root, old).values);
  expect(arrows.get("Box")).toEqual({ up: true, text: "▲ +10" });
  // two pieces of the box now: the old key says nothing of which one it was
  expect(arrows.has("Twin A")).toBe(false);
  expect(arrows.has("Twin B")).toBe(false);
});

test("an old key holds a piece only for a scratch box, and only when the whole tree has one piece of that box", () => {
  const box = (id: string, key: string, value: number) =>
    node({ id, name: id, pieceKey: key, value, fmt: "+", role: "piece" });
  // a part beyond the live limit of 200 parts still counts as a piece of its box
  const fill = Array.from({ length: 200 }, (_, i) => piece(`p${String(i)}`, 1));
  const root = node({
    id: "root",
    role: "root",
    kids: [
      box("Call", '[0,"Holes","Bravery",2]', 30),
      box("Near", '[0,"DNSM.Far","Writer(1)",0]', 4),
      ...fill,
      box("Far", '[0,"DNSM.Far","Writer(1)",1]', 6),
    ],
  });
  const old = mark("Mark 1", { '[0,"Holes"]': 20, '[0,"DNSM.Far"]': 1 });
  const arrows = arrowsOf(root, baseOf(root, old).values);
  expect(arrows.has("Call")).toBe(false);
  expect(arrows.has("Near")).toBe(false);
});
