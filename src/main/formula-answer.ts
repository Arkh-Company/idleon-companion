// What the tree worker's answer to a `number` request becomes on screen (spec 008, data-model.md), and when the band
// "Game changed · Refresh" lights over it (FR-024). The root is checked against the Stats number (FR-019) and what the
// worker sends is checked before it reaches the window (FR-010b). No electron import, so tests can load it.
import {
  catalogName,
  compareTrees,
  isLiveNumber,
  rootText,
  statsNumber,
  valueText,
} from "../shared/index.ts";
import type {
  FormulaTree,
  LiveValues,
  TreeNode,
  TreeRequest,
} from "../shared/index.ts";
import type { StatsPair } from "./stats-pipeline.ts";
import { checkTree } from "./tree-check.ts";
import { countNodes } from "./tree-walk.ts";

/** Drop Rate without compaction is about 5,000 rows (plan, Scale). */
export const MAX_TREE_NODES = 20_000;

/** A structured log entry: a label and a catalog id, never a value of the math or a name (FR-019, FR-010a). */
export type FormulaLog =
  | { event: "treeDiverged"; label: string; id: string }
  | { event: "treeRejected"; id: string };

/** The tree to show for the worker's answer `raw` to `asked`, with the log entry of a refusal or a divergence. */
export function treeAnswer(
  raw: unknown,
  asked: {
    request: Extract<TreeRequest, { type: "number" }>;
    pair: StatsPair;
    active: number;
    /** The tree on screen before a Refresh: the new one shows "was …" against it (FR-024). */
    before: TreeNode | null;
  },
  on: {
    /** The tree with the counts of Where this goes (FR-027). */
    fed: (root: TreeNode) => TreeNode;
    checkedOnThisGame: boolean;
    stale: boolean;
  },
): { tree: FormulaTree; log?: FormulaLog } {
  const { request, pair, active, before } = asked;
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
  const root = on.fed(before ? compareTrees(before, checked).withWas : checked);
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
      gameChanged: false,
      checkedOnThisGame: on.checkedOnThisGame,
      stale: on.stale,
      comparingWith: null,
      counts: { nodes: countNodes(root) },
      root,
    },
  };
}

/**
 * "Game changed · Refresh" (FR-024): in a reading newer than the tree's, the open number's text or the text of one of
 * its open parts is not the tree's; a counter that moves none of them changes nothing. Only the active character's tree,
 * the live values being the active character's; never twice, nor over a closed game.
 */
export function gameChangedBy(
  tree: Extract<FormulaTree, { state: "ready" }>,
  v: LiveValues,
  parts: ReadonlyMap<string, TreeNode>,
): boolean {
  if (
    tree.request.type !== "number" ||
    tree.character !== tree.activeCharacter ||
    tree.gameChanged ||
    tree.stale ||
    v.calculatedAt <= tree.calculatedAt
  )
    return false;
  const { id } = tree.request;
  const now = v.values[id];
  const moved = ([key, n]: [string, TreeNode]) => {
    const value = v.values[key];
    return (
      typeof value === "number" &&
      valueText({ value, fmt: n.fmt }) !== valueText(n)
    );
  };
  return (
    (typeof now === "number" && rootText(id, now) !== tree.rootText) ||
    [...parts].some(moved)
  );
}
