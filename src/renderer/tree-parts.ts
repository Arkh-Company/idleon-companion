// Which rows of an open node show (spec 008 FR-014; design.md C15): the parts that weigh most, in the game's order, the
// near-zero ones in "Small (N)" and the rest behind "Show all N parts". The groups the worker built stay at the end.
import type { TreeNode } from "../shared/index.ts";

const GROUP_ROLES = new Set<TreeNode["role"]>(["atZero", "atOne", "small"]);
/** A row of the tree's mould (no piece of its own): At 0, At ×1, Small. */
export const isGroup = (n: TreeNode) => GROUP_ROLES.has(n.role);
const RANKED = new Set<TreeNode["shareMode"]>([
  "sum",
  "product",
  "productZero",
]);
/** C15's starting thresholds (FR-014: proposals for the prototype). */
const ALL_UP_TO = 10;
const LARGEST = { min: 5, max: 10, cover: 0.9, small: 0.005 };

/** C15: the parts that weigh most, in the game's order; the near-zero ones in "Small"; the rest behind "Show all". */
export function partition(kids: TreeNode[]): {
  shown: TreeNode[];
  small: TreeNode[];
  hidden: number;
  groups: TreeNode[];
} {
  const groups = kids.filter(isGroup);
  const parts = kids.filter((k) => !isGroup(k));
  if (parts.length <= ALL_UP_TO)
    return { shown: parts, small: [], hidden: 0, groups };
  const ranked = parts.filter(
    (k) =>
      k.share !== null &&
      RANKED.has(k.shareMode) &&
      k.leaf !== "fixedValue" &&
      k.leaf !== "condition",
  );
  if (!ranked.length) {
    const shown = parts.slice(0, ALL_UP_TO);
    return { shown, small: [], hidden: parts.length - shown.length, groups };
  }
  const share = (k: TreeNode) => k.share ?? 0;
  const small = ranked.filter((k) => share(k) < LARGEST.small);
  const total = ranked.reduce((s, k) => s + share(k), 0);
  const top = new Set<TreeNode>();
  let covered = 0;
  for (const k of ranked
    .filter((r) => !small.includes(r))
    .sort((a, b) => share(b) - share(a))) {
    if (
      top.size >= LARGEST.max ||
      (top.size >= LARGEST.min && covered >= LARGEST.cover * total)
    )
      break;
    top.add(k);
    covered += share(k);
  }
  const shown = [
    ...parts.filter((k) => top.has(k)),
    ...parts.filter((k) => k.share === null),
  ];
  return {
    shown,
    small,
    hidden: parts.length - shown.length - small.length,
    groups,
  };
}

/** The set with `key` added, or removed when it was there. */
export function flip(s: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(s);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
