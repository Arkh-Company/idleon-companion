// The side panel (spec 008 FR-005, FR-019, FR-034, FR-039; design.md C1, C9, §3.5): the tree of the number the player
// tapped, beside the window. It changes only when the player taps another number or ✕, never with the game's screen.
// Spec 009: the tree is live (FR-015), the share and "Changes" toggles sit over it (FR-013, FR-014), and with Changes on
// each row has its arrow against the tree frozen at the click ("live") or a mark chosen (FR-025). Pin keeps the number in
// the strip under the status bar (FR-036). A number of a part's "Feeds N numbers" list opens its own tree here (FR-027).
// The character picker asks another character's tree of the same number (FR-020).
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_VIEW, LIVE_MAP_TEXT } from "../shared/index.ts";
import type {
  Characters,
  FormulaTree as Tree,
  Mark,
  Pin,
  ViewPrefs,
} from "../shared/index.ts";
import { AnswerHeader } from "./AnswerHeader.tsx";
import { CharacterPicker } from "./CharacterPicker.tsx";
import { FormulaTree } from "./FormulaTree.tsx";
import { MarkBar } from "./MarkBar.tsx";
import { arrowsOf, baseOf } from "./tree-changes.ts";
import type { Arrow, Base } from "./tree-changes.ts";
import { VersionBand } from "./VersionBand.tsx";
import { ViewToggles } from "./ViewToggles.tsx";

/** What the panel shows: the row tapped, its trees (Damage has two) and the one chosen. */
export interface Side {
  label: string;
  text: string;
  trees: readonly (readonly [id: string, name: string])[];
  id: string | null;
}

type Ready = Extract<Tree, { state: "ready" }>;

/** The number and character a tree is of: the base of "Changes" belongs to one. */
const treeKey = (t: Ready) =>
  `${t.request.type === "number" ? t.request.id : ""}:${String(t.character)}`;

