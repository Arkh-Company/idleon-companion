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
  const pieces = Object.fromEntries(
    Object.entries(base).filter(([k]) => followed.has(k)),
  );
  const before = valuesOf(root, pieces);
  const now = valuesOf(root);
  const out = new Map<string, Arrow>();
  for (const n of preorder(root)) {
    const a = arrowOf(n, before.get(n.id), now.get(n.id));
    if (a) out.set(n.id, a);
  }
  return out;
}
