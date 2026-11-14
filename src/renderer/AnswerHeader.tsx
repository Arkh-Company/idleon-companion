// The short answer on top of a tree (spec 008 FR-006, FR-019, FR-022; design.md C1): the largest part that adds, with its
// share, and the largest multiplier, each line only when the tree has it, then whether the root is the Stats number.
import type { FormulaTree, TreeNode } from "../shared/index.ts";
import { LastReading } from "./StatsPanel.tsx";
import { plain } from "./tree-text.ts";
import { isGroup } from "./tree-parts.ts";

type Ready = Extract<FormulaTree, { state: "ready" }>;

const largest = (rows: TreeNode[]) =>
  rows.reduce<TreeNode | null>(
    (best, k) => ((k.share ?? -1) > (best?.share ?? -1) ? k : best),
    null,
  );

/** The two lines, from the rows already built, nearest the root first; what is at 0 or ×1 never answers (FR-006). */
export function shortAnswer(root: TreeNode): string[] {
  let added: TreeNode | null = null;
  let multiplier: TreeNode | null = null;
  const queue = [root];
  for (let n = queue.shift(); n; n = queue.shift()) {
    if (!Array.isArray(n.kids)) continue;
    const parts = n.kids.filter((k) => !isGroup(k) && k.share !== null);
    added ??= largest(parts.filter((k) => k.shareMode === "sum"));
    multiplier ??= largest(
      parts.filter(
        (k) =>
          (k.shareMode === "product" || k.shareMode === "productZero") &&
          typeof k.value === "number" &&
          k.value !== 1,
      ),
    );
    queue.push(...n.kids);
  }
  const lines: string[] = [];
  if (added?.share != null) {
    const pct =
      added.share < 0.01 ? "<1" : String(Math.round(added.share * 100));
    lines.push(`Largest added bonus: ${added.name} (${pct}%).`);
  }
  if (typeof multiplier?.value === "number")
    lines.push(
      `Largest multiplier: ${multiplier.name} ×${plain(multiplier.value)}.`,
    );
  return lines;
}

export function AnswerHeader({ tree }: { tree: Ready }) {
  const same =
    !tree.stale &&
    tree.character === tree.activeCharacter &&
    tree.statsValue !== null;
  return (
    <div className="answer">
      {shortAnswer(tree.root).map((line) => (
        <p key={line} className="short">
          {line}
        </p>
      ))}
      {tree.stale && (
        <div className="trust">
          <LastReading at={tree.calculatedAt} before="Game closed · " />
        </div>
      )}
      {same && (
        <p className="trust">
          <span aria-hidden="true">✓ </span>Same as Stats
        </p>
      )}
    </div>
  );
}
