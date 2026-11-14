// The tree of one number, opened in place like folders (spec 008 FR-006, FR-014, FR-031; design.md C2, C5, C6, C8, C10,
// C15, §3.8): the APG treeview whole, one Tab stop with a roving tabindex, ↑ ↓ → ← Home End Enter. A lazy branch asks
// its rows when it opens and says "calculating this part…" until they come.
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { changes } from "../shared/index.ts";
import type { FormulaTree as Tree, TreeNode } from "../shared/index.ts";
import {
  leafLabel,
  leafPhrase,
  LeafTag,
  LevelTag,
  WIDE_CAP,
} from "./LeafTag.tsx";
import {
  formulaLines,
  GROUP_SUFFIX,
  reachedText,
  rowChange,
  shareText,
  spokenValue,
  valueClass,
  valueText,
} from "./tree-text.ts";
import { flip, isGroup, partition } from "./tree-parts.ts";
import { truthTags, TruthTags } from "./TruthTag.tsx";

type Ready = Extract<Tree, { state: "ready" }>;

const detail = (term: string, text: string) => (
  <>
    <span className="name">{term}</span>
    <span className="code">{text}</span>
  </>
);

/** The phrases of a row's detail, by key: its type's (design.md C4), then its honesty tags' (C7); a group has none. */
const phrasesOf = (n: TreeNode): [key: string, phrase: string][] => [
  ...(n.leaf ? [["type", leafPhrase(n)] as [string, string]] : []),
  ...(isGroup(n) ? [] : truthTags(n)).flatMap((t, i): [string, string][] =>
    t.phrase ? [[`truth${String(i)}`, t.phrase]] : [],
  ),
];

interface Visible {
  key: string;
  parent: string | null;
  expandable: boolean;
  expanded: boolean;
}

