// A scratch box read is the write it saw (fix/tree-scratch-keys, decision of 18/11): the same box read at two moments is
// two pieces, also when the write is the builders' pass's or the box holds the object whose field is read, and a read
// of an earlier write of the box being opened keeps that write's source. Over the invented game, by its recorder.
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "./fixtures/fake-mosaic.ts";
import type { Recipe } from "./recording.ts";
import type { CalcTreeNode } from "./tree-contract.ts";
import { buildTree } from "./tree-build.ts";
import { bootRecorder } from "./tree-record.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});

const NONE: Recipe = { recompute: [], builders: [] };
/** Every row of the tree of `block`, its lazy branches opened, with the path of names down to it; 12 levels at most. */
function rowsOf(block: string, recipe = NONE, args: number[] = []) {
  const build = buildTree(
    recorder.record(mosaicOf(), [[block, args]], recipe),
    0,
    recorder.ops,
  );
  const out: { n: CalcTreeNode; above: string[] }[] = [];
  const walk = (n: CalcTreeNode, above: string[]): void => {
    out.push({ n, above });
    const kids = n.kids === "lazy" ? (build.expand(n.id)?.kids ?? []) : n.kids;
    if (Array.isArray(kids) && above.length < 12)
      for (const k of kids) walk(k, [...above, n.pieceKey ?? ""]);
  };
  walk(build.root, []);
  return out;
}

test("a field of the box that holds the item in turn: the running total is read at its own place, so no item's read is a row (T231)", () => {
  // the old tree follows the read's place too, by Vinicius's decision ("a antiga não me importa"); it goes in Phase 11
  const reads = rowsOf("TreeWorn")
    .map(({ n }) => n)
    .filter((n) => n.code === "DNSM.TreeWornNow.v");
  expect(reads.map((n) => [n.pieceKey, n.value])).toEqual([]);
});

test("a scratch box the builders' pass wrote twice: the cache's read of it is the pass's last write", () => {
  const recipe: Recipe = {
    recompute: [],
    builders: [
      {
        cache: "TreeWhoCache",
        run: { block: "TreeWho", args: [-1] },
        keepLive: true,
      },
    ],
  };
  const reads = rowsOf("TreeWho", recipe, [0])
    .map(({ n }) => n)
    .filter((n) => n.code === "DNSM.TreeWho");
  expect(reads.map((n) => [n.pieceKey, n.value])).toEqual([
    [JSON.stringify([0, "DNSM.TreeWho", "TreeWho(-1)", 1]), 29],
  ]);
});

test("a running total that starts from a source and adds 0: its read is its last write, and no row is inside itself", () => {
  const rows = rowsOf("TreeStartTotal");
  const box = rows.find(({ n }) => n.code === "DNSM.TreeStart[0]");
  expect(box?.n.pieceKey).toBe(
    JSON.stringify([0, "DNSM.TreeStart[0]", "TreeStartTotal()", 3]),
  );
  const inside = rows.filter(
    ({ n, above }) => n.pieceKey !== null && above.includes(n.pieceKey),
  );
  expect(inside).toEqual([]);
});

// The box opens into its turn whose read of the box saw the start, a write before the loop's turns: that read is no total
// of the earlier turns, and opens into what the start copied (Vinicius, 19/11)
test("a running total that starts from a source and adds 0: the start keeps its source under the box", () => {
  const rows = rowsOf("TreeStartTotal");
  const box = rows.find(({ n }) => n.code === "DNSM.TreeStart[0]");
  const under = rows.filter(
    ({ above }) => box && above.includes(box.n.pieceKey ?? "-"),
  );
  // the value the box starts with comes from TreeBase: the read of that write opens into it
  expect(under.map(({ n }) => n.code)).toContain("TreeBase");
});
