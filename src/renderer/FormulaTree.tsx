// The tree of one number, opened in place like folders (spec 008 FR-006, FR-014, FR-031; design.md C2, C5, C6, C8, C10,
// C15, §3.8): the APG treeview whole, one Tab stop with a roving tabindex, ↑ ↓ → ← Home End Enter. A lazy branch asks
// its rows when it opens and says "calculating this part…" until they come. A part that 2 or more numbers use shows how
// many, and its "Feeds N numbers" row lists them, each one opening its tree (FR-027).
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { changes } from "../shared/index.ts";
import type { FormulaTree as Tree, TreeNode } from "../shared/index.ts";
import { FEEDS_LOADING, useFeedsLists } from "./FeedsBadge.tsx";
import { nameOf } from "./FormulasTab.tsx";
import { countRows, gameDetails, treeCounts, useCopy } from "./GameDetails.tsx";
import { partLine, phrasesOf, treeItem, treeLines } from "./tree-items.tsx";
import type { RowCtx } from "./tree-items.tsx";
import { keyMove } from "./tree-keys.ts";
import type { Visible } from "./tree-keys.ts";
import { formulaLines, GROUP_SUFFIX } from "./tree-text.ts";
import { flip, isGroup, partition } from "./tree-parts.ts";

type Ready = Extract<Tree, { state: "ready" }>;

const FEEDS = "::feeds";

