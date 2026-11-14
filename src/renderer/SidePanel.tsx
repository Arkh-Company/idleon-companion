// The side panel (spec 008 FR-005, FR-019, FR-034, FR-039; design.md C1, C9, §3.5): the tree of the number the player
// tapped, beside the window. It changes only when the player taps another number or ✕, never with the game's screen.
// With a mark chosen, each row shows the mark's value beside the current one (FR-025).
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { changes, compareValues } from "../shared/index.ts";
import type { FormulaTree as Tree, LiveValues, Mark } from "../shared/index.ts";
import { AnswerHeader } from "./AnswerHeader.tsx";
import { bandText, ChangeBadge, rootWas } from "./ChangeBadge.tsx";
import { FormulaTree } from "./FormulaTree.tsx";
import { MarkBar } from "./MarkBar.tsx";
import { VersionBand } from "./VersionBand.tsx";

/** What the panel shows: the row tapped, its trees (Damage has two) and the one chosen. */
export interface Side {
  label: string;
  text: string;
  trees: readonly (readonly [id: string, name: string])[];
  id: string | null;
}

type Ready = Extract<Tree, { state: "ready" }>;

/** The sentence after a Refresh (design.md C11): the new number, how much it moved and how many parts changed. */
function updated(tree: Ready): string {
  const change = rootWas(tree)?.change;
  const parts = [...changes(tree.root).ids].filter(
    (id) => id !== tree.root.id,
  ).length;
  return `${tree.title} updated: ${tree.rootText}${change ? `, ${change}` : ""}. ${String(parts)} ${parts === 1 ? "part" : "parts"} changed.`;
}

export function SidePanel({
  side,
  tree,
  live,
  onClose,
  onPick,
  onExpand,
  announce,
}: {
  side: Side;
  tree: Tree;
  live: LiveValues | null;
  onClose: () => void;
  onPick: (id: string) => void;
  onExpand: (nodeId: string) => void;
  /** One sentence for the page's live region (design.md §3.8). */
  announce: (text: string) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  // FR-039: opening, or another number, puts the focus on the panel's title.
  useEffect(() => {
    heading.current?.focus();
  }, [side.label, side.id]);

  /** The tree on screen when Refresh now was tapped: the next ready one is its answer. */
  const refreshed = useRef<Tree | null>(null);
  /** The tree whose band was said: once per tree, not at each live value. */
  const bandSaid = useRef<string | null>(null);
  useEffect(() => {
    if (tree.state !== "ready") return;
    if (refreshed.current && refreshed.current !== tree) {
      refreshed.current = null;
      announce(updated(tree));
      return;
    }
    const key = `${tree.title}:${String(tree.calculatedAt)}`;
    const band = bandText(tree, live);
    if (band && bandSaid.current !== key) {
      bandSaid.current = key;
      announce(band);
    }
  }, [tree, live, announce]);
  function refresh(): void {
    if (!side.id) return;
    refreshed.current = tree;
    // The band and its button go: the focus goes to the title (design.md C11).
    heading.current?.focus();
    onPick(side.id);
  }

  /** The mark the tree compares with, for the character it was chosen on: another character's never applies. */
  const [chosen, setChosen] = useState<{
    character: number;
    mark: Mark;
  } | null>(null);
  const mark =
    tree.state === "ready" && chosen?.character === tree.character
      ? chosen.mark
      : null;
  const compared = useMemo(
    (): Tree =>
      tree.state === "ready" && mark
        ? {
            ...tree,
            comparingWith: mark.name,
            root: compareValues(mark.values, tree.root).withWas,
          }
        : tree,
    [tree, mark],
  );

  const name = side.trees.find(([id]) => id === side.id)?.[1] ?? side.label;
  // A tree of another number (the main has not answered yet) is never shown in place of this one.
  const mine =
    tree.state === "waiting" ||
    ("request" in tree &&
      tree.request.type === "number" &&
      tree.request.id === side.id);
  const shown: Tree | null =
    side.id === null ? null : mine ? compared : { state: "none" };
  const text =
    shown?.state === "ready"
      ? shown.rootText
      : shown?.state === "diverged"
        ? shown.statsText
        : side.trees.length === 1
          ? side.text
          : "";

  return (
    <aside className="side-panel" aria-label={`${name} breakdown`}>
      <button
        type="button"
        className="close"
        aria-label="Close the breakdown"
        onClick={onClose}
      >
        <span aria-hidden="true">✕</span>
      </button>
      {shown && <VersionBand tree={shown} />}
      <h2 ref={heading} tabIndex={-1}>
        {name} <span className="num">{text}</span>
      </h2>
      {shown === null && (
        <ul className="choices">
          {side.trees.map(([id, treeName]) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => {
                  onPick(id);
                }}
              >
                {treeName}
                <span aria-hidden="true"> ›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {shown && (
        <Body
          tree={shown}
          live={live}
          onExpand={onExpand}
          onRefresh={refresh}
          marks={(character) => (
            <MarkBar
              character={character}
              chosen={mark}
              onChoose={(m) => {
                setChosen(m && { character, mark: m });
              }}
              announce={announce}
            />
          )}
        />
      )}
    </aside>
  );
}

function Body({
  tree,
  live,
  onExpand,
  onRefresh,
  marks,
}: {
  tree: Tree;
  live: LiveValues | null;
  onExpand: (nodeId: string) => void;
  onRefresh: () => void;
  /** The marks bar, for the tree's character. */
  marks: (character: number) => ReactNode;
}) {
  switch (tree.state) {
    case "waiting":
      return <p>Waiting for the game</p>;
    case "unavailable":
      return (
        <p>Calculator unavailable. The formulas can't be calculated now.</p>
      );
    case "diverged":
      return <p>Breakdown unavailable</p>;
    case "ready":
      return (
        <>
          <ChangeBadge tree={tree} live={live} onRefresh={onRefresh} />
          <AnswerHeader tree={tree} />
          {marks(tree.character)}
          <FormulaTree
            key={`${tree.request.type === "number" ? tree.request.id : ""}:${String(tree.calculatedAt)}`}
            tree={tree}
            onExpand={onExpand}
          />
        </>
      );
    default:
      return <p aria-busy="true">Calculating the breakdown…</p>;
  }
}
