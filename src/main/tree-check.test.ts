// What leaves the tree worker is checked before it reaches the window (FR-010, FR-010b): the shape, the size and only
// atoms. Every value and name here is invented.
import { expect, test } from "vitest";
import type { TreeNode } from "../shared/index.ts";
import { node } from "./formula-fixture.ts";
import { checkTree, MAX_NODE_ID } from "./tree-check.ts";

const MAX = 50;

test("a whole tree with every field passes as it is", () => {
  const tree = node({
    was: 2,
    cap: "notReached",
    maxReached: { share: 0.62, max: 40 },
    feeds: 3,
    flags: { unnamed: true, closed: true, gameBug: "doubleCount" },
    kids: [
      node({
        id: "root/Base",
        role: "step",
        leaf: "condition",
        condition: "owned",
        value: false,
        share: 0.4,
        why: "No name yet",
        kids: "lazy",
      }),
      node({ id: "root/Bonus", role: "piece", leaf: "level", value: null }),
    ],
  });
  expect(checkTree(tree, MAX)).toEqual(tree);
});

test.each<[string, unknown]>([
  ["not an object", "a tree"],
  ["null", null],
  ["an unknown field", { ...node(), extra: 1 }],
  ["an unknown flag", node({ flags: { other: true } as never })],
  ["a flag of the wrong type", node({ flags: { closed: "yes" } as never })],
  [
    "a game bug that is free text, not a rule's id",
    node({ flags: { gameBug: "counts the same source twice" } }),
  ],
  [
    "a missing field",
    (() => {
      const n: Partial<TreeNode> = node();
      delete n.role;
      return n;
    })(),
  ],
  ["an id that is not text", node({ id: 7 as never })],
  ["a value that is text", node({ value: "12" as never })],
  ["a value that is not finite", node({ value: Number.NaN })],
  ["a format outside the list", node({ fmt: "%%" as never })],
  ["a leaf outside the list", node({ leaf: "other" as never })],
  ["a condition outside the list", node({ condition: "other" as never })],
  ["a role outside the list", node({ role: "other" as never })],
  ["a share above 1", node({ share: 1.5 })],
  ["a share mode outside the list", node({ shareMode: "other" as never })],
  ["a cap outside the list", node({ cap: "other" as never })],
  ["feeds under 2", node({ feeds: 1 })],
  ["a maxReached without max", node({ maxReached: { share: 0.5 } as never })],
  [
    "a formula with a number among the names",
    node({ formula: [[1], [1]] as never }),
  ],
  ["kids that are not a list", node({ kids: "later" as never })],
  ["a child of the wrong shape", node({ kids: [{ id: "x" } as never] })],
  [
    "a code snippet in the formula",
    node({ formula: [["function(){return 1}"], [1]] }),
  ],
  ["an arrow in the formula", node({ formula: [["a => a"], [1]] })],
  ["a code snippet in the name", node({ name: "var x = s.h.Bonus;" })],
  ["the game's call in the name", node({ name: "_customBlock_Invented" })],
  [
    "a code snippet in a child's name",
    node({ kids: [node({ name: "{ x: 1 }" })] }),
  ],
  ["a code snippet in the code", node({ code: "if (a && b) return c" })],
  ["a text too long", node({ name: "x".repeat(201) })],
  [
    "a rule with a code snippet",
    node({ formula: { rule: ["If a && b: 35", "yes → 35"] } }),
  ],
  [
    "a rule line too long",
    node({ formula: { rule: ["x".repeat(201), "yes → 35"] } }),
  ],
  [
    "a rule with three lines",
    node({ formula: { rule: ["If a: 35", "yes → 35", "x"] } as never }),
  ],
  [
    "a rule with a number for a line",
    node({ formula: { rule: ["If a: 35", 35] } as never }),
  ],
  [
    "a rule with another field",
    node({ formula: { rule: ["If a: 35", "yes → 35"], x: 1 } as never }),
  ],
])("%s gives null", (_name, raw) => {
  expect(checkTree(raw, MAX)).toBe(null);
});

test("a row 17 names deep passes: its id and piece key are as long as a node id may be", () => {
  const path = Array.from(
    { length: 17 },
    (_, i) => `Invented bonus name number ${String(i)}#2`,
  ).join("/");
  expect(path.length).toBeGreaterThan(200);
  const deep = node({ id: path, pieceKey: `[0,"InventedBlock","${path}"]` });
  expect(checkTree(node({ kids: [deep] }), MAX)).not.toBe(null);
  expect(checkTree(node({ id: "x".repeat(MAX_NODE_ID) }), MAX)).not.toBe(null);
  expect(checkTree(node({ id: "x".repeat(MAX_NODE_ID + 1) }), MAX)).toBe(null);
});

