// No unnamed step inside a level (spec 009, FR-007, FR-008, research R3): a branch with no code of the game and no proven
// name (the generic one, or a name by its shape only: "Multiplier", "Fixed +2", "Multiplier from 23 sources") is never a
// row; its parts move up into the level. It moves up only when its own expression only adds (or only multiplies) its
// parts, as the level's rows do to their parent, and they give its value, so the level still closes; the row above's ⓘ
// is then the whole sum or product (tree/formulas.ts). The same mechanism as the bench's structurePass
// (tree/one-child.ts), for a step with more than one part.
import { isCond, near, vOf } from "./formulas.ts";
import { ONE_CHILD } from "./one-child.ts";
import { withShares } from "./rows.ts";
import type { Row } from "./rows.ts";
import { BRANCH_SHAPES } from "./shapes.ts";

export type Op = "+" | "*";
/**
 * The rows a working value is made of, when the root's own call wrote it in a step that only adds (or only multiplies)
 * them: that step's operation and its rows; else null.
 */
export type Joins = (r: Row) => { op: Op; rows: Row[] } | null;

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

/** Whether `parts`, none of them a check, give the value of row `r` by `op`. */
const gives = (parts: readonly Row[], r: Row, op: Op): boolean =>
  parts.length > 0 &&
  !parts.some(isCond) &&
  parts.every((k) => Number.isFinite(vOf(k))) &&
  near(total(parts, op), vOf(r));

/** A step with no name of its own, whose expression only does `op` to its parts, which give its value. */
function isStep(r: Row, op: Op): boolean {
  const n = r.node;
  return (
    n.code === null &&
    r.open === null &&
    n.role === "piece" &&
    !isCond(r) &&
    !n.flags.truncated &&
    (!!n.flags.unnamed || byShapeOnly(n.name) || !!r.bySource) &&
    r.op === op &&
    gives(r.group ?? [], r, op)
  );
}

/**
 * The parts of row `r` in its place: each opens under the calls `r` opened under, and is a bonus in % when `r` is one
 * (rows.ts `percent`).
 */
export const movedUp = (r: Row, parts: Row[]): Row[] =>
  parts.map((k) => ({
    ...k,
    ...(r.seen && !k.seen ? { seen: r.seen } : {}),
    ...(r.percent ? { percent: true as const } : {}),
  }));

/**
 * A level's rows with each unnamed step replaced by its parts, all the way down, with their shares in the level;
 * `op` is how the rows give their parent (read from their shares when not given). The rows as they are when none moves.
 */
export function flatten(rows: Row[], op: Op | null = opOf(rows)): Row[] {
  if (!op || !rows.some((r) => isStep(r, op))) return rows;
  const out = rows.flatMap((r) =>
    isStep(r, op) ? movedUp(r, flatten(r.group ?? [], op)) : [r],
  );
  return withShares({ name: "", value: total(out, op) }, null, out).rows;
}

/**
 * A pool's rows (spec 009, FR-017) with no unnamed step and no working value of the root that only joins sources: such
 * a value gives its writer's rows (`joins`) to the pool when they give it by `op`, as an unnamed step does, all the way.
 */
export function dissolve(
  rows: Row[],
  op: Op,
  joins?: Joins,
  done: ReadonlySet<string> = new Set(),
): Row[] {
  const out = flatten(rows, op);
  const parts = (r: Row) => {
    const code = r.node.code;
    if (!joins || code === null || done.has(code)) return null;
    const got = joins(r);
    return got?.op === op && gives(got.rows, r, op) ? got.rows : null;
  };
  const got = out.map(parts);
  if (!got.some(Boolean)) return out;
  // a value dissolves once: its rows never bring it back
  const codes = out.flatMap((r, i) =>
    got[i] && r.node.code !== null ? [r.node.code] : [],
  );
  const next = out.flatMap((r, i) => {
    const parts = got[i];
    return parts ? movedUp(r, parts) : [r];
  });
  const level = dissolve(next, op, joins, new Set([...done, ...codes]));
  return withShares({ name: "", value: total(level, op) }, null, level).rows;
}
