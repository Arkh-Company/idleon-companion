// A tree by its pieces (spec 008 FR-024, FR-025; spec 009 FR-013): a mark is the values by piece of a tree, the arrows of
// "Changes" compare by piece, and the main follows the parts live. A piece is its `pieceKey`, so only a change of value
// counts, never a change of order. Every walk is flat: a tree can be as deep as it has nodes.
import type { TreeNode } from "./formula-tree.ts";

type Value = number | boolean;

/** Every node of the tree, each before its children. */
export function preorder(root: TreeNode): TreeNode[] {
  const out: TreeNode[] = [];
  const pending = [root];
  for (let n = pending.pop(); n; n = pending.pop()) {
    out.push(n);
    if (Array.isArray(n.kids)) pending.push(...n.kids);
  }
  return out;
}

/** The value of each piece of the tree; a row with no piece or unavailable has none. What a mark saves. */
export function pieceValues(root: TreeNode): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const n of preorder(root))
    if (n.pieceKey !== null && n.value !== null) out[n.pieceKey] = n.value;
  return out;
}

// ponytail: the first parts in the tree's order; a bigger tree's later parts keep their built value and show no
// arrow (spec 009 NFR-003).
const MAX_LIVE_PARTS = 200;

/** The parts followed live (FR-024; spec 009 NFR-003): every built row but the root, with a piece and a number, one per
 * piece. The main asks their values and the window shows arrows only on them. */
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
