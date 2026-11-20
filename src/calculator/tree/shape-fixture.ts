// The trees of the invented game's shapes of the Drop Rate and the max damage (fake-game.js TreeShapeMulti and
// TreeShapeCaps; fix tree-shape-091), shared by their tests: the state they read, and each row under a row, built or
// opened. Invented values.
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { buildTree } from "../tree-build.ts";
import type { TreeBuild } from "../tree-build.ts";
import { bootRecorder } from "../tree-record.ts";

let recorder: ReturnType<typeof bootRecorder> | null = null;

/** The tree of `block` over the invented state: the charm 3 at 15, the companions 26, 160 and 50 owned. */
export function shapeTree(block: string): TreeBuild {
  recorder ??= bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
  return buildTree(
    recorder.record(
      mosaicOf({
        TreeCharms: [0, 0, 0, 15],
        DummyNumbersStatManager: { $m: { DamageDealtLIST: [30, 8, 6] } },
        DNSM: { $m: { CompanionBon: { $m: { 26: 0.3, 160: 1, 50: 50 } } } },
      }),
      [[block, []]],
      { recompute: [], builders: [] },
    ),
    0,
    recorder.ops,
  );
}

/** The rows of `n`, opened in `build` when they are still to build. */
export function kidsOpen(
  build: TreeBuild,
  n: CalcTreeNode | null | undefined,
): CalcTreeNode[] {
  if (!n) return [];
  const kids = n.kids === "lazy" ? (build.expand(n.id)?.kids ?? []) : n.kids;
  return Array.isArray(kids) ? kids : [];
}

/** An ⓘ as its two lines, from its atoms or its rule. */
export const linesOf = (f: CalcTreeNode["formula"] | undefined): string[] =>
  Array.isArray(f) ? [f[0].join(" "), f[1].join(" ")] : f ? [...f.rule] : [];

/** The names the assembly gives a constant of the game's code by its place, which a pool never shows loose. */
export const CONSTANT =
  /^(?:Base |Percent to number|× |Minimum |Cap |Minus |Exponent |Divided by |Fixed ×)/;
