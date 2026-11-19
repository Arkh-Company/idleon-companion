// The arrows of "Changes" (spec 009 FR-013, NFR-003; research R5): each row's change against a base, in the row's own
// unit ("▲ +10%" on a +% row, "▲ +0.12" on a × row). The base is kept by piece only: "live" is the tree's pieces frozen
// at the click, a mark is its pieces as saved (008). A pool's or group's value is rebuilt from its rows by `combine`, on
// the tree on screen, so a group whose id changed owner when the tree was rebuilt never shows a false arrow.
import {
  MINUS,
  partsOf,
  pieceValues,
  plain,
  preorder,
} from "../shared/index.ts";
import type { Mark, TreeNode } from "../shared/index.ts";

type Value = number | boolean;

export interface Arrow {
  up: boolean;
  text: string;
}

/** What the arrows compare with: `mark` null is "live". */
export interface Base {
  mark: string | null;
  values: Readonly<Record<string, Value>>;
}

/** Changes turned on, or a mark chosen or cleared: the mark's values, else "live", the tree's pieces now. */
export function baseOf(root: TreeNode, mark: Mark | null = null): Base {
  return mark
    ? { mark: mark.name, values: mark.values }
    : { mark: null, values: pieceValues(root) };
}

/** "Live" grows with the pieces it did not have, at their value now (a branch opened after the click), and never changes
 * those it has; a mark's base never grows. The same base when nothing is new. */
export function growBase<B extends Base>(base: B, root: TreeNode): B {
  if (base.mark !== null) return base;
  const added = Object.entries(pieceValues(root)).filter(
    ([k]) => !Object.hasOwn(base.values, k),
  );
  return added.length === 0
    ? base
    : { ...base, values: { ...base.values, ...Object.fromEntries(added) } };
}

/** A pool's or group's value from its rows' `values` (by id), by its `combine`; null when a row has none. A group
 * whose rows are not built yet keeps its own value. */
export function groupValue(
  n: TreeNode,
  values: ReadonlyMap<string, Value | null>,
): number | null {
  const own = typeof n.value === "number" ? n.value : null;
  if (!Array.isArray(n.kids) || n.kids.length === 0) return own;
  const vals: number[] = [];
  for (const k of n.kids) {
    const v = values.has(k.id) ? values.get(k.id) : k.value;
    if (typeof v !== "number") return null;
    vals.push(v);
  }
  const sum = vals.reduce((a, x) => a + x, 0);
  switch (n.combine) {
    case "sum":
      return sum;
    case "product":
      return vals.reduce((a, x) => a * x, 1);
    case "onePlusPercent":
      return 1 + sum / 100;
    case "percent":
      return sum / 100;
    case "max":
      return Math.max(...vals);
    case "min":
      return Math.min(...vals);
    default:
      return own;
  }
}

/** Every row's value by id: a piece's from `pieces` when it is there (else its own), a pool's or a group's rebuilt
 * from its rows. Children first, flat: a tree can be as deep as it has nodes. */
export function valuesOf(
  root: TreeNode,
  pieces: Readonly<Record<string, Value>> = {},
): Map<string, Value | null> {
  const out = new Map<string, Value | null>();
  for (const n of preorder(root).toReversed()) {
    const key = n.pieceKey;
    out.set(
      n.id,
      n.combine
        ? groupValue(n, out)
        : key !== null && Object.hasOwn(pieces, key)
          ? (pieces[key] ?? null)
          : n.value,
    );
  }
  return out;
}

/** The arrow of a row from `before` to `now`, in its unit; null with no change or a value that is not a number. */
export function arrowOf(
  row: Pick<TreeNode, "fmt"> & Partial<Pick<TreeNode, "combine">>,
  before: Value | null | undefined,
  now: Value | null | undefined,
): Arrow | null {
  if (typeof before !== "number" || typeof now !== "number" || before === now)
    return null;
  // a group of bonuses in % shows its bonuses' sum in % (valueText), so its arrow does too
  const pct = row.combine === "percent";
  const d = pct ? (now - before) * 100 : now - before;
  const up = d > 0;
  const unit = pct || row.fmt === "%" ? "%" : "";
  return {
    up,
    text: `${up ? "▲ +" : `▼ ${MINUS}`}${plain(Math.abs(d))}${unit}`,
  };
}

/** A scratch box's key as the 0.8.0 kept it, [character, path]; and the [character, path] of a key of now. */
const boxOf = (key: string, length: number): string | null => {
  try {
    const k: unknown = JSON.parse(key);
    return Array.isArray(k) && k.length === length
      ? JSON.stringify(k.slice(0, 2))
      : null;
  } catch {
    return null;
  }
};
/**
 * fix/tree-scratch-keys: a mark of the 0.8.0 kept a scratch box by its path; now a box read at two moments is two pieces
 * ([character, path, writer, write]). The old key holds the box's piece when the tree has only one of that box.
 */
function rematched(
  base: Readonly<Record<string, Value>>,
  keys: ReadonlySet<string>,
): Record<string, Value> {
  const byBox = new Map<string, string[]>();
  for (const k of keys) {
    const box = boxOf(k, 4);
    if (box) byBox.set(box, [...(byBox.get(box) ?? []), k]);
  }
  const out: Record<string, Value> = {};
  for (const [k, v] of Object.entries(base)) {
    if (keys.has(k)) {
      out[k] = v;
      continue;
    }
    const now = byBox.get(boxOf(k, 2) ?? "") ?? [];
    const [only] = now;
    if (only !== undefined && now.length === 1 && !Object.hasOwn(base, only))
      out[only] = v;
  }
  return out;
}

/**
 * The arrow of every row of the tree against `base` (by piece). Only the parts followed live take the base (NFR-003):
 * a part past the limit shows its built value on both sides, so neither it nor its group gets a false arrow.
 */
export function arrowsOf(
  root: TreeNode,
  base: Readonly<Record<string, Value>>,
): Map<string, Arrow> {
  const followed = new Set(partsOf(root).keys());
  if (root.pieceKey !== null) followed.add(root.pieceKey);
  const pieces = rematched(base, followed);
  const before = valuesOf(root, pieces);
  const now = valuesOf(root);
  const out = new Map<string, Arrow>();
  for (const n of preorder(root)) {
    const a = arrowOf(n, before.get(n.id), now.get(n.id));
    if (a) out.set(n.id, a);
  }
  return out;
}