export function FormulaTree({
  tree,
  onExpand,
  onOpenNumber,
  announce,
}: {
  tree: Ready;
  onExpand: (nodeId: string) => void;
  /** Opens another number's tree in the side panel (FR-027). */
  onOpenNumber?: (id: string) => void;
  /** One sentence for the page's live region (design.md §3.8): the Copy of Game details. */
  announce?: (text: string) => void;
}) {
  const feeds = useFeedsLists();
  const copied = useCopy(announce);
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set([tree.root.id]),
  );
  const [showAll, setShowAll] = useState<ReadonlySet<string>>(() => new Set());
  /** design.md C10: the loop's steps show only when asked, from the root's Game details; with no such row to ask from
   * (a root without its call), nothing is hidden. */
  const [repeated, setRepeated] = useState(false);
  const hideRepeated = tree.root.code !== null && !repeated;
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

  /** A row's name on screen: the root's is the number's title. */
  const rowName = (n: TreeNode) =>
    n.id === tree.root.id
      ? tree.title
      : `${n.name}${GROUP_SUFFIX[n.role] ?? ""}`;

  // Walked during the render: the visible rows in order, for the keys.
  const visible: Visible[] = [];
  const nodes = new Map<string, TreeNode>();

  function toggle(key: string): void {
    if (key.endsWith("::all")) {
      const id = key.slice(0, -"::all".length);
      setShowAll((s) => flip(s, id));
      return;
    }
    if (key.endsWith(FEEDS)) {
      const n = nodes.get(key.slice(0, -FEEDS.length));
      if (n?.pieceKey) feeds.load(n.pieceKey, n.feeds ?? 0);
    }
    const n = nodes.get(key);
    if (n?.kids === "lazy" && !open.has(key) && !asked.current.has(key)) {
      asked.current.add(key);
      onExpand(n.id);
    }
    setOpen((s) => flip(s, key));
  }

  const ctx: RowCtx = {
    visible,
    active,
    isOpen: (key) =>
      key.endsWith("::all") ? showAll.has(key.slice(0, -5)) : open.has(key),
    focus: (key) => {
      setActive(key);
      setFocusKey(key);
    },
    toggle,
  };
  const item = treeItem.bind(null, ctx);
  const lines = treeLines.bind(null, ctx);

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
    const { feeds: count, pieceKey } = n;
    if (count !== undefined && pieceKey !== null) {
      const label = `Feeds ${String(count)} numbers`;
      const key = `${n.id}${FEEDS}`;
      out.push(
        item(
          key,
          level,
          at(),
          n.id,
          label,
          <span className="name">{label}</span>,
          () => numbers(key, level + 1, pieceKey),
          true,
        ),
      );
    }
    return out;
  }

  /** The numbers a part feeds, by name; each one opens its tree, but the tree on screen. */
  function numbers(parent: string, level: number, pieceKey: string): ReactNode {
    const ids = feeds.of(pieceKey);
    if (!ids)
      return (
        <ul role="group" aria-busy="true">
          <li role="none" className="busy">
            {FEEDS_LOADING}
          </li>
        </ul>
      );
    const here = tree.request.type === "number" ? tree.request.id : null;
    return (
      <ul role="group">
        {ids.map((id, i) => {
          const name = nameOf(id);
          const mine = id === here;
          return item(
            `${parent}::${id}`,
            level,
            [i + 1, ids.length],
            parent,
            mine ? `${name}, this number` : `Open ${name}`,
            <>
              <span className="name">{name}</span>
              {mine && <span className="phrase">this number</span>}
            </>,
            null,
            false,
            false,
            mine
              ? undefined
              : () => {
                  onOpenNumber?.(id);
                },
          );
        })}
      </ul>
    );
  }

  /** A tap on a part's badge: the part opens with its list, which takes the focus once the part's rows are there. */
  function tapFeeds(n: TreeNode): void {
    const key = `${n.id}${FEEDS}`;
    if (!open.has(n.id)) toggle(n.id);
    if (!open.has(key)) toggle(key);
    const to = n.kids === "lazy" ? n.id : key;
    setActive(to);
    setFocusKey(to);
  }

  function details(
    n: TreeNode,
    level: number,
    pos: [number, number],
  ): ReactNode {
    const key = `${n.id}::details`;
    return item(
      key,
      level,
      pos,
      n.id,
      "Game details",
      <span className="name">Game details</span>,
      () => {
        const { rows, line } = gameDetails(n, rowName(n));
        const copyKey = `${key}::${String(rows.length)}`;
        const label = copied.label(copyKey);
        // The root's is the page's last: it adds the whole tree's counts and the repeated steps' switch.
        const counts = n.id === tree.root.id ? treeCounts(n) : null;
        const steps = `${repeated ? "Hide" : "Show"} repeated steps (${(counts?.repeated ?? 0).toLocaleString("en-US")})`;
        return lines(key, level + 1, [
          ...rows,
          [
            label,
            <span className="name">{label}</span>,
            () => {
              copied.copy(copyKey, line);
            },
          ],
          ...(counts ? countRows(counts) : []),
          ...(counts?.repeated
            ? [
                [
                  steps,
                  <span className="name">{steps}</span>,
                  () => {
                    setRepeated((r) => !r);
                  },
                ] satisfies [string, ReactNode, () => void],
              ]
            : []),
        ]);
      },
      true,
    );
  }

  function rows(n: TreeNode, level: number): ReactNode {
    const kids =
      hideRepeated && n.kids !== "lazy"
        ? n.kids.filter((k) => !k.flags.progress)
        : n.kids;
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
      (n.feeds !== undefined && n.pieceKey !== null ? 1 : 0) +
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
    const { label, line, was } = partLine(n, {
      name: rowName(n),
      root,
      rootText: tree.rootText,
      closedChange: !open.has(n.id) && changedInside.has(n.id),
      onFeeds: () => {
        tapFeeds(n);
      },
    });
    const expandable =
      n.kids === "lazy" ||
      n.kids.length > 0 ||
      (!group &&
        (n.formula !== null ||
          n.code !== null ||
          n.feeds !== undefined ||
          phrasesOf(n).length > 0));
    return item(
      n.id,
      level,
      pos,
      parent,
      label,
      line,
      () => rows(n, level + 1),
      expandable,
      was,
    );
  }

  const body = branch(tree.root, 1, [1, 1], null);

  function onKeyDown(e: KeyboardEvent<HTMLUListElement>): void {
    const key = (e.target as HTMLElement).closest<HTMLElement>(
      '[role="treeitem"]',
    )?.dataset.key;
    const go = (to: Visible | undefined) => {
      if (to) ctx.focus(to.key);
    };
    const i = visible.findIndex((v) => v.key === key);
    const move = keyMove(e.key, visible, i, go, toggle);
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
