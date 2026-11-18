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
import {
  chainPools,
  poolsOf,
  poolsPair,
  rootExtreme,
  through,
} from "./pools.ts";
import type { OwnCache, Pool, TermAt, TermRow } from "./pools.ts";
import { GENERIC_NAME, row, withShares } from "./rows.ts";
import type { Node, Row } from "./rows.ts";
import { termOf } from "./share.ts";
import type { Expr, Step } from "./steps.ts";
import { bySystem, ownPair } from "./groups.ts";
import type { WriterOf } from "./groups.ts";

export { bySystem } from "./groups.ts";
export type { WriterOf } from "./groups.ts";

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
  /** The call's rows are a pass of the game's own, not its steps' terms (tree/raw-passes.ts, tree/gold-food.ts). */
  passed?: boolean;
}

/** The rows of the 008 no step of the call shows: its checks and its data rows (FR-008). */
function restOf(rows: readonly Row[], steps?: readonly Step[]): Row[] {
  const shown = new Set((steps ?? []).flatMap((st) => readsOf(st.e)));
  return rows.filter(
    (r) =>
      r.node.leaf === "condition" ||
      (r.node.code !== null &&
        !r.node.code.includes("(") &&
        !shown.has(r.node.code)),
  );
}

/**
 * The pools' rows (`chain`: a chain's, from its steps' terms) with, after a chain's or when `keep`, the rows of the 008 no
 * step shows (FR-008).
 */
function pooledLevel(
  rows: Row[],
  root: Pick<Node, "name" | "value">,
  pools: readonly Pool[],
  chain: boolean,
  { steps, writerOf, joins }: FirstLevelContext,
  keep = chain,
): { rows: Row[]; formula: Node["formula"] } {
  // a step's terms keep their names by shape, as under the step in the 008; the steps of one step lose theirs
  const out = poolRows(
    chain ? pools : pools.map((p) => ({ ...p, rows: mould(p.rows) })),
    root,
    writerOf,
    joins,
  );
  // its checks and its data rows stay after the pools
  const rest = keep ? restOf(rows, steps) : [];
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
  const done = (out: { rows: Row[]; formula: Node["formula"] }) => ({
    rows: out.rows,
    formula: out.formula ?? root.formula,
    ...open,
  });
  if (chain) return done(pooledLevel(rows, root, chain, true, ctx));
  // T025: a round or a clamp at the top that changes nothing is read through
  const v = vOf({ node: root as Node });
  const step = expr && Number.isFinite(v) ? through(expr, v) : expr;
  const own = poolsOf(rows, { value: root.value, expr: step }, term);
  if (own) return done(pooledLevel(rows, root, own, false, ctx));
  // T025: the rows no step shows (its checks, its reads) stay after the pools the others give
  const rest = new Set(restOf(rows, steps));
  const held = rows.filter((r) => !rest.has(r));
  const kept =
    rest.size && held.length
      ? poolsOf(held, { value: root.value, expr: step }, term)
      : null;
  if (kept) return done(pooledLevel(rows, root, kept, false, ctx, true));
  // T025: a root of one step whose rows do not give it (a coefficient times a source): its step's terms
  const one =
    read === null && steps && termAt && !ctx.passed
      ? chainPools(steps, root, termAt, ownCache, true)
      : null;
  if (Array.isArray(one)) return done(pooledLevel(rows, root, one, true, ctx));
  const rule = rootExtreme(rows, { value: root.value, expr });
  const level = rule ? bySystem(rows, rule, writerOf) : rows;
  if (!rule || level === rows) return { rows, formula: root.formula, ...open };
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
