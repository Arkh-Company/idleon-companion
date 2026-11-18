// No unnamed branch of the math (spec 009, T026, SC-001; FR-007): a branch with no proven name whose parts are one
// source and the game's constants or helpers (a log, a curve) is that source scaled, so it takes the source's proven
// name, as structurePass gives a vague row its one child's (tree/one-child.ts, bench pieces.cjs structurePass); through
// an unnamed branch of that same shape too. Two sources, a count (a quantity, a level: how many, not which bonus), or a
// source whose name is vague or only its shape, name nothing: the branch keeps the generic name, never a guess.
import { byShapeOnly } from "./flatten.ts";
import { isCond, isScaling } from "./formulas.ts";
import { MERGES, ONE_CHILD } from "./one-child.ts";
import type { Level } from "./places.ts";
import { withName } from "./row-checks.ts";
import type { Row } from "./rows.ts";
import { isHelper } from "./systems.ts";

type Under = (r: Row, at: Level) => Level | null;

/**
 * A part that is no source of its own: a constant of the code or of a game table, a helper of the math (a log, a
 * curve), or a check.
 */
const noSource = (r: Row): boolean =>
  isCond(r) ||
  r.node.leaf === "fixedValue" ||
  (r.node.code !== null && isHelper(r.node.code));

/**
 * Whether the level only multiplies its rows: their shares, the branch's own step `op`, or, with neither (a division,
 * tree/terms.ts exprRow), every part but the sources a constant that multiplies or divides (009 r2).
 */
const multiplies = (at: Level, op: Row["op"]): boolean =>
  op === "*" ||
  (at.rows.length > 0 &&
    at.rows.every(
      (r) =>
        r.node.shareMode === "product" || r.node.shareMode === "productZero",
    )) ||
  at.rows.every((r) => !noSource(r) || isScaling(r.node));

/**
 * The proven name of the one source among the rows of `at`, a branch of step `op`, through an unnamed branch of the same
 * shape; else null. Only a level that multiplies the source scales it: a constant added to it is part of the value that
 * is not the source's (009 r1, FR-007).
 */
function sourceName(
  at: Level,
  op: Row["op"],
  under: Under,
  depth: number,
): string | null {
  if (!multiplies(at, op)) return null;
  const parts = at.rows.filter((r) => !noSource(r));
  const [p] = parts;
  if (!p || parts.length !== 1) return null;
  if (!p.node.flags.unnamed) {
    const name = p.node.name;
    // a bonus names what it scales; a count (a quantity, a level, a choice) only how many
    const bonus = p.node.leaf === null || p.node.leaf === "rawBonus";
    return !bonus || ONE_CHILD.vague.test.test(name) || byShapeOnly(name)
      ? null
      : name;
  }
  const next = depth < MERGES ? under(p, at) : null;
  return next ? sourceName(next, p.op, under, depth + 1) : null;
}

/** Row `r` (with its level `at`) named after its one source, when it has no proven name; else as it is. */
export function scaledName(r: Row, at: Level | null, under: Under): Row {
  if (!at || !r.node.flags.unnamed || r.node.role !== "piece") return r;
  return withName(r, sourceName(at, r.op, under, 0));
}
