// The first level of a tree. The steps (spec 008, FR-006; T017 "a step never named fixed"): the game's steps of the
// root's block, in the game's order, as the assembly gives them (tree-build.ts), each with its bonus's name, and never a
// name by its shape such as "Fixed +2"; a step with no proven name says so: the generic name and `unnamed` (FR-012a).
// The mould (spec 009, FR-001, FR-002, FR-004 to FR-006): those rows in the game's pools (tree/pools.ts), and inside
// each pool by system (tree/systems.ts), in the V1 order of the bench (build-v1mold.cjs), "🔹 Other" last.
import { fx3 } from "./curves.ts";
import { dissolve } from "./flatten.ts";
import type { Joins } from "./flatten.ts";
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

/** The read paths an expression shows, at any depth. */
const readsOf = (e: Expr): string[] =>
  e.t === "read"
    ? [e.p]
    : e.t === "op"
      ? [...readsOf(e.l), ...readsOf(e.r)]
      : e.t === "fn"
        ? e.args.flatMap(readsOf)
        : e.t === "def"
          ? readsOf(e.e)
          : e.t === "not"
            ? readsOf(e.a)
            : [];

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

/**
 * A pool's row (FR-005): its name and value, how its rows give it, and its rows by system, with no unnamed sum nor any
 * working value of the root that only joins sources in the way (`joins`, FR-017).
 */
function poolRow(p: Pool, writerOf: WriterOf, joins?: Joins): Row {
  const op =
    p.combine === "product"
      ? "*"
      : p.combine === "sum" || p.combine === "onePlusPercent"
        ? "+"
        : null;
  const rows = op ? dissolve(p.rows, op, joins) : p.rows;
  const level = [...bySystem(rows, p.combine, writerOf)];
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
  joins?: Joins,
): { rows: Row[]; formula: Node["formula"] } {
  const v = root.value;
  const pair = poolsPair(
    pools,
    typeof v === "boolean" ? Number(v) : (v ?? NaN),
  );
  const rows = pools.map((p) => poolRow(p, writerOf, joins));
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
  /** A working value the root's own call wrote, as its writer's rows (FR-017). */
  joins?: Joins;
}

/** The pools' rows (`chain`: a chain's) with, after a chain's, the rows of the 008 no step of it shows (FR-008). */
function pooledLevel(
  rows: Row[],
  root: Pick<Node, "name" | "value">,
  pools: readonly Pool[],
  chain: boolean,
  { steps, writerOf, joins }: FirstLevelContext,
): { rows: Row[]; formula: Node["formula"] } {
  // a step's terms keep their names by shape, as under the step in the 008; the steps of one step lose theirs
  const out = poolRows(
    chain ? pools : pools.map((p) => ({ ...p, rows: mould(p.rows) })),
    root,
    writerOf,
    joins,
  );
  // its checks and its data rows stay after a chain's pools
  const shown = new Set((steps ?? []).flatMap((st) => readsOf(st.e)));
  const rest = chain
    ? rows.filter(
        (r) =>
          r.node.leaf === "condition" ||
          (r.node.code !== null &&
            !r.node.code.includes("(") &&
            !shown.has(r.node.code)),
      )
    : [];
  return { rows: [...out.rows, ...rest], formula: out.formula };
}

/**
 * The level of a source that is itself a system computed as a chain (spec 009, FR-017): the pools of its own chain (FR-005)
 * by system, its block's other rows after them (`rows`, its 008 rows), and how its pools give it; null for no chain.
 */
export function chainLevel(
  rows: Row[],
  value: Node["value"],
  ctx: FirstLevelContext,
): { rows: Row[]; pair: [string, string] | null } | null {
  const { steps, termAt, ownCache } = ctx;
  const pools =
    steps && termAt ? chainPools(steps, { value }, termAt, ownCache) : null;
  if (!Array.isArray(pools)) return null;
  const v = typeof value === "boolean" ? Number(value) : (value ?? NaN);
  return {
    rows: pooledLevel(rows, { name: "", value }, pools, true, ctx).rows,
    pair: poolsPair(pools, v),
  };
}

/**
 * The root's first level (spec 009, FR-001, FR-005): the steps (`rows`, named by `mould`) in the game's pools, by
 * system; with no pool and a max or a min at the top, the steps by system under that rule (US2 scenario 4); else the
 * steps as they are. The root's ⓘ is how its pools or groups give it, over the step's own.
 */
export function firstLevel(
  rows: Row[],
  root: Pick<Node, "name" | "value" | "formula">,
  ctx: FirstLevelContext,
): { rows: Row[]; formula: Node["formula"]; chainOpen?: true } {
  const { expr, term, writerOf, steps, termAt, ownCache } = ctx;
  // a chain of steps gives its pools from the steps (rule Y); a root of one step, from its rows
  const read =
    steps && termAt ? chainPools(steps, root, termAt, ownCache) : null;
  // a chain the pools cannot read falls back to the rows, and says so (NFR-005)
  const open = read === "open" ? ({ chainOpen: true } as const) : {};
  const chain = read === "open" ? null : read;
  const pools = chain ?? poolsOf(rows, { value: root.value, expr }, term);
  if (pools) {
    const out = pooledLevel(rows, root, pools, !!chain, ctx);
    return {
      rows: out.rows,
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
