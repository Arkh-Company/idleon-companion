// The version band (spec 008 FR-018; design.md C18): one band over the tree when its names and tags were checked on
// another game version, never a mark per row. Plain text, read before the panel's title; no live region.
import type { FormulaTree } from "../shared/index.ts";

export function VersionBand({ tree }: { tree: FormulaTree }) {
  if (tree.state !== "ready" || tree.checkedOnThisGame) return null;
  return (
    <p className="band">
      Names and tags were checked on an older game version. Values are live.
    </p>
  );
}
