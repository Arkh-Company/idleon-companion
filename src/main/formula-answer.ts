// What the tree worker's answer to a `number` request becomes on screen (spec 008, data-model.md), and what a newer
// reading writes into it (spec 009 FR-015, in place of the 008's "Game changed · Refresh"). The root is checked against the Stats number (FR-019) and what the
// worker sends is checked before it reaches the window (FR-010b). No electron import, so tests can load it.
import {
  catalogName,
  isLiveNumber,
  rootText,
  statsNumber,
} from "../shared/index.ts";
import type {
  FormulaTree,
  LiveValues,
  TreeNode,
  TreeRequest,
} from "../shared/index.ts";
import type { StatsPair } from "./stats-pipeline.ts";
import { checkTree } from "./tree-check.ts";
import { countNodes, withValues } from "./tree-walk.ts";

/** Drop Rate without compaction is about 5,000 rows (plan, Scale). */
export const MAX_TREE_NODES = 20_000;

/** A structured log entry: a label and a catalog id, never a value of the math or a name (FR-019, FR-010a). */
export type FormulaLog =
  | { event: "treeDiverged"; label: string; id: string }
  | { event: "treeRejected"; id: string }
  | { event: "treeFailed"; id: string }
  | { event: "chainOpen"; id: string };

/** The tree to show for the worker's answer `raw` to `asked`, with the log entry of a refusal or a divergence. */
export function treeAnswer(
  raw: unknown,
  asked: {
    request: Extract<TreeRequest, { type: "number" }>;
    pair: StatsPair;
    active: number;
  },
  on: {
    /** The tree with the counts of Where this goes (FR-027). */
    fed: (root: TreeNode) => TreeNode;
    checkedOnThisGame: boolean;
    stale: boolean;
  },
): { tree: FormulaTree; log?: FormulaLog } {
  const { request, pair, active } = asked;
  const checked = checkTree(raw, MAX_TREE_NODES);
  if (!checked)
    return {
      tree: { state: "unavailable", request },
      log: { event: "treeRejected", id: request.id },
    };
  // A live-game number with no value at its root: the actor it reads was not on the map (US12, FR-023).
  if (isLiveNumber(request.id) && checked.value === null)
    return { tree: { state: "unavailable", request, liveMap: true } };
  const stats = statsNumber(request.id);
  const statsValue = stats
    ? pair.numbers[request.id as keyof StatsPair["numbers"]]
    : null;
  const textOf = (v: unknown) =>
    typeof v === "number" ? rootText(request.id, v) : "unavailable";
  if (stats && request.character === active && checked.value !== statsValue)
    return {
      tree: { state: "diverged", request, statsText: textOf(statsValue) },
      log: { event: "treeDiverged", label: stats.label, id: request.id },
    };
  const root = on.fed(checked);
  return {
    tree: {
      state: "ready",
      request,
      title: stats?.label ?? catalogName(request.id) ?? request.id,
      rootText: textOf(root.value),
      statsValue,
      character: request.character,
      activeCharacter: active,
      calculatedAt: pair.calculatedAt,
      checkedOnThisGame: on.checkedOnThisGame,
      stale: on.stale,
      counts: { nodes: countNodes(root) },
      root,
    },
  };
}

type Ready = Extract<FormulaTree, { state: "ready" }>;

/**
 * What a reading newer than the open tree changes in it (spec 009 FR-015): the tree with the number's value and text and
 * each followed part's value written in place, and the parts that had a live value (in `had`) and lost it; null when
 * nothing moved, or with no number at the root (values that failed ask nothing again, or a failing worker would be asked
 * each second). Any change asks the tree again in silence, so its ⓘ and shares close with the live values. Only the active
 * character's tree, the live values being the active character's, and never over a closed game.
 */
export function liveTree(
  tree: Ready,
  v: LiveValues,
  parts: ReadonlyMap<string, TreeNode>,
  had: ReadonlySet<string>,
): { tree: Ready; lost: string[] } | null {
  if (
    tree.request.type !== "number" ||
    tree.character !== tree.activeCharacter ||
    tree.stale ||
    v.calculatedAt <= tree.calculatedAt
  )
    return null;
  const { id } = tree.request;
  const now = v.values[id];
  if (typeof now !== "number") return null;
  const rootMoved = now !== tree.root.value;
  const moved = new Map<string, number>();
  const lost: string[] = [];
  for (const [key, n] of parts) {
    const x = v.values[key];
    if (typeof x === "number") {
      if (x !== n.value) moved.set(key, x);
    } else if (x === null && had.has(key)) lost.push(key);
  }
  if (!rootMoved && moved.size === 0 && lost.length === 0) return null;
  return {
    tree:
      rootMoved || moved.size > 0
        ? {
            ...tree,
            root: withValues(tree.root, moved, rootMoved ? now : undefined),
            ...(rootMoved ? { rootText: rootText(id, now) } : {}),
          }
        : tree,
    lost,
  };
}

/** spec 009 FR-015, NFR-002: at most one silent rebuild in this time since the last tree came, so the worker stays free
 * for the live values of each reading (decision of 18/11). */
export const REBUILD_EVERY_MS = 10_000;

/** When the open tree is asked again in silence: after a change, at most every `REBUILD_EVERY_MS` since a tree came. */
export function rebuildClock(now: () => number = Date.now) {
  let due = false;
  let at = 0;
  /** The reading of the last change. */
  let changedAt = 0;
  return {
    /** A live value of the reading at `calculatedAt` moved: the tree waits to be asked again. */
    changed(calculatedAt: number) {
      due = true;
      changedAt = Math.max(changedAt, calculatedAt);
    },
    /** A tree of the reading at `calculatedAt` came: the time starts again, and a change of that reading or an older one
     * is done. A change of a later reading still waits. */
    came(calculatedAt: number) {
      at = now();
      if (calculatedAt >= changedAt) due = false;
    },
    /** A tree asked in silence failed: the time starts again. The change that asked it was taken; only a change that
     * came while it was asked still waits. */
    failed() {
      at = now();
    },
    /** The ms until `take(free)` is true, 0 when it is now; null when no change waits or the pipeline is busy. */
    wait(free: boolean): number | null {
      if (!due || !free) return null;
      return Math.max(0, REBUILD_EVERY_MS - (now() - at));
    },
    /** True, once, when a change waits, the pipeline is `free` and the time is past: the caller asks the tree. */
    take(free: boolean): boolean {
      if (!due || !free || now() - at < REBUILD_EVERY_MS) return false;
      due = false;
      return true;
    },
  };
}
