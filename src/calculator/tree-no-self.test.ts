// A row is never a child of itself (spec 009 T023, decision of 18/11): a read of a scratch box whose write is being
// opened above it has no rows of its own. Over the invented game: TreeZeroTotal adds zeros to a box and reads it
// back, as the game's Fishing Toolkit adds each tool's weight and line.
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "./fixtures/fake-mosaic.ts";
import type { CalcTreeNode } from "./tree-contract.ts";
import { buildTree } from "./tree-build.ts";
import { bootRecorder } from "./tree-record.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});

/** Each row whose piece is the piece of a row above it, as the path of names down to it; 12 levels at most. */
function insideItself(block: string): string[] {
  const build = buildTree(
    recorder.record(mosaicOf(), [[block, []]], { recompute: [], builders: [] }),
    0,
    recorder.ops,
  );
  const out: string[] = [];
  const walk = (n: CalcTreeNode, above: string[], path: string): void => {
    if (n.pieceKey !== null && above.includes(n.pieceKey)) out.push(path);
    if (above.length > 12) return;
    const kids = n.kids === "lazy" ? (build.expand(n.id)?.kids ?? []) : n.kids;
    const next = n.pieceKey === null ? above : [...above, n.pieceKey];
    if (Array.isArray(kids))
      for (const k of kids) walk(k, next, `${path} > ${k.name}`);
  };
  walk(build.root, [], build.root.name);
  return out;
}

test("a running total its own block reads back: no row shows inside itself", () => {
  expect(insideItself("TreeZeroTotal")).toEqual([]);
});
