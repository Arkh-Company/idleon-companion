// A level that has pools has only pools (spec 009, FR-005, FR-008; audit family 10): a read beside them that a pool
// already shows, at any depth, is no row of its own; a check beside them of a row of the level or of its pools is said
// in the level's ⓘ, after its math in words (FR-018, A39: an ⓘ of atoms becomes a rule then), and leaves only then.
// A read beside them no pool shows goes down to the source in a pool whose call read it, shown under it (`below`).
// Anything else beside the pools stays: no value leaves.
import { branchCheck, citing } from "./build-up.ts";
import { isCond, near, vOf } from "./formulas.ts";
import type { Row } from "./rows.ts";

type Formula = Row["node"]["formula"];

/** The rows under `rows`, at any depth. */
const inside = (rows: readonly Row[]): Row[] =>
  rows.flatMap((r) => [r, ...inside(r.group ?? [])]);

/** The rows of a level beside its pools, its ⓘ `f` with the checks it now says, and those checks. */
export function besidePools(
  rows: Row[],
  f: Formula,
): { rows: Row[]; formula: Formula; checks: Row[] } {
  const pools = rows.filter((r) => r.node.role === "pool");
  if (!pools.length) return { rows, formula: f, checks: [] };
  const held = inside(pools.flatMap((p) => p.group ?? []));
  const shown = (r: Row) =>
    r.node.role !== "pool" &&
    r.node.code !== null &&
    !isCond(r) &&
    held.some((k) => k.node.code === r.node.code && near(vOf(k), vOf(r)));
  // with no ⓘ, nothing can say a check: it stays a row then (A39)
  const checks = f
    ? rows.filter((r) => branchCheck(r, [...rows, ...held]))
    : [];
  return {
    checks,
    formula: citing(f, checks),
    rows: rows.filter((r) => !shown(r) && !checks.includes(r)),
  };
}

/** A read beside the pools that no pool can show: a bare read of a path, no call, no check. */
const isLoose = (r: Row): boolean =>
  r.node.role !== "pool" &&
  r.open === null &&
  !r.group?.length &&
  !isCond(r) &&
  !!r.node.code &&
  !r.node.code.includes("(");

/**
 * The rows of a level with pools, each read beside them that no pool shows moved down to the first source in a pool
 * that `read` says read it, as that source's `below` (audit family 10); a read no such source read stays.
 */
export function downToSources(
  rows: Row[],
  read: (source: Row, r: Row) => boolean,
): Row[] {
  const pools = rows.filter((r) => r.node.role === "pool");
  if (!pools.length) return rows;
  const held = inside(pools.flatMap((p) => p.group ?? []));
  const moved = new Map<Row, Row[]>();
  // (one a pool shows already leaves the level: besidePools)
  const shows = (r: Row) =>
    held.some((k) => k.node.code === r.node.code && near(vOf(k), vOf(r)));
  for (const r of rows.filter((x) => isLoose(x) && !shows(x))) {
    const s = held.find((k) => k.open !== null && read(k, r));
    if (s) moved.set(s, [...(moved.get(s) ?? []), r]);
  }
  if (!moved.size) return rows;
  const gone = new Set([...moved.values()].flat());
  const down = (r: Row): Row => {
    const more = moved.get(r);
    const group = r.group?.map(down);
    return {
      ...r,
      ...(group ? { group } : {}),
      ...(more ? { below: [...(r.below ?? []), ...more] } : {}),
    };
  };
  return rows.filter((r) => !gone.has(r)).map(down);
}
