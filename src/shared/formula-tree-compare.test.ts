// The diff of two trees by their pieces (spec 008 FR-024, FR-025): what Refresh and a mark show as "was …". Every value
// and name is invented.
import { expect, test } from "vitest";
import {
  changes,
  compareTrees,
  compareValues,
  pieceValues,
} from "./formula-tree-compare.ts";
import type { TreeNode } from "./formula-tree.ts";

const node = (over: Partial<TreeNode> = {}): TreeNode => ({
  id: "root",
  pieceKey: '[0,"Total"]',
  name: "Total",
  value: 10,
  fmt: null,
  leaf: null,
  condition: null,
  why: null,
  formula: null,
  code: null,
  role: "root",
  share: null,
  shareMode: null,
  flags: {},
  kids: [],
  ...over,
});

const part = (
  name: string,
  value: number | boolean | null,
  kids: TreeNode[] = [],
) =>
  node({
    id: `root/${name}`,
    pieceKey: `[0,"${name}"]`,
    name,
    value,
    role: "piece",
    kids,
  });

const tree = (total: number, parts: TreeNode[]) =>
  node({ value: total, kids: parts });

/** Every node of a tree by id, walked flat. */
function byId(root: TreeNode): Map<string, TreeNode> {
  const out = new Map<string, TreeNode>();
  const pending = [root];
  for (let n = pending.pop(); n; n = pending.pop()) {
    out.set(n.id, n);
    if (Array.isArray(n.kids)) pending.push(...n.kids);
  }
  return out;
}

test("the diff by pieceKey fills `was` on each piece whose value changed, and on nothing else", () => {
  const before = tree(10, [part("Sword", 4), part("Ring", 6)]);
  const after = tree(12, [part("Sword", 6), part("Ring", 6)]);
  const { changed, withWas } = compareTrees(before, after);
  expect([...changed].sort()).toEqual(["root", "root/Sword"]);
  const rows = byId(withWas);
  expect(rows.get("root")?.was).toBe(10);
  expect(rows.get("root/Sword")?.was).toBe(4);
  expect(rows.get("root/Ring")).not.toHaveProperty("was");
  expect(rows.get("root/Sword")?.value).toBe(6);
});

test("only the order of the parts changed: no change", () => {
  const before = tree(10, [part("Sword", 4), part("Ring", 6)]);
  const after = tree(10, [part("Ring", 6), part("Sword", 4)]);
  const { changed, withWas } = compareTrees(before, after);
  expect(changed.size).toBe(0);
  expect([...byId(withWas).values()].some((n) => "was" in n)).toBe(false);
});

test("a counter or timer that moves no number of the tree does not count as a change (FR-024)", () => {
  // The kill counter is not a piece of the math: the same tree comes back, so nothing lights.
  const before = tree(10, [part("Sword", 4), part("Ring", 6)]);
  const after = tree(10, [part("Sword", 4), part("Ring", 6)]);
  expect(compareTrees(before, after).changed.size).toBe(0);
});

test("a part new, gone, or unavailable now has no `was`; a `was` from an earlier compare does not stay", () => {
  const before = tree(10, [part("Sword", 4), part("Old", 6)]);
  const after = tree(10, [{ ...part("Sword", null), was: 1 }, part("New", 6)]);
  const rows = byId(compareTrees(before, after).withWas);
  expect(rows.get("root/Sword")).not.toHaveProperty("was");
  expect(rows.get("root/New")).not.toHaveProperty("was");
});

test("a yes/no piece that flips is a change", () => {
  const before = tree(10, [part("Owned", false)]);
  const after = tree(10, [part("Owned", true)]);
  expect(byId(compareTrees(before, after).withWas).get("root/Owned")?.was).toBe(
    false,
  );
});

test("a mark is only values by piece: the same compare, from them (FR-025)", () => {
  const before = tree(10, [part("Sword", 4)]);
  const values = pieceValues(before);
  expect(values).toEqual({ '[0,"Total"]': 10, '[0,"Sword"]': 4 });
  const after = tree(11, [part("Sword", 5)]);
  expect(compareValues(values, after).changed).toEqual(
    compareTrees(before, after).changed,
  );
});

test("pieceValues keeps neither a row with no piece nor one unavailable", () => {
  const values = pieceValues(
    tree(10, [
      part("Leaf", 1),
      part("Gone", null),
      node({ id: "g", pieceKey: null, value: 3 }),
    ]),
  );
  expect(values).toEqual({ '[0,"Total"]': 10, '[0,"Leaf"]': 1 });
});

test("a tree as deep as it has nodes compares without recursion", () => {
  const chain = (leaf: number) => {
    let deep = part("Leaf", leaf);
    for (let i = 0; i < 50_000; i++)
      deep = node({
        id: `d${String(i)}`,
        pieceKey: null,
        value: 1,
        kids: [deep],
      });
    return tree(10, [deep]);
  };
  const { changed, withWas } = compareTrees(chain(1), chain(2));
  expect([...changed]).toEqual(["root/Leaf"]);
  expect(changes(withWas).inside.size).toBe(50_001);
});

test("changes lists the rows with a `was` and the rows with one inside them (`changed inside`)", () => {
  const before = tree(10, [
    part("Gear", 4, [part("Sword", 1)]),
    part("Ring", 6),
  ]);
  const after = tree(10, [
    part("Gear", 4, [part("Sword", 2)]),
    part("Ring", 6),
  ]);
  const { withWas } = compareTrees(before, after);
  const { ids, inside } = changes(withWas);
  expect([...ids]).toEqual(["root/Sword"]);
  expect([...inside].sort()).toEqual(["root", "root/Gear"]);
});
