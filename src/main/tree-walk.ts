// The walks of the formula pipeline over a checked tree (spec 008): none recursive, since a tree can be as deep as it
// has nodes.
import { preorder } from "../shared/index.ts";
import type { TreeNode } from "../shared/index.ts";

/**
 * The tree with `values` (by piece) in each row of that piece, and `rootValue` as the root's (spec 009 FR-015): the rows
 * that change and the rows above them copied, the rest shared. Children first, flat.
 */
export function withValues(
  root: TreeNode,
  values: ReadonlyMap<string, number>,
  rootValue?: number,
): TreeNode {
  const order = preorder(root);
  const copies = new Map<TreeNode, TreeNode>();
  for (let i = order.length - 1; i >= 0; i--) {
    const n = order[i];
    if (!n) continue;
    const old = n.kids;
    const kids = Array.isArray(old) ? old.map((k) => copies.get(k) ?? k) : old;
    const key = n.pieceKey;
    const value =
      n === root && rootValue !== undefined
        ? rootValue
        : key !== null && values.has(key)
          ? (values.get(key) ?? n.value)
          : n.value;
    const below =
      Array.isArray(old) &&
      Array.isArray(kids) &&
      kids.some((k, j) => k !== old[j]);
    if (value !== n.value || below) copies.set(n, { ...n, value, kids });
  }
  return copies.get(root) ?? root;
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
