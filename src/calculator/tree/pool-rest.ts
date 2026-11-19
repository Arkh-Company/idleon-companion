// A level that has pools has only pools (spec 009, FR-005, FR-008; audit family 10): a read beside them that a pool
// already shows, at any depth, is no row of its own; a check beside them of a row of the level or of its pools is said
// in the level's ⓘ of words (FR-018, A39), and leaves only then. Anything else beside the pools stays: no value leaves.
import { branchCheck, citing } from "./build-up.ts";
import { isCond, near, vOf } from "./formulas.ts";
import type { Row } from "./rows.ts";

type Formula = Row["node"]["formula"];

/** The rows under `rows`, at any depth. */
const inside = (rows: readonly Row[]): Row[] =>
  rows.flatMap((r) => [r, ...inside(r.group ?? [])]);

/** The rows of a level beside its pools, and its ⓘ `f` with the checks it now says. */
export function besidePools(
  rows: Row[],
  f: Formula,
): { rows: Row[]; formula: Formula } {
  const pools = rows.filter((r) => r.node.role === "pool");
  if (!pools.length) return { rows, formula: f };
  const held = inside(pools.flatMap((p) => p.group ?? []));
  const shown = (r: Row) =>
    r.node.role !== "pool" &&
    r.node.code !== null &&
    !isCond(r) &&
    held.some((k) => k.node.code === r.node.code && near(vOf(k), vOf(r)));
  // an ⓘ of atoms (the pools' chain) cannot say a check: it stays a row then (A39)
  const words = !!f && !Array.isArray(f);
  const checks = words
    ? rows.filter((r) => branchCheck(r, [...rows, ...held]))
    : [];
  return {
    formula: citing(f, checks),
    rows: rows.filter((r) => !shown(r) && !checks.includes(r)),
  };
}
