// What leaves the tree worker is checked before it reaches the window (FR-010, FR-010b): the shape, the size and only
// atoms. Every value and name here is invented.
import { expect, test } from "vitest";
import type { TreeNode } from "../shared/index.ts";
import { node } from "./formula-fixture.ts";
import { checkTree } from "./tree-check.ts";

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