export function FormulaTree({
  tree,
  onExpand,
}: {
  tree: Ready;
  onExpand: (nodeId: string) => void;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set([tree.root.id]),
  );
  const [showAll, setShowAll] = useState<ReadonlySet<string>>(() => new Set());
  const [active, setActive] = useState(tree.root.id);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const asked = useRef(new Set<string>());
  const ref = useRef<HTMLUListElement>(null);
  /** The rows with a change below them: closed, they say `changed inside` (design.md C11). */
  const changedInside = useMemo(() => changes(tree.root).inside, [tree.root]);

  useEffect(() => {
    if (focusKey === null) return;
    const items =
      ref.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [];
    [...items].find((i) => i.dataset.key === focusKey)?.focus();
  }, [focusKey]);

  // Walked during the render: the visible rows in order, for the keys.
  const visible: Visible[] = [];
  const nodes = new Map<string, TreeNode>();

  function toggle(key: string): void {
    if (key.endsWith("::all")) {
      const id = key.slice(0, -"::all".length);
      setShowAll((s) => flip(s, id));
      return;
    }
    const n = nodes.get(key);
    if (n?.kids === "lazy" && !open.has(key) && !asked.current.has(key)) {
      asked.current.add(key);
      onExpand(n.id);
    }
    setOpen((s) => flip(s, key));
  }

  function item(
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
  ): ReactNode {
    const expanded =
      expandable &&
      (key.endsWith("::all") ? showAll.has(key.slice(0, -5)) : open.has(key));
    visible.push({ key, parent, expandable, expanded });
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
        tabIndex={key === active ? 0 : -1}
      >
        <div
          className={`row lvl-${String(Math.min(level - 1, WIDE_CAP))}${changed ? " changed" : ""}`}
          onClick={() => {
            setActive(key);
            setFocusKey(key);
            if (expandable) toggle(key);
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

  function info(
    n: TreeNode,
    level: number,
    at: () => [number, number],
  ): ReactNode[] {
    const out = phrasesOf(n).map(([key, phrase]) =>
      item(
        `${n.id}::${key}`,
        level,
        at(),
        n.id,
        phrase,
        <span className="phrase">{phrase}</span>,
        null,
        false,
      ),
    );
    if (n.formula) {
      const f = formulaLines(n.formula);
      const label = `How it adds up = ${f.result}`;
      out.push(
        item(
          `${n.id}::how`,
          level,
          at(),
          n.id,
          label,
          <span className="name">{label}</span>,
          () =>
            lines(`${n.id}::how`, level + 1, [
              [f.names, <span className="name">{f.names}</span>],
              [f.numbers, <span className="name num">{f.numbers}</span>],
            ]),
          true,
        ),
      );
    }
    return out;
  }

  /** The rows inside an informative row (the two lines of the math, the pairs of Game details): treeitems that do not
   * open, so the arrows reach them and the reader says their text (design.md §3.8). */
  function lines(
    parent: string,
    level: number,
    rows: [label: string, line: ReactNode][],
  ): ReactNode {
    return (
      <ul role="group">
        {rows.map(([label, line], i) =>
          item(
            `${parent}::${String(i)}`,
            level,
            [i + 1, rows.length],
            parent,
            label,
            line,
            null,
            false,
          ),
        )}
      </ul>
    );
  }

  function details(
    n: TreeNode,
    level: number,
    pos: [number, number],
  ): ReactNode {
    return item(
      `${n.id}::details`,
      level,
      pos,
      n.id,
      "Game details",
      <span className="name">Game details</span>,
      () => {
        const exact =
          typeof n.value === "number"
            ? String(Number(n.value.toFixed(6)))
            : valueText(n);
        return lines(`${n.id}::details`, level + 1, [
          [`Game call: ${n.code ?? ""}`, detail("Game call", n.code ?? "")],
          [`Exact value: ${exact}`, detail("Exact value", exact)],
        ]);
      },
      true,
    );
  }

  function rows(n: TreeNode, level: number): ReactNode {
    const kids = n.kids;
    if (kids === "lazy")
      return (
        <ul role="group" aria-busy="true">
          <li role="none" className="busy">
            calculating this part…
          </li>
        </ul>
      );
    // "Show all" on: every part in the game's order, and its row stays to close the list again.
    const all = showAll.has(n.id);
    const { shown, small, hidden, groups } = all
      ? {
          ...partition([]),
          shown: kids.filter((k) => !isGroup(k)),
          groups: kids.filter(isGroup),
        }
      : partition(kids);
    const allRow = all || hidden > 0;
    const hasDetails = n.code !== null && !isGroup(n);
    const size =
      phrasesOf(n).length +
      (n.formula ? 1 : 0) +
      shown.length +
      (allRow ? 1 : 0) +
      (small.length ? 1 : 0) +
      groups.length +
      (hasDetails ? 1 : 0);
    let pos = 0;
    const at = (): [number, number] => [++pos, size];
    const allKey = `${n.id}::all`;
    const smallKey = `${n.id}::small`;
    return (
      <ul role="group">
        {info(n, level, at)}
        {shown.map((k) => branch(k, level, at(), n.id))}
        {allRow &&
          item(
            allKey,
            level,
            at(),
            n.id,
            `Show all ${String(kids.length - groups.length)} parts`,
            <span className="name">{`Show all ${String(kids.length - groups.length)} parts`}</span>,
            null,
            true,
          )}
        {small.length > 0 &&
          item(
            smallKey,
            level,
            at(),
            n.id,
            `Small (${String(small.length)})`,
            <span className="name">{`Small (${String(small.length)})`}</span>,
            () => (
              <ul role="group">
                {small.map((k, i) =>
                  branch(k, level + 1, [i + 1, small.length], smallKey),
                )}
              </ul>
            ),
            true,
          )}
        {groups.map((k) => branch(k, level, at(), n.id))}
        {hasDetails && details(n, level, at())}
      </ul>
    );
  }

  function branch(
    n: TreeNode,
    level: number,
    pos: [number, number],
    parent: string | null,
  ): ReactNode {
    nodes.set(n.id, n);
    const root = n.id === tree.root.id;
    const group = isGroup(n);
    const name = root ? tree.title : `${n.name}${GROUP_SUFFIX[n.role] ?? ""}`;
    const value = root ? tree.rootText : valueText(n);
    const tags = group ? [] : truthTags(n);
    const share = group ? null : shareText(n);
    const reached = reachedText(n);
    // The root's `was` is in the header, written as the Stats writes it.
    const closed = !open.has(n.id) && changedInside.has(n.id);
    const change = rowChange(root ? undefined : n.was, n.fmt, closed);
    const label = [
      name,
      group
        ? ""
        : root
          ? tree.rootText.replace(/x$/, " times")
          : spokenValue(n),
      share,
      change?.spoken,
      reached,
      leafLabel(n),
      ...tags.map((t) => t.spoken),
      n.formula ? "has a calculation" : "",
    ]
      .filter(Boolean)
      .join(", ");
    const expandable =
      n.kids === "lazy" ||
      n.kids.length > 0 ||
      (!group &&
        (n.formula !== null || n.code !== null || phrasesOf(n).length > 0));
    const line = (
      <>
        <span className="name">{name}</span>
        {reached && <span className="reached">{reached}</span>}
        <LeafTag n={n} />
        <TruthTags tags={tags} />
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
    return item(
      n.id,
      level,
      pos,
      parent,
      label,
      line,
      () => rows(n, level + 1),
      expandable,
      change?.was,
    );
  }

  const body = branch(tree.root, 1, [1, 1], null);

  function onKeyDown(e: KeyboardEvent<HTMLUListElement>): void {
    const key = (e.target as HTMLElement).closest<HTMLElement>(
      '[role="treeitem"]',
    )?.dataset.key;
    const i = visible.findIndex((v) => v.key === key);
    const here = visible[i];
    if (!here) return;
    const go = (to: Visible | undefined) => {
      if (!to) return;
      setActive(to.key);
      setFocusKey(to.key);
    };
    const moves: Record<string, () => void> = {
      ArrowDown: () => {
        go(visible[i + 1]);
      },
      ArrowUp: () => {
        go(visible[i - 1]);
      },
      Home: () => {
        go(visible[0]);
      },
      End: () => {
        go(visible.at(-1));
      },
      ArrowRight: () => {
        if (here.expandable && !here.expanded) toggle(here.key);
        else if (here.expanded && visible[i + 1]?.parent === here.key)
          go(visible[i + 1]);
      },
      ArrowLeft: () => {
        if (here.expanded) toggle(here.key);
        else go(visible.find((v) => v.key === here.parent));
      },
      Enter: () => {
        if (here.expandable) toggle(here.key);
      },
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    move();
  }

  return (
    <ul
      ref={ref}
      role="tree"
      aria-label={`${tree.title} breakdown`}
      className="formula-tree"
      onKeyDown={onKeyDown}
    >
      {body}
    </ul>
  );
}
