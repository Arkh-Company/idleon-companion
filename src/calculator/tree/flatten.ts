// No unnamed step inside a level (spec 009, FR-007, FR-008, research R3): a branch with no code of the game and no proven
// name (the generic one, or a name by its shape only: "Multiplier", "Fixed +2", "Multiplier from 23 sources") is never a
// row; its parts move up into the level. It moves up only when its parts sum (or multiply) to it as the level's rows do
// to their parent, so the level still closes; the row above's ⓘ is then the whole sum or product (tree/formulas.ts). The
// same mechanism as the bench's structurePass (tree/one-child.ts), for a step with more than one part.
import { isCond, near, vOf } from "./formulas.ts";
import { ONE_CHILD } from "./one-child.ts";
import { withShares } from "./rows.ts";
import type { Row } from "./rows.ts";
import { BRANCH_SHAPES } from "./shapes.ts";

type Op = "+" | "*";

/** The names a step gets from its shape or its count of sources (tree/shapes.ts, tree/terms.ts), which say nothing of it. */
const BY_COUNT =
  /^(?:Fixed [+×]\S+|(?:Multiplier from|Sum of|Formula of) \d+ sources)$/;
export const byShapeOnly = (name: string): boolean =>
  ONE_CHILD.vague.test.test(name) ||
  BY_COUNT.test(name) ||
  BRANCH_SHAPES.some((s) => s.name === name);

/** How a level's rows give their parent, by their shares (rows.ts `withShares`); null when they neither add nor multiply. */
function opOf(rows: readonly Row[]): Op | null {
  const modes = new Set(rows.map((r) => r.node.shareMode));
  if (modes.size !== 1) return null;
  const [m] = modes;
  return m === "sum"
    ? "+"
    : m === "product" || m === "productZero"
      ? "*"
      : null;
}

const total = (rows: readonly Row[], op: Op) =>
  rows.reduce(
    (a, r) => (op === "*" ? a * vOf(r) : a + vOf(r)),
    op === "*" ? 1 : 0,
  );

/** A step with no name of its own, whose parts, none of them a check, give its value by `op`. */
function isStep(r: Row, op: Op): boolean {
  const n = r.node;
  const parts = r.group ?? [];
  return (
    n.code === null &&
    r.open === null &&
    n.role === "piece" &&
    !isCond(r) &&
    !n.flags.truncated &&
    (!!n.flags.unnamed || byShapeOnly(n.name)) &&
    parts.length > 0 &&
    !parts.some(isCond) &&
    parts.every((k) => Number.isFinite(vOf(k))) &&
    near(total(parts, op), vOf(r))
  );
}

/**
 * A level's rows with each unnamed step replaced by its parts, all the way down, with their shares in the level;
 * `op` is how the rows give their parent (read from their shares when not given). The rows as they are when none moves.
 */
export function flatten(rows: Row[], op: Op | null = opOf(rows)): Row[] {
  if (!op || !rows.some((r) => isStep(r, op))) return rows;
  const out = rows.flatMap((r) =>
    isStep(r, op)
      ? // a part opens under the calls its step opened under
        flatten(r.group ?? [], op).map((k) =>
          r.seen && !k.seen ? { ...k, seen: r.seen } : k,
        )
      : [r],
  );
  return withShares({ name: "", value: total(out, op) }, null, out).rows;
}
