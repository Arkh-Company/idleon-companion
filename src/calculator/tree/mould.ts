// The first level of a tree. The steps (spec 008, FR-006; T017 "a step never named fixed"): the game's steps of the
// root's block, in the game's order, as the assembly gives them (tree-build.ts), each with its bonus's name, and never a
// name by its shape such as "Fixed +2"; a step with no proven name says so: the generic name and `unnamed` (FR-012a).
// The mould (spec 009, FR-001, FR-002, FR-004 to FR-006): those rows in the game's pools (tree/pools.ts), and inside
// each pool by system (tree/systems.ts), in the V1 order of the bench (build-v1mold.cjs), "🔹 Other" last.
import { fx3 } from "./curves.ts";
import { isConstant, termsOf, vOf } from "./formulas.ts";
import { formulaOut } from "./math.ts";
import { chainPools, poolsOf, poolsPair, rootExtreme } from "./pools.ts";
import type { Combine, OwnCache, Pool, TermAt, TermRow } from "./pools.ts";
import { GENERIC_NAME, row, withShares } from "./rows.ts";
import type { Node, Row } from "./rows.ts";
import { termOf } from "./share.ts";
import { SYSTEM_ORDER, systemLabel, systemOf, V1_SYSTEMS } from "./systems.ts";
import type { System } from "./systems.ts";
import type { Expr, Step } from "./steps.ts";

/** The root's rows as its steps: a step named by its shape loses that name; a branch's own rows are its parts, with
 * their names by shape for its ⓘ. */
export function mould(rows: readonly Row[]): Row[] {
  return rows.map((r) => {
    const own = isConstant(r.node)
      ? {
          ...r,
          node: {
            ...r.node,
            name: GENERIC_NAME,
            flags: { ...r.node.flags, unnamed: true },
          },
        }
      : r;
    return own;
  });
}

/** The block that writes the cache a row reads (its call, written as tree/rows.ts `callText`), when it has one. */
export type WriterOf = (r: Row) => string | undefined;

const OTHER = V1_SYSTEMS.at(-1) ?? { name: "Other", emoji: "🔹" };

/**
 * The system of a row (spec 009, FR-003): its source's, by tree/systems.ts; a branch's, when every source in it has the
 * same one. Undefined for a row with no source (a constant of the code); null for an unknown or a mixed one.
 */
