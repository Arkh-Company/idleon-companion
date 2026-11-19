// The tree of one number, opened in place like folders (spec 008 FR-006, FR-031; design.md C2, C5, C6, C8, C10, §3.8;
// every part in its place, with no "Small" nor "Show all": spec 009, FR-016): the APG treeview whole, one Tab stop with a roving tabindex, ↑ ↓ → ← Home End Enter. A lazy branch asks
// its rows when it opens and says "calculating this part…" until they come. A part that 2 or more numbers use shows how
// many, and its "Feeds N numbers" row lists them, each one opening its tree (FR-027). Spec 009: a pool's and a group's value
// is rebuilt from its rows (the main writes the live values of the parts, FR-015), the share shows only when asked
// (FR-014), each row has its arrow with "Changes" on (FR-013), and a tree rebuilt by itself keeps open what was open.
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { preorder } from "../shared/index.ts";
import type { FormulaTree as Tree, TreeNode } from "../shared/index.ts";
import { FEEDS_LOADING, useFeedsLists } from "./FeedsBadge.tsx";
import { nameOf } from "./FormulasTab.tsx";
import { countRows, gameDetails, treeCounts, useCopy } from "./GameDetails.tsx";
import { partLine, phrasesOf, treeItem, treeLines } from "./tree-items.tsx";
import type { RowCtx } from "./tree-items.tsx";
import { keyMove } from "./tree-keys.ts";
import type { Visible } from "./tree-keys.ts";
import { valuesOf } from "./tree-changes.ts";
import type { Arrow } from "./tree-changes.ts";
import { formulaLines } from "./tree-text.ts";
import { flip } from "./tree-parts.ts";

type Ready = Extract<Tree, { state: "ready" }>;

const FEEDS = "::feeds";

export function FormulaTree({
  tree,
  onExpand,
  onOpenNumber,
  announce,
  share = false,
  arrows = null,
}: {
  tree: Ready;
  onExpand: (nodeId: string) => void;
  /** Opens another number's tree in the side panel (FR-027). */
  onOpenNumber?: (id: string) => void;
  /** One sentence for the page's live region (design.md §3.8): the Copy of Game details. */
  announce?: (text: string) => void;
  /** The share toggle (spec 009 FR-014). */
  share?: boolean;
  /** Each row's arrow by id, with "Changes" on; null when it is off (spec 009 FR-013). */
  arrows?: ReadonlyMap<string, Arrow> | null;
}) {
  const feeds = useFeedsLists();
  const copied = useCopy(announce);
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set([tree.root.id]),
  );
  /** design.md C10: the loop's steps show only when asked, from the root's Game details; with no such row to ask from
   * (a root without its call), nothing is hidden. */
  const [repeated, setRepeated] = useState(false);
  const hideRepeated = tree.root.code !== null && !repeated;
  const [active, setActive] = useState(tree.root.id);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const asked = useRef(new Set<string>());
  const ref = useRef<HTMLUListElement>(null);
  /** Each pool's and group's value rebuilt from its rows, live (spec 009 R5). */
  const values = useMemo(() => valuesOf(tree.root), [tree.root]);
  /** The build the rows were asked of: a tree rebuilt by itself asks its open lazy rows again (spec 009 FR-015). */
  const built = useRef(tree.calculatedAt);
  useEffect(() => {
    if (built.current !== tree.calculatedAt) {
      built.current = tree.calculatedAt;
      asked.current.clear();
    }
    for (const n of preorder(tree.root))
      if (n.kids === "lazy" && open.has(n.id) && !asked.current.has(n.id)) {
        asked.current.add(n.id);
        onExpand(n.id);
      }
  }, [tree.root, tree.calculatedAt, open, onExpand]);

  useEffect(() => {
    if (focusKey === null) return;
    const items =
      ref.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [];
    [...items].find((i) => i.dataset.key === focusKey)?.focus();
  }, [focusKey]);

  /** A row's name on screen: the root's is the number's title. */
  const rowName = (n: TreeNode) =>
    n.id === tree.root.id ? tree.title : n.name;

  // Walked during the render: the visible rows in order, for the keys.
  const visible: Visible[] = [];
  const nodes = new Map<string, TreeNode>();

  function toggle(key: string): void {
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
    isOpen: (key) => open.has(key),
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
              ...(f.text === null
                ? []
                : [
                    [f.text, <span className="name">{f.text}</span>] satisfies [
                      string,
                      ReactNode,
                    ],
                  ]),
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
    // spec 009 FR-016: every part in its place, in the game's order
    const hasDetails = n.code !== null;
    const size =
      phrasesOf(n).length +
      (n.formula ? 1 : 0) +
      (n.feeds !== undefined && n.pieceKey !== null ? 1 : 0) +
      kids.length +
      (hasDetails ? 1 : 0);
    let pos = 0;
    const at = (): [number, number] => [++pos, size];
    return (
      <ul role="group">
        {info(n, level, at)}
        {kids.map((k) => branch(k, level, at(), n.id))}
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
    const shown = n.combine ? { ...n, value: values.get(n.id) ?? null } : n;
    const { label, line } = partLine(shown, {
      name: rowName(n),
      root,
      rootText: tree.rootText,
      share,
      arrow: arrows?.get(n.id) ?? null,
      onFeeds: () => {
        tapFeeds(n);
      },
    });
    const expandable =
      n.kids === "lazy" ||
      n.kids.length > 0 ||
      n.formula !== null ||
      n.code !== null ||
      n.feeds !== undefined ||
      phrasesOf(n).length > 0;
    return item(
      n.id,
      level,
      pos,
      parent,
      label,
      line,
      () => rows(n, level + 1),
      expandable,
    );
  }

  const body = branch(tree.root, 1, [1, 1], null);

  // spec 009 FR-015: a rebuilt tree may drop the row of the Tab stop. It goes to the nearest row left (up the path of
  // names), or the root, and the focus with it when it was on that row (gone, it left the focus to the page).
  useEffect(() => {
    const keys = new Set(visible.map((v) => v.key));
    if (keys.has(active)) return;
    let to = active;
    while (!keys.has(to)) {
      const cut = Math.max(to.lastIndexOf("/"), to.lastIndexOf("::"));
      to = cut > 0 ? to.slice(0, cut) : tree.root.id;
    }
    setActive(to);
    if (document.activeElement === document.body) setFocusKey(to);
  });

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
