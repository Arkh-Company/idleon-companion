// The side panel (spec 008 FR-005, FR-019, FR-034, FR-039; design.md C1, C9, §3.5): the tree of the number the player
// tapped, beside the window. It changes only when the player taps another number or ✕, never with the game's screen.
import { useEffect, useRef } from "react";
import type { FormulaTree as Tree } from "../shared/index.ts";
import { AnswerHeader } from "./AnswerHeader.tsx";
import { FormulaTree } from "./FormulaTree.tsx";
import { VersionBand } from "./VersionBand.tsx";

/** What the panel shows: the row tapped, its trees (Damage has two) and the one chosen. */
export interface Side {
  label: string;
  text: string;
  trees: readonly (readonly [id: string, name: string])[];
  id: string | null;
}

export function SidePanel({
  side,
  tree,
  onClose,
  onPick,
  onExpand,
}: {
  side: Side;
  tree: Tree;
  onClose: () => void;
  onPick: (id: string) => void;
  onExpand: (nodeId: string) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  // FR-039: opening, or another number, puts the focus on the panel's title.
  useEffect(() => {
    heading.current?.focus();
  }, [side.label, side.id]);

  const name = side.trees.find(([id]) => id === side.id)?.[1] ?? side.label;
  // A tree of another number (the main has not answered yet) is never shown in place of this one.
  const mine =
    tree.state === "waiting" ||
    ("request" in tree &&
      tree.request.type === "number" &&
      tree.request.id === side.id);
  const shown: Tree | null =
    side.id === null ? null : mine ? tree : { state: "none" };
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
      {shown && <Body tree={shown} onExpand={onExpand} />}
    </aside>
  );
}

function Body({
  tree,
  onExpand,
}: {
  tree: Tree;
  onExpand: (nodeId: string) => void;
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
          <AnswerHeader tree={tree} />
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
