// The diff of two trees by their pieces (spec 008 FR-024, FR-025; plan, formula-tree-compare): Refresh compares the tree
// before with the new one, and a mark is the values by piece of a tree, compared the same way. A piece is its `pieceKey`,
// so only a change of value counts, never a change of order. Every walk is flat: a tree can be as deep as it has nodes.
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

const SCRATCH_PATH = /^(?:DNSM|DummyNumbersStatManager)\./;
/** The box of a scratch key of `length` items whose path is at `at`: the items up to its path; else null. */
function boxOf(key: string, at: number, length: number): string | null {
  try {
    const k: unknown = JSON.parse(key);
    return Array.isArray(k) &&
      k.length === length &&
      typeof k[at] === "string" &&
      SCRATCH_PATH.test(k[at])
      ? JSON.stringify(k.slice(0, at + 1))
      : null;
  } catch {
    return null;
  }
}
/**
 * fix/tree-scratch-keys: the 0.8.0 kept a scratch box by its path ([path], after the character when the key has it, at
 * `at`); now a box read at two moments is two pieces ([path, writer, write]). Each old key of `old` not in `now` stands
 * for the one piece of its box in `now`, when there is only one: old key → new key.
 */
export function oldBoxKeys(
  old: Iterable<string>,
  now: Iterable<string>,
  at: number,
): Map<string, string> {
  const keys = new Set(now);
  const byBox = new Map<string, string[]>();
  for (const k of keys) {
    const box = boxOf(k, at, at + 3);
    if (box) byBox.set(box, [...(byBox.get(box) ?? []), k]);
  }
  const out = new Map<string, string>();
  for (const k of old) {
    const [only, ...more] = byBox.get(boxOf(k, at, at + 1) ?? "") ?? [];
    if (!keys.has(k) && only !== undefined && !more.length) out.set(k, only);
  }
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

/** The ids of the rows with a `was`, and of the rows with one below them (design.md C11, `changed inside`). */
export function changes(root: TreeNode): {
  ids: Set<string>;
  inside: Set<string>;
} {
  const ids = new Set<string>();
  const inside = new Set<string>();
  const parent = new Map<TreeNode, TreeNode>();
  for (const n of preorder(root)) {
    if (Array.isArray(n.kids)) for (const k of n.kids) parent.set(k, n);
    if (n.was === undefined) continue;
    ids.add(n.id);
    // Up to the first row already marked: the rows above it are marked too.
    for (let up = parent.get(n); up && !inside.has(up.id); up = parent.get(up))
      inside.add(up.id);
  }
  return { ids, inside };
}

/** The tree with `was` on each piece whose value differs from `before`'s, and on no other row. */
export function compareValues(
  before: Readonly<Record<string, Value>>,
  b: TreeNode,
): { changed: Set<string>; withWas: TreeNode } {
  const order = preorder(b);
  const copies = new Map<TreeNode, TreeNode>();
  // Children before parents, so each copy takes its children's copies.
  for (let i = order.length - 1; i >= 0; i--) {
    const n = order[i];
    if (!n) continue;
    const copy: TreeNode = {
      ...n,
      kids: Array.isArray(n.kids)
        ? n.kids.map((k) => copies.get(k) ?? k)
        : n.kids,
    };
    delete copy.was;
    const old =
      n.pieceKey !== null && Object.hasOwn(before, n.pieceKey)
        ? before[n.pieceKey]
        : undefined;
    if (old !== undefined && n.value !== null && old !== n.value)
      copy.was = old;
    copies.set(n, copy);
  }
  const withWas = copies.get(b) ?? b;
  return { changed: changes(withWas).ids, withWas };
}

/** `b` with `was` from `a`, piece by piece (Refresh, FR-024). */
export function compareTrees(
  a: TreeNode,
  b: TreeNode,
): { changed: Set<string>; withWas: TreeNode } {
  return compareValues(pieceValues(a), b);
}
