// No unnamed step inside a level (spec 009, FR-007, FR-008): a branch with no code of the game and no proven name gives
// its parts to the level above when they sum (or multiply) as the level does, so every level still closes; its ⓘ is the
// level's whole sum or product.
import { expect, test } from "vitest";
import type { CalcTreeNode } from "../tree-contract.ts";
import { flatten } from "./flatten.ts";
import { makePlaces } from "./places.ts";
import { row, withShares } from "./rows.ts";
import type { Row } from "./rows.ts";
import { read, recNode } from "./tree-fixture.ts";

/** A level's rows with their shares in a parent of value `v`, as rows.ts `finish` leaves them. */
const level = (v: number, rows: Row[]): Row[] =>
  withShares({ name: "", value: v }, null, rows).rows;
/** A branch of parts with no code; `name` undefined is the generic one, `unnamed`. */
const branch = (value: number, parts: Row[], name?: string): Row => ({
  node: row({
    pieceKey: null,
    value,
    code: null,
    ...(name === undefined ? {} : { name }),
  }),
  open: null,
  group: level(value, parts),
});
const codes = (rows: readonly Row[]) => rows.map((r) => r.node.code);
const kidsOf = (n: CalcTreeNode | null | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];

/** Game value (2 × 3) × Multiplier (2 × 2) × Invented.x 5 = 120. */
const product = () =>
  level(120, [
    branch(6, [read("Invented.a", 2), read("Invented.b", 3)]),
    branch(4, [read("Invented.c", 2), read("Invented.d", 2)], "Multiplier"),
    read("Invented.x", 5),
  ]);

test("an unnamed step and a step named by its shape give their parts to the level, which still multiplies to its parent", () => {
  const rows = flatten(product());
  expect(codes(rows)).toEqual([
    "Invented.a",
    "Invented.b",
    "Invented.c",
    "Invented.d",
    "Invented.x",
  ]);
  expect(rows.reduce((a, r) => a * Number(r.node.value), 1)).toBe(120);
});

test("the row above has the whole product as its ⓘ, and it closes", () => {
  const places = makePlaces({
    nodes: [recNode(0, "Root"), recNode(1, "Upper")],
    bugs: [],
    keyOf: (n) => String(n.id),
    openXf: new Map(),
    explain: (id) => (id === 1 ? product() : null),
    opened: () => null,
  });
  const upper: Row = {
    node: row({ pieceKey: "u", value: 120, code: "Upper()", kids: "lazy" }),
    open: 1,
  };
  const [placed] = places.place(
    { id: "root", code: "Root()" },
    [upper],
    1,
    [0],
  );
  const opened = places.expand(placed?.id ?? "");
  expect(kidsOf(opened).map((k) => [k.code, k.value])).toEqual([
    ["Invented.a", 2],
    ["Invented.b", 3],
    ["Invented.c", 2],
    ["Invented.d", 2],
    ["Invented.x", 5],
  ]);
  expect(opened?.formula).toEqual([
    [
      "Invented.a",
      "×",
      "Invented.b",
      "×",
      "Invented.c",
      "×",
      "Invented.d",
      "×",
      "Invented.x",
    ],
    [2, 3, 2, 2, 5, 120],
  ]);
});

test.each(["Multiplier", "Fixed +2", "Multiplier from 3 sources", "Value"])(
  "a name by its shape only (%s) does not hold the row",
  (name) => {
    const rows = flatten(
      level(10, [
        branch(7, [read("Invented.a", 3), read("Invented.b", 4)], name),
        read("Invented.x", 3),
      ]),
    );
    expect(codes(rows)).toEqual(["Invented.a", "Invented.b", "Invented.x"]);
  },
);

test("a proven name holds the row, and so does a row with a code of the game", () => {
  const parts = () => [read("Invented.a", 3), read("Invented.b", 4)];
  const coded: Row = {
    node: row({ pieceKey: "k", value: 7, code: "Invented()" }),
    open: null,
    group: level(7, parts()),
  };
  const rows = flatten(
    level(17, [
      branch(7, parts(), "Bonus per kill"),
      coded,
      read("Invented.x", 3),
    ]),
  );
  expect(rows.map((r) => [r.node.name, r.group?.length ?? 0])).toEqual([
    ["Bonus per kill", 2],
    [expect.any(String), 2],
    [expect.any(String), 0],
  ]);
});

test("nested unnamed steps flatten all the way, and the level still sums to its parent", () => {
  const rows = flatten(
    level(10, [
      branch(9, [
        read("Invented.a", 2),
        branch(7, [read("Invented.b", 3), read("Invented.c", 4)]),
      ]),
      read("Invented.x", 1),
    ]),
  );
  expect(codes(rows)).toEqual([
    "Invented.a",
    "Invented.b",
    "Invented.c",
    "Invented.x",
  ]);
  expect(rows.reduce((a, r) => a + Number(r.node.value), 0)).toBe(10);
});

test("a step that sums inside a product stays: its parts would not multiply to the parent (FR-008)", () => {
  const sum = branch(5, [read("Invented.a", 2), read("Invented.b", 3)]);
  const rows = flatten(level(20, [sum, read("Invented.x", 4)]));
  expect(rows.map((r) => [r.node.value, r.group?.length ?? 0])).toEqual([
    [5, 2],
    [4, 0],
  ]);
});

test("a step whose parts do not give its value stays, as does one with a check among its parts", () => {
  const off = branch(8, [read("Invented.a", 2), read("Invented.b", 3)]);
  const check: Row = {
    node: row({
      pieceKey: null,
      value: 1,
      code: null,
      leaf: "condition",
      condition: "owned",
    }),
    open: null,
    test: "Invented.flag = 1",
  };
  const guarded = branch(7, [read("Invented.c", 7), check]);
  const rows = flatten(level(16, [off, guarded, read("Invented.x", 1)]));
  expect(rows.map((r) => r.group?.length ?? 0)).toEqual([2, 2, 0]);
});

test("a game-bug part keeps its tag after flattening (FR-016 of the 008)", () => {
  const places = makePlaces({
    nodes: [recNode(0, "Root"), recNode(1, "Upper")],
    bugs: [
      {
        id: "countedTwice",
        in: /^Upper\(\)$/,
        test: /^Invented\.a$/,
        proof: "an invented rule",
      },
    ],
    keyOf: (n) => String(n.id),
    openXf: new Map(),
    explain: (id) => (id === 1 ? product() : null),
    opened: () => null,
  });
  const [placed] = places.place(
    { id: "root", code: "Root()" },
    [
      {
        node: row({ pieceKey: "u", value: 120, code: "Upper()", kids: "lazy" }),
        open: 1,
      },
    ],
    1,
    [0],
  );
  const [a] = kidsOf(places.expand(placed?.id ?? ""));
  expect([a?.code, a?.flags.gameBug]).toEqual(["Invented.a", "countedTwice"]);
});