test.each<[string, Partial<TreeNode>]>([
  ["a why in a player's words", { why: "Owned check: 1 if you have it." }],
  ["a name with if and new", { name: "Bonus if new card found" }],
  [
    "formula names with let and return",
    {
      formula: [
        ["Return rate", "let go"],
        [1, 2],
      ],
    },
  ],
  [
    "a rule's two lines",
    { formula: { rule: ["If Owned bonus: 35", "yes → 35"] } },
  ],
])("%s passes", (_name, over) => {
  expect(checkTree(node(over), MAX)).not.toBe(null);
});

test.each<[string, Partial<TreeNode>]>([
  ["a keyword before ( in a why", { why: "if (owned) 1" }],
  ["a keyword before { in a name", { name: "function{}" }],
  ["function() in the formula", { formula: [["function(){}"], [1]] }],
  ["a lone keyword in the code", { code: "return x" }],
])("%s is still refused", (_name, over) => {
  expect(checkTree(node(over), MAX)).toBe(null);
});

// spec 009 (FR-011, SEC-003, contracts/tree-node.md): a pool and a system group carry how they combine, and no piece
const pool = (over: Partial<TreeNode> = {}) =>
  node({
    id: "root/Additive pool",
    name: "Additive pool",
    role: "pool",
    pieceKey: null,
    code: null,
    combine: "sum",
    poolKind: "additive",
    ...over,
  });
const group = (over: Partial<TreeNode> = {}) =>
  pool({
    id: "root/Additive pool/⚗️ Alchemy",
    name: "⚗️ Alchemy",
    role: "system",
    poolKind: null,
    ...over,
  });
/** The node with the field left out, as the worker's JSON sends a field it has not. */
const without = (n: TreeNode, field: "combine" | "poolKind") => {
  const { combine, poolKind, ...rest } = n;
  return field === "combine" ? { ...rest, poolKind } : { ...rest, combine };
};

test.each<[string, TreeNode]>([
  ["an additive pool that sums", pool()],
  [
    "a multi pool that multiplies",
    pool({ name: "Multi pool 1", poolKind: "multi", combine: "product" }),
  ],
  ["a pool of 1 + percent", pool({ combine: "onePlusPercent" })],
  ["a system group with no pool kind", group()],
  ["a system group that multiplies", group({ combine: "product" })],
  ["a system group of a max at the root", group({ combine: "max" })],
  ["a system group of a min at the root", group({ combine: "min" })],
  ["a tree of a pool with a group inside", pool({ kids: [group()] })],
])("%s passes", (_name, tree) => {
  expect(checkTree(tree, MAX)).toEqual(tree);
});

test.each<[string, unknown]>([
  ["a combine outside the list", pool({ combine: "average" as never })],
  ["a pool kind outside the list", pool({ poolKind: "other" as never })],
  ["a pool with no combine", without(pool(), "combine")],
  ["a pool with no pool kind", without(pool(), "poolKind")],
  ["a pool whose pool kind is null", pool({ poolKind: null })],
  ["a pool whose combine is null", pool({ combine: null })],
  ["a system group with no combine", without(group(), "combine")],
  ["a system group with no pool kind", without(group(), "poolKind")],
  ["a system group with a pool kind", group({ poolKind: "multi" })],
  ["a pool with a piece key", pool({ pieceKey: '[0,"InventedBlock"]' })],
  ["a system group with a piece key", group({ pieceKey: '[0,"Invented"]' })],
  ["a piece row with a combine", node({ role: "piece", combine: "sum" })],
  ["a piece row with a null combine", node({ role: "piece", combine: null })],
  ["a step with a pool kind", node({ role: "step", poolKind: "additive" })],
  ["a root with a null pool kind", node({ poolKind: null })],
  [
    "a pool among the kids of a root",
    node({ kids: [pool({ combine: "x" as never })] }),
  ],
  ["a pool name with the game's code", pool({ name: "_customBlock_X" })],
  ["a group name with the game's code", group({ name: "⚗️ _customBlock_X" })],
])("%s gives null", (_name, raw) => {
  expect(checkTree(raw, MAX)).toBe(null);
});

test("more nodes than the limit gives null, and the limit itself passes", () => {
  const kids = (n: number) =>
    Array.from({ length: n }, (_, i) => node({ id: `root/${String(i)}` }));
  expect(checkTree(node({ kids: kids(MAX - 1) }), MAX)).not.toBe(null);
  expect(checkTree(node({ kids: kids(MAX) }), MAX)).toBe(null);
});

test("a tree deeper than the limit gives null without overflowing", () => {
  let deep = node();
  for (let i = 0; i < 100_000; i++) deep = node({ kids: [deep] });
  expect(checkTree(deep, MAX)).toBe(null);
});
