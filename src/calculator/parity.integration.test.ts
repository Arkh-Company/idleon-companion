// Parity App = bench (spec 008 T027, SC-002), run by `just parity` on the machine with the bench, outside `just check`
// and the CI: it skips by itself unless PARITY_BENCH_DIR, PARITY_SNAPSHOT and PARITY_GAME_DIR name paths that exist.
// - PARITY_GAME_DIR: the installed game's `distBuild/static/game` folder, unpacked (`N.js` and `lib/default.pak`);
// - PARITY_SNAPSHOT: the snapshot (`attrs` and `skipped`, in a file whose name has no character name), with its
//   `vars-*.json` beside it, as the bench loads it;
// - PARITY_BENCH_DIR: a folder with `parity/dropRate.json`, the bench's Drop Rate tree without compaction
//   (`NO_COMPACT=1 TREE=<recording> OUT=<that file> node screen-proposal/build-v1mold.cjs`), and, when there is one,
//   `parity/reviewed-names.json`, the paths of the rows whose names wait on the 007 index.
// It prints counts and the bench's row paths only, never a value nor anything of the snapshot (FR-032).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import type { BenchRow, Difference } from "./parity-compare.ts";
import {
  activeCharacter,
  codeValueConflicts,
  compareTrees,
  mosaicOfSnapshot,
} from "./parity-compare.ts";
import type { CalcTreeNode } from "./tree-contract.ts";
import { createTreeEngine } from "./tree-engine.ts";
import type { TreeEngine } from "./tree-engine.ts";

const BENCH = process.env.PARITY_BENCH_DIR ?? "";
const SNAPSHOT = process.env.PARITY_SNAPSHOT ?? "";
const GAME = process.env.PARITY_GAME_DIR ?? "";
const READY = [BENCH, SNAPSHOT, GAME].every((p) => p !== "" && existsSync(p));
const ID = "dropRate";
/** A recording takes from 5 s to about 2 min, and every lazy branch is built after it (handoff, "Paridade fora do CI"). */
const BUILD_MS = 20 * 60_000;

const readJson = (file: string): unknown =>
  JSON.parse(readFileSync(file, "utf8"));

/** Every lazy branch built, as the window opens them one by one. */
function expandAll(engine: TreeEngine, n: CalcTreeNode): CalcTreeNode {
  const built =
    n.kids === "lazy"
      ? engine.tree({ type: "expand", treeId: ID, nodeId: n.id }, null)
      : n;
  if (built === "unknownNumber") throw new Error("the branch was refused");
  return {
    ...built,
    kids: Array.isArray(built.kids)
      ? built.kids.map((k) => expandAll(engine, k))
      : [],
  };
}

/** How many differences of each field, and the first paths: what goes to registro.md. */
function summary(found: Difference[]): string {
  const counts: Record<string, number> = {};
  for (const d of found) counts[d.field] = (counts[d.field] ?? 0) + 1;
  const first = found.slice(0, 20).map((d) => `${d.field}: ${d.path}`);
  return [JSON.stringify(counts), ...first].join("\n");
}

describe.skipIf(!READY)("parity of the Drop Rate tree with the bench", () => {
  let tree: CalcTreeNode;

  beforeAll(() => {
    const snap = readJson(SNAPSHOT) as { attrs: unknown; skipped?: unknown };
    const dir = dirname(SNAPSHOT);
    const varsFile = readdirSync(dir)
      .filter((f) => f.startsWith("vars-"))
      .sort()
      .at(-1);
    const mosaic = mosaicOfSnapshot(
      snap,
      varsFile ? readJson(join(dir, varsFile)) : {},
    );
    const engine = createTreeEngine(
      readFileSync(join(GAME, "N.js"), "utf8"),
      new Uint8Array(readFileSync(join(GAME, "lib", "default.pak"))),
    );
    const root = engine.tree(
      { type: "number", id: ID, character: activeCharacter(snap) },
      mosaic,
    );
    if (root === "unknownNumber") throw new Error("the Drop Rate has no root");
    tree = expandAll(engine, root);
  }, BUILD_MS);

  test(
    "every row matches the bench's in value, type, ⓘ and ?, and in name outside the reviewed list",
    () => {
      const benchFile = join(BENCH, "parity", `${ID}.json`);
      const reviewedFile = join(BENCH, "parity", "reviewed-names.json");
      const bench = (readJson(benchFile) as { tree: BenchRow }).tree;
      const reviewed = new Set(
        existsSync(reviewedFile) ? (readJson(reviewedFile) as string[]) : [],
      );
      const found = compareTrees(tree, bench, reviewed);
      expect(found.length, summary(found)).toBe(0);
    },
    BUILD_MS,
  );

  test(
    "no piece shows two values (the bench's code × value check)",
    () => {
      expect(codeValueConflicts(tree)).toEqual([]);
    },
    BUILD_MS,
  );
});
