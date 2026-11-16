// "Game changed · Refresh" (spec 008 FR-024; design.md C11): the band over the tree when the game shows another number,
// with Refresh now, and after a Refresh what the root was. The tree never changes by itself while it is read.
import { rootText } from "../shared/index.ts";
import type { FormulaTree, LiveValues } from "../shared/index.ts";
import { changeText } from "./tree-text.ts";

type Ready = Extract<FormulaTree, { state: "ready" }>;

const idOf = (tree: Ready) =>
  tree.request.type === "number" ? tree.request.id : "";

/** The band's sentence, with the number the game shows now; null when there is no band (FR-024). */
export function bandText(tree: Ready, live: LiveValues | null): string | null {
  if (!tree.gameChanged || tree.stale) return null;
  const now = live?.values[idOf(tree)];
  const shown =
    typeof now === "number" ? rootText(idOf(tree), now) : "a new value";
  return `The game now shows ${shown}. Refresh to see what changed.`;
}

/** What the root was before the Refresh, and how much it moved; null when it did not change. */
export function rootWas(
  tree: Ready,
): { text: string; change: string | null } | null {
  const { was, value } = tree.root;
  if (typeof was !== "number") return null;
  return {
    text: `was ${rootText(idOf(tree), was)}`,
    change: typeof value === "number" ? changeText(was, value) : null,
  };
}

export function ChangeBadge({
  tree,
  live,
  onRefresh,
}: {
  tree: Ready;
  live: LiveValues | null;
  onRefresh: () => void;
}) {
  const band = bandText(tree, live);
  const was = rootWas(tree);
  return (
    <>
      {was && (
        <p className="was">
          {was.change ? `${was.text} · ${was.change}` : was.text}
        </p>
      )}
      {band && (
        <div className="band">
          <p>{band}</p>
          <button type="button" onClick={onRefresh}>
            Refresh now
          </button>
        </div>
      )}
    </>
  );
}