export function SidePanel({
  side,
  tree,
  onClose,
  onPick,
  onExpand,
  announce,
  pins,
  onPin,
  onOpenNumber,
  characters,
  onCharacter,
}: {
  side: Side;
  tree: Tree;
  onClose: () => void;
  onPick: (id: string) => void;
  onExpand: (nodeId: string) => void;
  /** One sentence for the page's live region (design.md §3.8). */
  announce: (text: string) => void;
  pins: readonly Pin[];
  /** Pins the open number, or unpins it (FR-036). */
  onPin: (id: string) => void;
  /** Opens another catalog number's tree in this panel (FR-027). */
  onOpenNumber: (id: string) => void;
  /** The game's characters, for the picker; null before they are known. */
  characters: Characters;
  /** Asks the open number's tree for another character (FR-020). */
  onCharacter: (character: number) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  // FR-039: opening, or another number, puts the focus on the panel's title.
  useEffect(() => {
    heading.current?.focus();
  }, [side.label, side.id]);

  /** The character picked: its first ready tree is said once (design.md C19). */
  const picked = useRef<number | null>(null);
  useEffect(() => {
    // A pick answered with no tree is over: a later tree is no answer to it.
    if (["unavailable", "diverged", "none"].includes(tree.state))
      picked.current = null;
    if (tree.state !== "ready") return;
    if (picked.current === tree.character) {
      picked.current = null;
      announce(`Breakdown for ${characters?.names[tree.character] ?? ""}`);
    }
  }, [tree, announce, characters]);

  /** The two toggles, as saved in settings.json (spec 009, contracts/ipc.md). */
  const [view, setViewPrefs] = useState<ViewPrefs>(DEFAULT_VIEW);
  useEffect(() => {
    // An answer that never comes, or a refusal, leaves both off (contracts/ipc.md).
    window.companion.getView().then(setViewPrefs, () => undefined);
  }, []);
  function flipView(k: keyof ViewPrefs): void {
    const next = { ...view, [k]: !view[k] };
    setViewPrefs(next);
    // A file that cannot be written keeps the toggle for this session.
    window.companion.setView(next).catch(() => undefined);
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
  /** What the arrows compare with, for one tree: frozen when Changes is turned on, a mark chosen or cleared, or another
   * tree comes (FR-013). */
  const [base, setBase] = useState<(Base & { key: string }) | null>(null);
  const ready = tree.state === "ready" ? tree : null;
  const freeze = (t: Ready, m: Mark | null) => {
    setBase({ key: treeKey(t), ...baseOf(t.root, m) });
  };
  // Derived during the render (React's "state from the previous render"): Changes on with no base for this tree.
  if (view.changes && ready && base?.key !== treeKey(ready))
    freeze(ready, mark);
  const arrows = useMemo(
    (): ReadonlyMap<string, Arrow> | null =>
      view.changes && ready && base?.key === treeKey(ready)
        ? arrowsOf(ready.root, base.values)
        : null,
    [view.changes, ready, base],
  );

  const { id } = side;
  const name = side.trees.find(([t]) => t === id)?.[1] ?? side.label;
  // A tree of another number (the main has not answered yet) is never shown in place of this one.
  const mine =
    tree.state === "waiting" ||
    ("request" in tree &&
      tree.request.type === "number" &&
      tree.request.id === side.id);
  const shown: Tree | null =
    side.id === null ? null : mine ? tree : { state: "none" };
  /** The character of the tree shown or asked; the active one otherwise. */
  const character =
    shown && "request" in shown && shown.request.type === "number"
      ? shown.request.character
      : characters?.active;
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
      {id !== null && (
        <button
          type="button"
          className="pin-toggle"
          onClick={() => {
            onPin(id);
          }}
        >
          {pins.some((p) => p.treeId === id) ? "Unpin" : "Pin"}
        </button>
      )}
      {id !== null && characters && character !== undefined && (
        <CharacterPicker
          characters={characters}
          character={character}
          onPick={(n) => {
            picked.current = n;
            onCharacter(n);
          }}
        />
      )}
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
          onExpand={onExpand}
          onOpenNumber={onOpenNumber}
          announce={announce}
          share={view.share}
          arrows={arrows}
          marks={(character) => (
            <>
              <ViewToggles
                view={view}
                onFlip={(k) => {
                  if (k === "changes") setBase(null);
                  flipView(k);
                }}
              />
              <MarkBar
                character={character}
                chosen={mark}
                onChoose={(m) => {
                  setChosen(m && { character, mark: m });
                  // A mark chosen, or "Live" (cleared too): the tree as it is now (spec 009, Edge Cases).
                  if (ready) freeze(ready, m);
                }}
                announce={announce}
              />
            </>
          )}
        />
      )}
    </aside>
  );
}

function Body({
  tree,
  onExpand,
  onOpenNumber,
  marks,
  announce,
  share,
  arrows,
}: {
  tree: Tree;
  onExpand: (nodeId: string) => void;
  onOpenNumber: (id: string) => void;
  announce: (text: string) => void;
  share: boolean;
  arrows: ReadonlyMap<string, Arrow> | null;
  /** The marks bar, for the tree's character. */
  marks: (character: number) => ReactNode;
}) {
  switch (tree.state) {
    case "waiting":
      return <p>Waiting for the game</p>;
    case "unavailable":
      return tree.liveMap ? (
        <p>{LIVE_MAP_TEXT}</p>
      ) : (
        <p>Calculator unavailable. The formulas can't be calculated now.</p>
      );
    case "diverged":
      return <p>Breakdown unavailable</p>;
    case "ready":
      return (
        <>
          <AnswerHeader tree={tree} />
          {marks(tree.character)}
          {/* No calculatedAt in the key: a tree rebuilt by itself keeps open what was open (FR-015). */}
          <FormulaTree
            key={treeKey(tree)}
            tree={tree}
            onExpand={onExpand}
            onOpenNumber={onOpenNumber}
            announce={announce}
            share={share}
            arrows={arrows}
          />
        </>
      );
    default:
      return <p aria-busy="true">Calculating the breakdown…</p>;
  }
}
