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
import type { Arrow } from "./tree-changes.ts";
import {
  reachedText,
  shareText,
  spokenValue,
  valueClass,
  ZEROES,
} from "./tree-text.ts";
import { valueText } from "../shared/index.ts";
import { truthTags, TruthTags } from "./TruthTag.tsx";

/** The phrases of a row's detail, by key: its type's (design.md C4), then its honesty tags' (C7). */
export const phrasesOf = (n: TreeNode): [key: string, phrase: string][] => [
  ...(n.leaf ? [["type", leafPhrase(n)] as [string, string]] : []),
  ...truthTags(n).flatMap((t, i): [string, string][] =>
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
        className={`row lvl-${String(Math.min(level - 1, WIDE_CAP))}`}
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
          activate,
        ),
      )}
    </ul>
  );
}

/** "▲ +10%" read aloud: "up 10%" (never by color nor symbol alone, design.md §3.8). */
const spokenArrow = (a: Arrow) =>
  `${a.up ? "up" : "down"} ${a.text.replace(/^[▲▼] [+−]/, "")}`;

const isGroup = (n: TreeNode) => n.role === "pool" || n.role === "system";

/** A pool's or group's "N sources" (spec 009 FR-002): each row that adds into it, through its groups; never a group. */
function sourcesText(n: TreeNode): string {
  if (!isGroup(n) || !Array.isArray(n.kids)) return "";
  let k = 0;
  const pending = [...n.kids];
  for (let r = pending.pop(); r; r = pending.pop())
    if (isGroup(r) && Array.isArray(r.kids)) pending.push(...r.kids);
    else k++;
  return `${String(k)} ${k === 1 ? "source" : "sources"}`;
}

/** A part's line and what the reader says of it: name, value, share when on, arrow, sources, reach, uses, type and
 * tags. */
export function partLine(
  n: TreeNode,
  {
    name,
    root,
    rootText,
    share: shareOn,
    arrow,
    onFeeds,
  }: {
    name: string;
    /** The root's value is the Stats text the main sends (FR-019). */
    root: boolean;
    rootText: string;
    /** The share toggle (spec 009 FR-014); "zeroes the total" shows either way. */
    share: boolean;
    /** The row's change with "Changes" on (spec 009 FR-013). */
    arrow: Arrow | null;
    onFeeds: () => void;
  },
): { label: string; line: ReactNode } {
  const value = root ? rootText : valueText(n);
  const tags = truthTags(n);
  const all = shareText(n);
  const share = shareOn || all === ZEROES ? all : null;
  const reached = reachedText(n);
  const label = [
    name,
    root ? rootText.replace(/x$/, " times") : spokenValue(n),
    share,
    arrow && spokenArrow(arrow),
    sourcesText(n),
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
      <span className={valueClass(n)}>{value}</span>
      {arrow && (
        <span className={`arrow arrow--${arrow.up ? "up" : "down"}`}>
          {arrow.text}
        </span>
      )}
      {share && <span className="share">{share}</span>}
    </>
  );
  return { label, line };
}
