// The keys of the formula tree (spec 008 FR-031; design.md §3.8): the APG treeview's ↑ ↓ → ← Home End Enter over the
// visible rows, in order.

export interface Visible {
  key: string;
  parent: string | null;
  expandable: boolean;
  expanded: boolean;
  /** What Enter or a tap does on a row that opens nothing (a number of a part's list). */
  activate: (() => void) | undefined;
}

/** What `key` does on the visible row `i`: move the focus with `go`, open or close with `toggle`; undefined for others. */
export function keyMove(
  key: string,
  visible: readonly Visible[],
  i: number,
  go: (to: Visible | undefined) => void,
  toggle: (key: string) => void,
): (() => void) | undefined {
  const here = visible[i];
  if (!here) return undefined;
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
      if (here.activate) here.activate();
      else if (here.expandable) toggle(here.key);
    },
  };
  return moves[key];
}
