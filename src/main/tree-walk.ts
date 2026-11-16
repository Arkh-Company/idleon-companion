// The walks of the formula pipeline over a checked tree (spec 008): none recursive, since a tree can be as deep as it
// has nodes.
import type { TreeNode } from "../shared/index.ts";

// ponytail: the first parts in the tree's order; a bigger tree's later parts do not light "Game changed" (FR-024).
const MAX_LIVE_PARTS = 200;

/** The parts the band follows (FR-024): every built row but the root, with a piece and a number, one per piece. */
export function partsOf(root: TreeNode): Map<string, TreeNode> {
  const parts = new Map<string, TreeNode>();
  const pending = Array.isArray(root.kids) ? root.kids.toReversed() : [];
  for (
    let n = pending.pop();
    n && parts.size < MAX_LIVE_PARTS;
    n = pending.pop()
  ) {
    if (
      n.pieceKey !== null &&
      typeof n.value === "number" &&
      !parts.has(n.pieceKey)
    )
      parts.set(n.pieceKey, n);
    if (Array.isArray(n.kids)) pending.push(...n.kids.toReversed());
  }
  return parts;
}

/** Walked without recursion: a checked tree can be as deep as it has nodes. */
export function countNodes(root: TreeNode): number {
  let count = 0;
  const pending = [root];
  for (let n = pending.pop(); n; n = pending.pop()) {
    count++;
    if (Array.isArray(n.kids)) pending.push(...n.kids);
  }
  return count;
}

/** The tree with the node `id` swapped for `make(node)`, the nodes above it copied; null when no node has that id. */
export function swapNode(
  root: TreeNode,
  id: string,
  make: (old: TreeNode) => TreeNode,
): TreeNode | null {
  // The path from the root, found without recursion; then each node on it copied from the bottom up.
  const pending: TreeNode[][] = [[root]];
  for (let path = pending.pop(); path; path = pending.pop()) {
    const n = path.at(-1);
    if (!n) continue;
    if (n.id === id) {
      let done = make(n);
      for (let i = path.length - 2; i >= 0; i--) {
        const up = path[i];
        const kids = up && Array.isArray(up.kids) ? up.kids : [];
        const old = path[i + 1];
        done = {
          ...up,
          kids: kids.map((k) => (k === old ? done : k)),
        } as TreeNode;
      }
      return done;
    }
    if (Array.isArray(n.kids))
      for (const k of n.kids) pending.push([...path, k]);
  }
  return null;
}

/**
 * The tree with the branch in place of the lazy row `nodeId`, with its count of nodes; with no branch, one of another
 * row, or one past `max` nodes, the row unavailable and `refused`. Null when no row has that id.
 */
export function withBranch(
  root: TreeNode,
  nodeId: string,
  branch: TreeNode | null,
  max: number,
): { root: TreeNode; nodes: number; refused: boolean } | null {
  const placed =
    branch?.id === nodeId ? swapNode(root, nodeId, () => branch) : null;
  const nodes = placed ? countNodes(placed) : 0;
  if (placed && nodes <= max) return { root: placed, nodes, refused: false };
  const off = swapNode(root, nodeId, (old) => ({
    ...old,
    flags: { ...old.flags, unavailable: true },
    kids: [],
  }));
  return off && { root: off, nodes: countNodes(off), refused: true };
}
