// The rows of the formula tree (spec 008 FR-006, FR-013, FR-015a, FR-027; design.md C2, C4, C7, C15, §3.8): one
// treeitem of the APG treeview, the line a part shows and what a screen reader says of it.
import type { ReactNode } from "react";
import type { TreeNode } from "../shared/index.ts";
import { FeedsBadge, feedsText } from "./FeedsBadge.tsx";
import {
  leafLabel,
  leafPhrase,
  LeafTag,
  LevelTag,
  WIDE_CAP,
} from "./LeafTag.tsx";
import type { Visible } from "./tree-keys.ts";
import { isGroup } from "./tree-parts.ts";
import {
  reachedText,
  rowChange,
  shareText,
  spokenValue,
  valueClass,
  valueText,
} from "./tree-text.ts";
import { truthTags, TruthTags } from "./TruthTag.tsx";

/** The phrases of a row's detail, by key: its type's (design.md C4), then its honesty tags' (C7); a group has none. */
export const phrasesOf = (n: TreeNode): [key: string, phrase: string][] => [
  ...(n.leaf ? [["type", leafPhrase(n)] as [string, string]] : []),
  ...(isGroup(n) ? [] : truthTags(n)).flatMap((t, i): [string, string][] =>
    t.phrase ? [[`truth${String(i)}`, t.phrase]] : [],
  ),
];

/** What a row needs of the tree it is drawn in, for one render. */
export interface RowCtx {
  /** The visible rows in order, filled as the rows are drawn, for the keys. */
  visible: Visible[];
  /** The row in the Tab order. */
  active: string;
  isOpen: (key: string) => boolean;
  /** A tap: the row becomes the active one and takes the focus. */
  focus: (key: string) => void;
  toggle: (key: string) => void;
}

/** One treeitem: its line, and the rows inside drawn only when it is open. */
export function treeItem(
  ctx: RowCtx,
  key: string,
  level: number,
  pos: [number, number],
  parent: string | null,
  label: string,
  line: ReactNode,
  /** Drawn only when open: the rows inside are visible only then. */
  inside: (() => ReactNode) | null,
  expandable: boolean,
  changed = false,
  activate?: () => void,
): ReactNode {
  const expanded = expandable && ctx.isOpen(key);
  ctx.visible.push({ key, parent, expandable, expanded, activate });
  return (
    <li
      key={key}
      role="treeitem"
      data-key={key}
      aria-label={label}
      aria-level={level}
      aria-posinset={pos[0]}
      aria-setsize={pos[1]}
      {...(expandable ? { "aria-expanded": expanded } : {})}
      tabIndex={key === ctx.active ? 0 : -1}
    >
      <div
        className={`row lvl-${String(Math.min(level - 1, WIDE_CAP))}${changed ? " changed" : ""}`}
        onClick={() => {
          ctx.focus(key);
          if (activate) activate();
          else if (expandable) ctx.toggle(key);
        }}
      >
        <span className="twisty" aria-hidden="true">
          {expandable ? (expanded ? "▾" : "▸") : ""}
        </span>
        <LevelTag level={level} />
        {line}
      </div>
      {expanded && inside?.()}
    </li>
  );
}

/** The rows inside an informative row (the two lines of the math, the pairs of Game details and its Copy): treeitems
 * that do not open, so the arrows reach them and the reader says their text (design.md §3.8); Enter does `activate`. */
export function treeLines(
  ctx: RowCtx,
  parent: string,
  level: number,
  rows: [label: string, line: ReactNode, activate?: () => void][],
): ReactNode {
  return (
    <ul role="group">
      {rows.map(([label, line, activate], i) =>
        treeItem(
          ctx,
          `${parent}::${String(i)}`,
          level,
          [i + 1, rows.length],
          parent,
          label,
          line,
          null,
          false,
          false,
          activate,
        ),
      )}
    </ul>
  );
}

/** A part's line and what the reader says of it: name, value, share, change, reach, uses, type and tags. */
export function partLine(
  n: TreeNode,
  {
    name,
    root,
    rootText,
    closedChange,
    onFeeds,
  }: {
    name: string;
    /** The root's value is the Stats text the main sends (FR-019); its `was` is in the header. */
    root: boolean;
    rootText: string;
    /** Closed with a change below it: `changed inside` (design.md C11). */
    closedChange: boolean;
    onFeeds: () => void;
  },
): { label: string; line: ReactNode; was: boolean | undefined } {
  const group = isGroup(n);
  const value = root ? rootText : valueText(n);
  const tags = group ? [] : truthTags(n);
  const share = group ? null : shareText(n);
  const reached = reachedText(n);
  const change = rowChange(root ? undefined : n.was, n.fmt, closedChange);
  const label = [
    name,
    group ? "" : root ? rootText.replace(/x$/, " times") : spokenValue(n),
    share,
    change?.spoken,
    reached,
    n.feeds === undefined ? "" : feedsText(n.feeds),
    leafLabel(n),
    ...tags.map((t) => t.spoken),
    n.formula ? "has a calculation" : "",
  ]
    .filter(Boolean)
    .join(", ");
  const line = (
    <>
      <span className="name">{name}</span>
      {reached && <span className="reached">{reached}</span>}
      <LeafTag n={n} />
      <TruthTags tags={tags} />
      {n.feeds !== undefined && <FeedsBadge count={n.feeds} onTap={onFeeds} />}
      {!group && <span className={valueClass(n)}>{value}</span>}
      {change && <span className="was">{change.text}</span>}
      {share && <span className="share">{share}</span>}
      {share &&
        n.share !== null &&
        (n.shareMode === "sum" || n.shareMode === "product") && (
          <meter min={0} max={1} value={n.share} aria-hidden="true" />
        )}
    </>
  );
  return { label, line, was: change?.was };
}
