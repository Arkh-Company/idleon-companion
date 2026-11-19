// Over a tree (spec 008 FR-019, FR-022; design.md C1): whether the root is the Stats number, or that it is the last reading
// of a closed game. The short answer of two lines left with spec 009 (FR-001): the tree starts at its pools.
import type { FormulaTree } from "../shared/index.ts";
import { LastReading } from "./StatsPanel.tsx";

type Ready = Extract<FormulaTree, { state: "ready" }>;

export function AnswerHeader({ tree }: { tree: Ready }) {
  const same =
    !tree.stale &&
    tree.character === tree.activeCharacter &&
    tree.statsValue !== null;
  return (
    <div className="answer">
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
