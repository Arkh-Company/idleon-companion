// The parity against the bench's V1 mould (spec 009 T029, FR-010, decision of 18/11): the bench is the reference of the
// sources and their names, the format is the 009's. So the V1's own structure is not compared (its pools, LUK Scaling,
// Total Sum, the order of the factors): each source of the bench pairs with the app's of its name and value, then of
// its value, whatever pool or group holds it, and is compared in name, value, type and system, and row by row below it.
// A source missing, extra, or with another value, type or system is a difference.
import type { CalcTreeNode } from "./tree-contract.ts";
import { sameValue, systemOfGroup } from "./parity-values.ts";
import type { BenchRow, Difference } from "./parity-values.ts";

interface Side<T> {
  row: T;
  system: string | null;
  place: string;
  /** A V1 group of one source, written with its code: its name is the V1's label, no name of the source. */
  label?: true;
}

/** Whether the bench tree is the V1 mould: a system group at its first or second level. */
export const isV1 = (b: BenchRow): boolean =>
  (b.kids ?? []).some(
    (k) =>
      systemOfGroup(k.name) !== null ||
      (k.kids ?? []).some((x) => systemOfGroup(x.name) !== null),
  );

/** A constant of the math, between the sources: the format's, no source (below a source, it is compared as a row). */
const benchConstant = (b: BenchRow) =>
  b.kind === "Valor fixo" && b.code === undefined;
const appConstant = (a: CalcTreeNode) =>
  a.leaf === "fixedValue" && a.code === null;
const rowsOf = (a: CalcTreeNode) => (Array.isArray(a.kids) ? a.kids : []);

/** The bench's sources: the V1's pools (the root's rows) and system groups gone through, each with its group's system. */
function benchSources(root: BenchRow): Side<BenchRow>[] {
  const out: Side<BenchRow>[] = [];
  const add = (row: BenchRow, system: string | null, label = false) =>
    out.push({
      row,
      system,
      place: `0/${String(out.length)}`,
      ...(label ? { label: true as const } : {}),
    });
  const visit = (rows: readonly BenchRow[], system: string | null) => {
    for (const k of rows) {
      const own = systemOfGroup(k.name);
      if (benchConstant(k)) continue;
      if (own === null) add(k, system);
      else if (k.code === undefined && k.kids?.length) visit(k.kids, own);
      else add(k, own, true);
    }
  };
  for (const p of root.kids ?? [])
    visit(systemOfGroup(p.name) === null ? (p.kids ?? []) : [p], null);
  return out;
}

/**
 * The app's sources: its pools and system groups gone through, each with its group's system. The checks and reads a
 * root with pools shows after them (tree/mould.ts, FR-008) are the format's: the bench has them inside its sources.
 */
function appSources(root: CalcTreeNode): Side<CalcTreeNode>[] {
  const out: Side<CalcTreeNode>[] = [];
  const visit = (rows: readonly CalcTreeNode[], system: string | null) => {
    for (const k of rows)
      if (k.role === "pool") visit(rowsOf(k), system);
      else if (k.role === "system") visit(rowsOf(k), systemOfGroup(k.name));
      else if (!appConstant(k)) out.push({ row: k, system, place: "0" });
  };
  const rows = rowsOf(root);
  visit(
    rows.some((k) => k.role === "pool")
      ? rows.filter((k) => k.role === "pool")
      : rows,
    null,
  );
  return out;
}

/** Each bench source paired with an app source: by name and value, all of them, then by value. */
function pairUp(
  apps: readonly Side<CalcTreeNode>[],
  benches: readonly Side<BenchRow>[],
  pairs: Map<Side<BenchRow>, Side<CalcTreeNode>>,
): void {
  const taken = new Set(pairs.values());
  const take = (fits: (a: CalcTreeNode, b: BenchRow) => boolean) => {
    for (const b of benches) {
      if (pairs.has(b)) continue;
      const a = apps.find((x) => !taken.has(x) && fits(x.row, b.row));
      if (a) {
        pairs.set(b, a);
        taken.add(a);
      }
    }
  };
  take((a, b) => a.name === b.name && sameValue(a.value, b.v));
  take((a, b) => sameValue(a.value, b.v));
}

/** At most this many rounds of opening the sources left into their rows (a depth the Drop Rate never needs). */
const ROUNDS = 6;

/**
 * The app's tree against the bench's V1, source by source; `walk` compares a pair and the rows below it as the
 * comparison row by row does (parity-compare.ts).
 */
export function compareSources(
  app: CalcTreeNode,
  bench: BenchRow,
  out: Difference[],
  walk: (a: CalcTreeNode, b: BenchRow, path: string, at: string) => void,
): void {
  if (!sameValue(app.value, bench.v)) out.push({ at: "0", field: "value" });
  let apps = appSources(app);
  let benches = benchSources(bench);
  const pairs = new Map<Side<BenchRow>, Side<CalcTreeNode>>();
  pairUp(apps, benches, pairs);
  // a source one side keeps whole and the other opened into its rows (a cache read of the star signs the V1 opened, a
  // chain's step the app took apart) pairs through those rows: the app's side first, and the bench's only when opening
  // the app's pairs nothing more
  for (let i = 0; i < ROUNDS; i++) {
    const used = new Set(pairs.values());
    const before = pairs.size;
    const opened = apps.flatMap((a) =>
      !used.has(a) && rowsOf(a.row).length
        ? appSourcesOf(rowsOf(a.row), a.system)
        : [a],
    );
    const tried = new Map(pairs);
    pairUp(opened, benches, tried);
    if (tried.size > before) {
      apps = opened;
      for (const [b, a] of tried) pairs.set(b, a);
      continue;
    }
    const left = benches.filter((b) => !pairs.has(b) && b.row.kids?.length);
    if (!left.length) break;
    benches = benches.flatMap((b) =>
      left.includes(b)
        ? (b.row.kids ?? [])
            .filter((row) => !benchConstant(row))
            .map((row, j) => ({
              row,
              system: b.system,
              place: `${b.place}/${String(j)}`,
            }))
        : [b],
    );
    pairUp(apps, benches, pairs);
  }
  // last, a source of the same name and another value: a difference of value, not one missing and one extra
  const taken = new Set(pairs.values());
  for (const b of benches) {
    const a = pairs.has(b)
      ? undefined
      : apps.find((x) => !taken.has(x) && x.row.name === b.row.name);
    if (a) {
      pairs.set(b, a);
      taken.add(a);
    }
  }
  const used = new Set(pairs.values());
  for (const b of benches) {
    const a = pairs.get(b);
    if (!a) {
      out.push({ at: b.place, field: "shape" });
      continue;
    }
    // a source the app files under another system than the bench's
    if (b.system !== null && a.system !== null && a.system !== b.system)
      out.push({ at: b.place, field: "name" });
    walk(
      a.row,
      b.label ? { ...b.row, name: a.row.name } : b.row,
      b.row.name ?? "?",
      b.place,
    );
  }
  for (const a of apps) if (!used.has(a)) out.push({ at: "0", field: "shape" });
}

/** The rows of an app source opened, its groups gone through. */
function appSourcesOf(
  rows: readonly CalcTreeNode[],
  system: string | null,
): Side<CalcTreeNode>[] {
  return appSources({ kids: [...rows] } as CalcTreeNode).map((s) => ({
    ...s,
    system: s.system ?? system,
  }));
}
