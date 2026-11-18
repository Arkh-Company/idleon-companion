// The calls the tree engine records beside a tree's root (spec 009, FR-018; tree-recipe.ts `EXTRA_ROOTS`): both a
// `number` tree and a `shape` record the root first and then each extra call, so the tree's root stays the same.
import { expect, test, vi } from "vitest";
import { GAME, mosaicOf, PAK } from "./fixtures/fake-mosaic.ts";
import { EXTRA_ROOTS } from "./tree-recipe.ts";
import { TREE_ROOTS } from "./tree-roots.ts";

const recorded: unknown[][] = [];
vi.mock("./tree-record.ts", async (original) => {
  const real = await original<typeof import("./tree-record.ts")>();
  return {
    ...real,
    bootRecorder: (...args: Parameters<typeof real.bootRecorder>) => {
      const recorder = real.bootRecorder(...args);
      return {
        ...recorder,
        record: (...call: Parameters<typeof recorder.record>) => {
          recorded.push([...call[1]]);
          return recorder.record(...call);
        },
      };
    },
  };
});

test("a number tree and a shape record the root, then the extra calls", async () => {
  const { createTreeEngine } = await import("./tree-engine.ts");
  const root = ["TreeMaxOf", [0, 0, 0]] as const;
  const trees = createTreeEngine(GAME, PAK, { ...TREE_ROOTS, sources: root });
  const tree = trees.tree(
    { type: "number", id: "sources", character: 0 },
    mosaicOf(),
  );
  trees.shape("sources", mosaicOf());
  expect(recorded).toEqual([
    [root, ...EXTRA_ROOTS],
    [root, ...EXTRA_ROOTS],
  ]);
  // the tree's root is the root's call, not an extra one
  expect(tree !== "unknownNumber" && tree.code).toBe("TreeMaxOf(0, 0, 0)");
});
