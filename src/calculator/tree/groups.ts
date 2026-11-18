// The groups by system of a level (spec 009, FR-002 to FR-004, FR-017; T027, T028): a pool's rows, or a root's under a
// max or a min, one group per system in the V1 order, the systems beyond it after, "🔹 Other" last; a constant of the
// game's math and a helper with no source stand as their own rows.
import { fx3 } from "./curves.ts";
import { termsOf, vOf } from "./formulas.ts";
import { formulaOut } from "./math.ts";
import type { Combine } from "./pools.ts";
import { row, withShares } from "./rows.ts";
import type { Row } from "./rows.ts";
import { termOf } from "./share.ts";
import {
  isHelper,
  scaledTalent,
  SYSTEM_ORDER,
  systemLabel,
  systemOf,
  V1_SYSTEMS,
} from "./systems.ts";
import type { System } from "./systems.ts";

/** The block that writes the cache a row reads (its call, written as tree/rows.ts `callText`), when it has one. */
export type WriterOf = (r: Row) => string | undefined;

const OTHER = V1_SYSTEMS.at(-1) ?? { name: "Other", emoji: "🔹" };

/**
 * The system of a row (spec 009, FR-003): its source's, by tree/systems.ts; a branch's, when every source in it has the
 * same one. Undefined for a row with no source (a constant of the code); null for an unknown or a mixed one.
 */
function systemOfRow(r: Row, writerOf: WriterOf): System | null | undefined {
  // a helper's (a curve, a log) is its sources' (T028)
  if (r.node.code !== null && !isHelper(r.node.code))
    return systemOf(r.node.code, writerOf(r));
  // a talent multiplied by a count is the talent's (009 T029)
  const talent = r.op === "*" ? scaledTalent(r.group ?? []) : null;
  if (talent) return systemOfRow(talent, writerOf);
  const inner = (r.group ?? [])
    .map((k) => systemOfRow(k, writerOf))
    .filter((s) => s !== undefined);
  if (!inner.length) return undefined;
  return inner.every((s) => s === inner[0]) ? (inner[0] ?? null) : null;
}

/** A group under a root with a max or a min at the top: the same rule over its sources, with its ⓘ ("max(…)"). */
function extremeRow(s: System, rule: "max" | "min", rows: Row[]): Row {
  const vals = rows.map(vOf);
  const value = vals.every(Number.isFinite) ? Math[rule](...vals) : null;
  const pair: [string, string] | null =
    value === null
      ? null
      : [
          `${rule}(${rows.map((r) => termOf(r.node)).join(", ")})`,
          `${rule}(${vals.map(fx3).join(", ")}) = ${fx3(value)}`,
        ];
  const fmts = new Set(rows.map((r) => r.node.fmt));
  const node = row({
    pieceKey: null,
    value,
    code: null,
    name: systemLabel(s),
    role: "system",
    combine: rule,
    poolKind: null,
    // the format of its sources when they share one
    fmt: fmts.size === 1 ? (rows[0]?.node.fmt ?? null) : null,
    flags: { closed: true, ...(value === null ? { unavailable: true } : {}) },
    formula: pair && formulaOut(pair, termsOf(rows)),
  });
  return { node, open: null, group: withShares(node, pair, rows).rows };
}

/**
 * A system's group of bonuses in % the game sums and divides by 100 (FR-017): its value their sum ÷ 100, what it adds
 * to its pool, with that ⓘ; each bonus's share is of their sum.
 */
function percentRow(s: System, rows: Row[]): Row {
  const vals = rows.map(vOf);
  const sum = vals.every(Number.isFinite)
    ? vals.reduce((a, x) => a + x, 0)
    : null;
  const value = sum === null ? null : sum / 100;
  const node = row({
    pieceKey: null,
    value,
    code: null,
    name: systemLabel(s),
    role: "system",
    combine: "percent",
    poolKind: null,
    fmt: "%",
    flags: { closed: true, ...(value === null ? { unavailable: true } : {}) },
  });
  const group = withShares({ name: node.name, value: sum }, null, rows).rows;
  const one = rows.length === 1;
  const pair: [string, string] | null =
    value === null
      ? null
      : [
          `${one ? "" : "("}${group.map((r) => termOf(r.node)).join(" + ")}${one ? "" : ")"} ÷ 100`,
          `${one ? "" : "("}${vals.map(fx3).join(" + ")}${one ? "" : ")"} ÷ 100 = ${fx3(value)}`,
        ];
  return {
    node: { ...node, formula: pair && formulaOut(pair, termsOf(group)) },
    open: null,
    group,
  };
}

