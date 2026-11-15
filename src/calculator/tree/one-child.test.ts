// pieces.cjs `structurePass` at BASELINE-4 (tree/one-child.ts): a row whose one child has its value is that child, a
// leaf when the child is one, else with the child's rows; a vague name or a name that is only a sum takes the child's.
// Over a context written by hand (tree/places.ts `PlaceContext`), with invented names.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { isSum, ONE_CHILD } from "./one-child.ts";
import { makePlaces } from "./places.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { kidsOf, recNode } from "./tree-fixture.ts";

const leaf = (name: string, value: number): Row => ({
  node: row({
    pieceKey: null,
    value,
    code: `Stats.${name.replace(/\W/g, "")}`,
    name,
    leaf: "level",
    why: "its own why",
  }),
  open: null,
});
const lazy = (name: string, open: number, value = 6): Row => ({
  node: row({
    pieceKey: null,
    value,
    code: `Call${String(open)}()`,
    name,
    kids: "lazy",
    fmt: "+",
  }),
  open,
});

function placesOf(levels: Record<number, Row[]>) {
  return makePlaces({
    nodes: Array.from({ length: 20 }, (_, i) => recNode(i, `Call${String(i)}`)),
    bugs: [],
    keyOf: (n) => String(n.id),
    openXf: new Map(),
    explain: (id) => levels[id] ?? null,
    opened: () => null,
  });
}
const placeOne = (levels: Record<number, Row[]>, r: Row) => {
  const places = placesOf(levels);
  const [n] = places.place({ id: "root", code: "Root()" }, [r], 1, [0]);
  return { places, n };
};

test("a row whose one child is a leaf with its value is that leaf, with its own name, code and sign", () => {
  const { places, n } = placeOne(
    { 1: [leaf("Stamp level", 6)] },
    lazy("Drop bonus", 1),
  );
  expect(n).toMatchObject({
    name: "Drop bonus",
    code: "Call1()",
    fmt: "+",
    leaf: "level",
    why: "its own why",
    kids: [],
  });
  expect(places.expand(n?.id ?? "")).toBeNull();
  expect(n && checkTree(n, 1)).not.toBeNull();
});

test.each(["Multi", "Multiplier", "Bonus", "Value"])(
  "a row with the vague name %s takes its one leaf's name and code",
  (vague) => {
    const parent: Row = {
      ...lazy(vague, 1),
      node: { ...lazy(vague, 1).node, code: null },
    };
    const { n } = placeOne({ 1: [leaf("Stamp level", 6)] }, parent);
    expect([n?.name, n?.code, n?.flags]).toEqual([
      "Stamp level",
      "Stats.Stamplevel",
      {},
    ]);
  },
);

test("a vague name or a sum takes no generic name of its child (R14: a generic name names nothing)", () => {
  const generic = (r: Row): Row => ({
    ...r,
    node: { ...r.node, name: "Game value", flags: { unnamed: true } },
  });
  const one = placeOne(
    { 1: [generic(leaf("Stamp level", 6))] },
    lazy("Multiplier", 1),
  );
  expect([one.n?.name, one.n?.flags, one.n?.kids]).toEqual([
    "Multiplier",
    {},
    [],
  ]);
  const rows = placeOne(
    { 1: [generic(lazy("Total", 2))], 2: [leaf("A", 2), leaf("B", 4)] },
    lazy("Fixed +2", 1),
  );
  expect([rows.n?.name, rows.n?.flags]).toEqual(["Fixed +2", {}]);
});

test("a row whose one row is a group of the parts at 0 or at ×1 keeps it: the group is the app's (FR-014)", () => {
  const group = (role: "atZero" | "atOne", value: number): Row => ({
    node: row({
      pieceKey: null,
      value,
      code: null,
      name: role === "atZero" ? "At 0 (2)" : "At ×1 (2)",
      role,
      flags: { closed: true },
    }),
    open: null,
    group: [leaf("A", value), leaf("B", value)],
  });
  for (const [role, value] of [
    ["atZero", 0],
    ["atOne", 1],
  ] as const) {
    const { places, n } = placeOne(
      { 1: [group(role, value)] },
      lazy("Drop bonus", 1, value),
    );
    expect(n?.kids).toBe("lazy");
    expect(kidsOf(places.expand(n?.id ?? "")).map((k) => k.role)).toEqual([
      role,
    ]);
  }
});