function systemOfRow(r: Row, writerOf: WriterOf): System | null | undefined {
  if (r.node.code !== null) return systemOf(r.node.code, writerOf(r));
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

/** A system's group of `rows`, its value their sum or product, its sources in the game's order (FR-002, FR-013). */
function systemRow(s: System, combine: Combine, rows: Row[]): Row {
  if (combine === "max" || combine === "min")
    return extremeRow(s, combine, rows);
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
function ownPair(
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
 * the rows stay as they are (FR-001). The parts at 0 and at ×1 go to their systems.
 */
export function bySystem(
  rows: readonly Row[],
  combine: Combine,
  writerOf: WriterOf,
): readonly Row[] {
  const groups = new Map<System, Row[]>();
  for (const r of rows) {
    const s = systemOfRow(r, writerOf) ?? OTHER;
    groups.set(s, [...(groups.get(s) ?? []), r]);
  }
  if (groups.size === 1 && groups.has(OTHER)) return rows;
  const rank = (s: System) =>
    s === OTHER ? Infinity : SYSTEM_ORDER.indexOf(s.name);
  return [...groups]
    .sort(([a], [b]) => rank(a) - rank(b))
    .flatMap(([s, rs]) => (rs.length === 1 ? rs : [systemRow(s, combine, rs)]));
}

/** A pool's row (FR-005): its name and value, how its rows give it, and its rows by system. */
function poolRow(p: Pool, writerOf: WriterOf): Row {
  const level = [...bySystem(p.rows, p.combine, writerOf)];
  const pct = p.combine === "onePlusPercent";
  // 1 + (its groups) ÷ 100: the ⓘ the parts' own sum or product would not give
  const pair: [string, string] | null = pct
    ? [
        `1 + (${level.map((r) => termOf(r.node)).join(" + ")}) ÷ 100`,
        `1 + (${level.map((r) => fx3(vOf(r))).join(" + ")}) ÷ 100 = ${fx3(p.value)}`,
      ]
    : ownPair(level, p.combine === "product", p.value);
  const node = row({
    pieceKey: null,
    value: p.value,
    code: null,
    name: p.name,
    role: "pool",
    combine: p.combine,
    poolKind: p.kind,
    fmt: p.combine === "sum" ? null : "x",
    flags: { closed: true },
    formula: pair && formulaOut(pair, termsOf(level)),
  });
  return { node, open: null, group: withShares(node, pair, level).rows };
}

/** The root's first level as its pools (FR-005), each with its share of the root, and the root's ⓘ. */
export function poolRows(
  pools: readonly Pool[],
  root: { name: string; value: Node["value"] },
  writerOf: WriterOf,
): { rows: Row[]; formula: Node["formula"] } {
  const v = root.value;
  const pair = poolsPair(
    pools,
    typeof v === "boolean" ? Number(v) : (v ?? NaN),
  );
  const rows = pools.map((p) => poolRow(p, writerOf));
  return {
    rows: withShares(root, pair, rows).rows,
    formula:
      pair &&
      formulaOut(
        pair,
        pools.map((p) => p.name),
      ),
  };
}

/**
 * What the first level reads of the root's call: its last step, a term of it as a row, a cache's writer; and all its
 * steps with a term of any of them as a row, for its chain of steps.
 */
export interface FirstLevelContext {
  expr: Expr | null;
  term: TermRow;
  writerOf: WriterOf;
  steps?: readonly Step[];
  termAt?: TermAt;
  ownCache?: OwnCache;
}

/**
 * The root's first level (spec 009, FR-001, FR-005): the steps (`rows`, named by `mould`) in the game's pools, by
 * system; with no pool and a max or a min at the top, the steps by system under that rule (US2 scenario 4); else the
 * steps as they are. The root's ⓘ is how its pools or groups give it, over the step's own.
 */
export function firstLevel(
  rows: Row[],
  root: Pick<Node, "name" | "value" | "formula">,
  { expr, term, writerOf, steps, termAt, ownCache }: FirstLevelContext,
): { rows: Row[]; formula: Node["formula"]; chainOpen?: true } {
  // a chain of steps gives its pools from the steps (rule Y); a root of one step, from its rows
  const read =
    steps && termAt ? chainPools(steps, root, termAt, ownCache) : null;
  // a chain the pools cannot read falls back to the rows, and says so (NFR-005)
  const open = read === "open" ? ({ chainOpen: true } as const) : {};
  const chain = read === "open" ? null : read;
  const pools = chain ?? poolsOf(rows, { value: root.value, expr }, term);
  if (pools) {
    // a step's terms keep their names by shape, as under the step in the 008; the steps of one step lose theirs
    const out = poolRows(
      chain ? pools : pools.map((p) => ({ ...p, rows: mould(p.rows) })),
      root,
      writerOf,
    );
    // FR-008: the root's checks, which no step of the chain shows, stay after its pools
    const checks = chain ? rows.filter((r) => r.node.leaf === "condition") : [];
    return {
      rows: [...out.rows, ...checks],
      formula: out.formula ?? root.formula,
      ...open,
    };
  }
  const rule = rootExtreme(rows, { value: root.value, expr });
  const level = rule ? bySystem(rows, rule, writerOf) : rows;
  if (!rule || level === rows) return { rows, formula: root.formula, ...open };
  const v = vOf({ node: root as Node });
  const pair: [string, string] = [
    `${rule}(${level.map((r) => termOf(r.node)).join(", ")})`,
    `${rule}(${level.map((r) => fx3(vOf(r))).join(", ")}) = ${fx3(v)}`,
  ];
  // the groups' ⓘ over the step's own, as the pools' (each group's name kept whole)
  const names = level.map((r) => termOf(r.node));
  return {
    rows: withShares(root, pair, [...level]).rows,
    formula: formulaOut(pair, [...termsOf(level), ...names]) ?? root.formula,
    ...open,
  };
}
