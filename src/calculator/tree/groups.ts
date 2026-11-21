// The groups by system of a level (spec 009, FR-002 to FR-004, FR-017; T027, T028): a pool's rows, or a root's under a
// max or a min, one group per system in the V1 order, the systems beyond it after; a source of no proven system, a
// constant of the game's math and a helper with no source stand as their own rows after them, never in a group "🔹
// Other" (Vinicius, 19/11: the game has no system Other).
import { fx3 } from "./curves.ts";
import { termsOf, vOf } from "./formulas.ts";
import { formulaOut } from "../recorded/math.ts";
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
  // a row of a multiplier, or of a bonus times a count, is its source's (tree/multiplier-rows.ts); a row of caps, of no
  // system, its rows by system (rule 4)
  if (r.head) return systemOfRow(r.head, writerOf);
  if (r.capped) return null;
  // a helper's (a curve, a log) is its sources' (T028)
  if (r.node.code !== null && !isHelper(r.node.code))
    return systemOf(r.node.code, writerOf(r));
  // a talent multiplied by a count is the talent's (009 T029): its step, or its rows' shares, a product (T030)
  const group = r.group ?? [];
  const product =
    r.op === "*" ||
    (group.length > 0 &&
      group.every(
        (k) =>
          k.node.shareMode === "product" || k.node.shareMode === "productZero",
      ));
  const talent = product ? scaledTalent(group) : null;
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

/**
 * A system's group in a product with a floor or a cap of the game around some of its sources (fix tree-shape-091, rule
 * 3; the clamp's answer B): each factor of the floored product a row of the group, the floor and the cap in its ⓘ
 * ("max(1, Ancient Golem × Chippy) × Santa Snake"), closing on the group's value.
 */
function clampedRow(node: Row["node"], rows: readonly Row[]): Row {
  const shown = rows.flatMap((r) => r.clamp?.rows ?? [r]);
  const line = (each: (k: Row) => string) =>
    rows
      .map((r) =>
        r.clamp
          ? `${r.clamp.fn}(${fx3(r.clamp.bound)}, ${r.clamp.rows.map(each).join(" × ")})`
          : each(r),
      )
      .join(" × ");
  const pair: [string, string] | null =
    node.value === null
      ? null
      : [
          line((k) => termOf(k.node)),
          `${line((k) => fx3(vOf(k)))} = ${fx3(Number(node.value))}`,
        ];
  const group = withShares(node, pair, shown).rows;
  return {
    node: {
      ...node,
      formula:
        pair &&
        formulaOut(pair, [
          ...termsOf(group),
          ...group.map((k) => termOf(k.node)),
        ]),
    },
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
  // every source in its place (FR-016); a floored product's factors are rows of the group, its rule in its ⓘ (rule 3)
  if (product && rows.some((r) => r.clamp)) return clampedRow(node, rows);
  const group = withShares(node, null, rows).rows;
  const pair = value === null ? null : ownPair(group, product, value);
  return {
    node: { ...node, formula: pair && formulaOut(pair, termsOf(group)) },
    open: null,
    group,
  };
}

/**
 * The ⓘ of a pool or group from its rows: their sum or product, a bonus in % standing alone divided by 100 (FR-017),
 * and so a group in %, in the unit its row shows (+24% is 24 ÷ 100); none for a single row that gives it whole (it is
 * the row's).
 */
export function ownPair(
  rows: readonly Row[],
  product: boolean,
  value: number,
): [string, string] | null {
  const inPercent = (r: Row) => r.node.combine === "percent";
  const cuts = (r: Row) => !!r.percent || inPercent(r);
  if (rows.length < 2 && !rows.some(cuts)) return null;
  const op = product ? " × " : " + ";
  const cut = (r: Row, t: string) => (cuts(r) ? `${t} ÷ 100` : t);
  const shown = (r: Row) => (inPercent(r) ? vOf(r) * 100 : vOf(r));
  // a product of numbers each rounded to 3 decimals may miss its value by more than the ⓘ's 1e-3: then 7 digits
  const rounded = rows.reduce((p, r) => p * Number(fx3(vOf(r))), 1);
  const exact =
    product && Math.abs(rounded - value) > 1e-3 * Math.max(1, Math.abs(value));
  const num = (v: number) => (exact ? String(+v.toPrecision(7)) : fx3(v));
  return [
    rows.map((r) => cut(r, termOf(r.node))).join(op),
    `${rows.map((r) => cut(r, num(shown(r)))).join(op)} = ${fx3(value)}`,
  ];
}

/**
 * The rows of a pool (or of the root, with no pool) by system (FR-002, FR-004, FR-006): one group per system in the V1
 * order, a group at 0 or ×1 in its place; a named system's lone source is its group too (fix tree-shape-091, rule 1);
 * a source of no proven system stands alone after the groups, a bonus in % as its +N% that its pool's ⓘ divides by
 * 100, never in a group "🔹 Other" (Vinicius, 19/11); when no source has a system, the rows stay as they are (FR-001).
 * The parts at 0 and at ×1 go to their systems. A constant of the game's math (a row with no source) is no system's: it
 * stays its own row, after the groups (T027).
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
    // a constant in % adds a hundredth of its value (FR-017): it stands as its +N%, as a source of no system
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
  // no source of a system, in % or not: the rows stay as they are (FR-001), the % forcing no group, each as its +N%, its
  // pool's ⓘ dividing it by 100 (A34, option B of 20/11)
  const all = [...groups.values()];
  if (all.every((g) => g.s === OTHER))
    return all.some((g) => g.pct)
      ? rows.map((r) =>
          r.percent ? { ...r, node: { ...r.node, fmt: "%" as const } } : r,
        )
      : rows;
  // a system beyond the V1 after the V1's, in the order of the sum (FR-004); each system's group in % right after its
  // own (A34)
  const first = all.map((g) => g.s.name);
  const at = (s: System) =>
    SYSTEM_ORDER.includes(s.name)
      ? SYSTEM_ORDER.indexOf(s.name)
      : SYSTEM_ORDER.length - 1 + first.indexOf(s.name);
  const rank = ({ s, pct }: { s: System; pct: boolean }) =>
    at(s) * 2 + Number(pct);
  // a named system is always a group, of one source too, in % or not (fix tree-shape-091, rule 1: Vinicius, 19/11, every
  // system that weighs on a value shows as its child); a source of no system stands alone after them, in its order
  const loose = rows.filter((r) => {
    const g = groups.get(`${OTHER.name}|${String(!!r.percent)}`);
    return !!g?.rows.includes(r);
  });
  return [
    ...all
      .filter((g) => g.s !== OTHER)
      .sort((a, b) => rank(a) - rank(b))
      .map(({ s, pct, rows: rs }) =>
        systemRow(s, pct ? "percent" : combine, rs),
      ),
    ...loose.map((r) =>
      r.percent ? { ...r, node: { ...r.node, fmt: "%" as const } } : r,
    ),
    ...constants,
  ];
}