test("a row whose one child is cut (the depth limit or a cycle) keeps it, and the child says it is cut", () => {
  const { places, n } = placeOne(
    { 1: [lazy("Inner", 2)] },
    lazy("Drop bonus", 1),
  );
  const kids = kidsOf(places.expand(n?.id ?? ""));
  expect(kids.map((k) => [k.name, k.kids])).toEqual([["Inner", "lazy"]]);
  expect(places.expand(kids[0]?.id ?? "")?.flags.truncated).toBe(true);
});

test("a row whose one child is a branch built already takes the branch's rows, placed with it; a vague name takes its name", () => {
  const branch: Row = {
    node: row({ pieceKey: null, value: 6, code: null, name: "Stamp parts" }),
    open: null,
    group: [leaf("A", 2), leaf("B", 4)],
  };
  const { n } = placeOne({ 1: [branch] }, lazy("Multiplier", 1));
  expect([n?.name, kidsOf(n).map((k) => k.name)]).toEqual([
    "Stamp parts",
    ["A", "B"],
  ]);
});

test("a row keeps its rows when its one child has another value, or it has two", () => {
  const two = placeOne(
    { 1: [leaf("A", 6), leaf("B", 6)] },
    lazy("Drop bonus", 1),
  );
  expect(two.n?.kids).toBe("lazy");
  const other = placeOne({ 1: [leaf("A", 5)] }, lazy("Drop bonus", 1));
  expect(other.n?.kids).toBe("lazy");
  expect(
    kidsOf(other.places.expand(other.n?.id ?? "")).map((k) => k.name),
  ).toEqual(["A"]);
});

test("a row whose one child has rows of its own takes those rows; a name that is only a sum takes the child's", () => {
  const levels = {
    1: [lazy("Stamp total", 2)],
    2: [leaf("A", 2), leaf("B", 4)],
  };
  const own = placeOne(levels, lazy("Drop bonus", 1));
  expect([own.n?.name, own.n?.kids]).toEqual(["Drop bonus", "lazy"]);
  expect(kidsOf(own.places.expand(own.n?.id ?? "")).map((k) => k.name)).toEqual(
    ["A", "B"],
  );
  const sum = placeOne(levels, lazy("Fixed +2", 1));
  expect(sum.n?.name).toBe("Stamp total");
});

test.each<[string, string, boolean]>([
  ["Fixed +2", "", true],
  ["2 × 3", "", true],
  ["(a + 1) ÷ 4", "", true],
  ["round(400)", "", true],
  ["Rounded 400", "round(400)", true],
  ["Rounded 400", "Total", false],
  ["Fixed + two", "", false],
  ["Bonus per level 2", "", false],
  ["Drop: +2", "", false],
])("[structurePass isSum] %s over %s: %s", (name, under, sum) => {
  expect(isSum(name, under)).toBe(sum);
});

test("a chain of rows with one child each is merged 8 times at most, as the bench's guard", () => {
  const levels: Record<number, Row[]> = {};
  for (let i = 1; i <= 10; i++)
    levels[i] = [lazy(`Step ${String(i + 1)}`, i + 1)];
  levels[11] = [leaf("A", 2), leaf("B", 4)];
  const { places, n } = placeOne(levels, lazy("Top", 1));
  const [next] = kidsOf(places.expand(n?.id ?? ""));
  // eight merges: the 9th step's row, placed with its own merges, is under the top
  expect(next?.name).toBe("Step 10");
});

test("every structurePass rule has a test", () => {
  expect(Object.keys(ONE_CHILD).sort()).toEqual(["sum", "vague"]);
});
