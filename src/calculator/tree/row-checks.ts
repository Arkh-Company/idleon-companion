// What a pass asks of a row and the name it gives one, with no import but the Row's type: the passes rows.ts runs
// (leaf-passes.ts, level-renames.ts) read these from here, so no import goes round in a circle.
import type { Row } from "./rows.ts";

/** A row with no rows under it: built with none, and none to open later. */
export const isLeaf = (r: Row): boolean =>
  Array.isArray(r.node.kids) && !r.node.kids.length;

/** A leaf with no type yet, or a "?" (pieces.cjs `!n.kind || n.kind === "?"`). */
export const untyped = (r: Row): boolean =>
  r.node.leaf === null || r.node.leaf === "unknown";

/** Row `r` named `name`, a name of its own (no longer `unnamed`); null leaves it as it is. */
export function withName(r: Row, name: string | null): Row {
  if (name === null) return r;
  const flags = { ...r.node.flags };
  delete flags.unnamed;
  return { ...r, node: { ...r.node, name, flags } };
}
