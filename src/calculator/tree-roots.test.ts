// The roots of the trees are pinned against the catalog of src/shared and against the Stats' TARGETS (T007).
import { expect, test } from "vitest";
import { TREE_CATALOG } from "../shared/index.ts";
import { TARGETS } from "./targets.ts";
import { TREE_ROOTS } from "./tree-roots.ts";

const ids = TREE_CATALOG.map((n) => n.id);

test("every catalog id has one root, and every root is in the catalog", () => {
  expect(new Set(ids).size).toBe(ids.length);
  expect(Object.keys(TREE_ROOTS).sort()).toEqual([...ids].sort());
});

test("the Stats numbers have the Stats' block and first argument", () => {
  for (const [id, block, arg] of TARGETS) {
    const [rootBlock, args] = TREE_ROOTS[id] ?? ["", []];
    expect([rootBlock, args[0]]).toEqual([block, arg]);
  }
});

test("a root is a block name and simple arguments, never a phrase of the game", () => {
  for (const [block, args] of Object.values(TREE_ROOTS)) {
    expect(block).toMatch(/^\w+$/);
    for (const arg of args)
      if (typeof arg === "string") expect(arg).toMatch(/^[\w-]+$/);
      else expect(Number.isInteger(arg)).toBe(true);
  }
});