/** A system's group of `rows`, its value their sum or product, its sources in the game's order (FR-002, FR-013). */
function systemRow(s: System, combine: Combine, rows: Row[]): Row {
  if (combine === "max" || combine === "min")
    return extremeRow(s, combine, rows);
  if (combine === "percent") return percentRow(s, rows);
  const product = combine === "product";
  const vals = rows.map(vOf);
  const value = vals.every(Number.isFinite)
    ? vals.reduce((a, x) => (product ? a * x : a + x), product ? 1 : 0)
    : null;
  const node = row({
    pieceKey: null,
    value,
    code: null,
    name: systemLabel(s),
    role: "system",
    combine: product ? "product" : "sum",
    poolKind: null,
    // FR-002: the format of the parts, a multiplier's or a bonus's (a percent in 1 + (bonuses) ÷ 100)
    fmt: product ? "x" : combine === "onePlusPercent" ? "%" : "+",
    flags: { closed: true, ...(value === null ? { unavailable: true } : {}) },
  });
  // every source in its place (FR-016)
  const group = withShares(node, null, rows).rows;
  const pair = value === null ? null : ownPair(group, product, value);
  return {
    node: { ...node, formula: pair && formulaOut(pair, termsOf(group)) },
    open: null,
    group,
  };
}

/** The ⓘ of a pool or group from its rows: their sum or product; none for a single row (it is the row's). */
export function ownPair(
  rows: readonly Row[],
  product: boolean,
  value: number,
): [string, string] | null {
  if (rows.length < 2) return null;
  const op = product ? " × " : " + ";
  return [
    rows.map((r) => termOf(r.node)).join(op),
    `${rows.map((r) => fx3(vOf(r))).join(op)} = ${fx3(value)}`,
  ];
}

/**
 * The rows of a pool (or of the root, with no pool) by system (FR-002, FR-004, FR-006): one group per system in the V1
 * order, "🔹 Other" last, a group at 0 or ×1 in its place; a lone source stands alone; when every source is in "Other",
 * the rows stay as they are (FR-001). The parts at 0 and at ×1 go to their systems. A constant of the game's math (a
 * row with no source) is no system's: it stays its own row, after the groups (T027), but for one in %.
 */
export function bySystem(
  rows: readonly Row[],
  combine: Combine,
  writerOf: WriterOf,
): readonly Row[] {
  // the bonuses in % a sum ÷ 100 gives (FR-017) are a group of their own in their system, after its other sources
  const groups = new Map<string, { s: System; pct: boolean; rows: Row[] }>();
  const constants: Row[] = [];
  for (const r of rows) {
    const found = systemOfRow(r, writerOf);
    // a constant in % adds a hundredth of its value only inside a group in % (FR-017), so it stays in "Other"'s
    if (found === undefined && !r.percent) {
      constants.push(r);
      continue;
    }
    const s = found ?? OTHER;
    const pct = !!r.percent;
    const key = `${s.name}|${String(pct)}`;
    const g = groups.get(key) ?? { s, pct, rows: [] };
    groups.set(key, { ...g, rows: [...g.rows, r] });
  }
  const [only] = groups.values();
  if (groups.size <= 1 && (!only || (only.s === OTHER && !only.pct)))
    return rows;
  // a system beyond the V1 after the V1's, in the order of the sum (the sort keeps it), "Other" last (FR-004)
  const at = (s: System) =>
    s === OTHER
      ? SYSTEM_ORDER.length
      : SYSTEM_ORDER.includes(s.name)
        ? SYSTEM_ORDER.indexOf(s.name)
        : SYSTEM_ORDER.length - 1;
  const rank = ({ s, pct }: { s: System; pct: boolean }) =>
    at(s) * 2 + Number(pct);
  // a lone bonus in % stays a group: it adds a hundredth of its value
  return [
    ...[...groups.values()]
      .sort((a, b) => rank(a) - rank(b))
      .flatMap(({ s, pct, rows: rs }) =>
        pct
          ? [systemRow(s, "percent", rs)]
          : rs.length === 1
            ? rs
            : [systemRow(s, combine, rs)],
      ),
    ...constants,
  ];
}
