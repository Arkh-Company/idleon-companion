// The first level of a tree. The steps (spec 008, FR-006; T017 "a step never named fixed"): the game's steps of the
// root's block, in the game's order, as the assembly gives them (tree-build.ts), each with its bonus's name, and never a
// name by its shape such as "Fixed +2"; a step with no proven name says so: the generic name and `unnamed` (FR-012a).
// The mould (spec 009, FR-001, FR-002, FR-004 to FR-006): those rows in the game's pools (tree/pools.ts), and inside
// each pool by system (tree/systems.ts), in the V1 order of the bench (build-v1mold.cjs), "🔹 Other" last.
import { fx3 } from "./curves.ts";
import { dissolve } from "./flatten.ts";
import type { Joins } from "./flatten.ts";
import { flat, topOp } from "./expr.ts";
import { isConstant, near, termsOf, vOf } from "./formulas.ts";
import { inPool, isStep } from "./inline.ts";
import { multiplierRow } from "./multiplier-rows.ts";
import { capInGroups } from "./caps.ts";
import { besidePools } from "./pool-rest.ts";
import { citing } from "./build-up.ts";
import { formulaOut } from "./math.ts";
import {
  chainPools,
  poolNames,
  poolsOf,
  poolsPair,
  rootExtreme,
  through,
} from "./pools.ts";
import { addsSources } from "./scaled.ts";
import { roundingOf } from "./tops.ts";
import type { Rounding } from "./tops.ts";
import type { OwnCache, Pool, TermAt, TermRow } from "./pools.ts";
import { GENERIC_NAME, row, withShares } from "./rows.ts";
import type { Node, Row } from "./rows.ts";
import { termOf } from "./share.ts";
import type { Expr, Step } from "./steps.ts";
import { bySystem, ownPair } from "./groups.ts";
import type { WriterOf } from "./groups.ts";

export { bySystem } from "./groups.ts";

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
  const [part] = p.rows;
  if (p.lone && part)
    return {
      ...part,
      node: { ...part.node, fmt: p.kind === "multi" ? "x" : "+" },
    };
  const op =
    p.combine === "product"
      ? "*"
      : p.combine === "sum" || p.combine === "onePlusPercent"
        ? "+"
        : null;
  const parts = op ? dissolve(p.rows, op, joins) : p.rows;
  // fix tree-shape-091, rule 2: in a product, each multiplier of one source is its × row by its source's name, the
  // factors of a floored product too (rule 3); in a product or a sum, a bonus times a count is its bonus's row (round
  // 1); a row of caps has its rows by system (rule 4)
  const product = p.combine === "product";
  const made = new Set<Row>();
  const times = (r: Row): Row => {
    const m = r.capped
      ? capInGroups(r, writerOf, (f, name) =>
          poolRow(
            {
              kind: "multi",
              name,
              value: vOf(f),
              combine: "onePlusPercent",
              rows: f.factorPool ?? [],
            },
            writerOf,
          ),
        )
      : multiplierRow(r, product);
    if (m !== r && !r.capped) made.add(m);
    return m;
  };
  const rows = parts.map((r) =>
    r.clamp
      ? { ...r, clamp: { ...r.clamp, rows: r.clamp.rows.map(times) } }
      : times(r),
  );
  const pct = p.combine === "onePlusPercent";
  // 1 + (its groups) ÷ 100: the ⓘ the parts' own sum or product would not give
  const pairOf = (lv: readonly Row[]): [string, string] | null =>
    pct
      ? [
          `1 + (${lv.map((r) => termOf(r.node)).join(" + ")}) ÷ 100`,
          `1 + (${lv.map((r) => fx3(vOf(r))).join(" + ")}) ÷ 100 = ${fx3(p.value)}`,
        ]
      : ownPair(lv, p.combine === "product", p.value);
  // FR-017: an unnamed step of a mixed math moves up, its ⓘ in the pool's (tree/inline.ts), its constants in that ⓘ only
  // (fix tree-shape-091: no constant loose in a pool); the other rows by system. A step that only adds or only multiplies is no such step:
  // `dissolve` takes in the first kind, and the second is a term of the pool (a talent times a count, FR-003); a
  // floored product goes into its system's group (rule 3), and a multiplier's row stays, of a source with no name too
  const mixed = (r: Row) => isStep(r) && !r.op && !r.clamp && !made.has(r);
  const steps = rows.filter(mixed);
  const apart = steps.length
    ? inPool(
        p,
        [
          ...bySystem(
            rows.filter((r) => !mixed(r)),
            p.combine,
            writerOf,
          ),
          ...steps,
        ],
        pairOf,
        mixed,
        (k) => !isConstant(k.node),
      )
    : null;
  const level = apart?.rows ?? [...bySystem(rows, p.combine, writerOf)];
  const pair = pairOf(level);
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
    // its rows named whole, a name with a colon or a sign too ("Beanstalk: …", "Fixed +2")
    formula: apart
      ? apart.formula
      : pair &&
        formulaOut(pair, [
          ...termsOf(level),
          ...level.map((r) => termOf(r.node)),
        ]),
  });
  return {
    node,
    open: null,
    group: apart ? apart.rows : withShares(node, pair, level).rows,
  };
}

/**
 * The pools with each factor 1 + (a + b + …) ÷ 100 of several sources inside a product pool (of a step the chain reads
 * back, tree/terms.ts `factorPool`) its own Multi pool after that pool, its bonuses its rows by system (FR-005, fix
 * tree-shape-091 round 1), all named again; the pools as they are with none.
 */
export function splitFactors(
  pools: readonly Pool[],
  joins?: Joins,
): readonly Pool[] {
  const out = pools.flatMap((p): Omit<Pool, "name">[] => {
    if (p.combine !== "product") return [p];
    const rows = dissolve(p.rows, "*", joins);
    const factors = rows.filter((r) => r.factorPool?.length);
    if (!factors.length) return [p];
    const rest = rows.filter((r) => !factors.includes(r));
    const own = factors.map((r) => ({
      kind: "multi" as const,
      combine: "onePlusPercent" as const,
      join: "*" as const,
      value: vOf(r),
      rows: r.factorPool ?? [],
    }));
    const value = rest.reduce((a, r) => a * vOf(r), 1);
    return rest.length ? [{ ...p, value, rows: rest }, ...own] : own;
  });
  const split =
    out.length !== pools.length || out.some((p, i) => p !== pools[i]);
  return split
    ? poolNames(
        out.map(({ kind, value, rows, combine, join }) => ({
          kind,
          value,
          rows,
          combine,
          ...(join ? { join } : {}),
        })),
      )
    : pools;
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
  cite = true,
): ReturnType<typeof besidePools> {
  // a step's terms keep their names by shape, as under the step in the 008; the steps of one step lose theirs
  const out = poolRows(
    chain ? pools : pools.map((p) => ({ ...p, rows: mould(p.rows) })),
    root,
    writerOf,
    joins,
  );
  // its checks and its data rows stay after the pools
  const rest = keep ? restOf(rows, steps) : [];
  // only pools beside each other: a read a pool shows leaves (tree/pool-rest.ts)
  // its checks said in its ⓘ when `cite` (A39)
  return besidePools([...out.rows, ...rest], cite ? out.formula : null);
}

/**
 * A call of one step that multiplies, a factor of which adds the bonuses of two sources or more (the Meritocracy bonus
 * multiplier, audit family 14; Vinicius's answer B of 20/11): its pools are that step's (rule Y, FR-005).
 */
function factorStep(steps: readonly Step[], value: Node["value"]): boolean {
  const v = typeof value === "boolean" ? Number(value) : value;
  const st = v === null ? undefined : steps.findLast((s) => near(s.v, v));
  const e = st && through(st.e, st.v);
  return !!e && topOp(e) === "*" && flat(e, "*").some(addsSources);
}

/**
 * The level of a source that is itself a system computed as a chain (spec 009, FR-017), or of any call of one step whose
 * factor adds the bonuses of two sources or more (answer B of 20/11): the pools of its own chain or step (FR-005) by
 * system, its block's other rows after them (`rows`, its 008 rows), and how its pools give it; null for neither.
 */
export function chainLevel(
  rows: Row[],
  value: Node["value"],
  ctx: FirstLevelContext,
  system = true,
): { rows: Row[]; pair: [string, string] | null } | null {
  const { steps, termAt, ownCache } = ctx;
  if (!steps || !termAt) return null;
  const chain = system ? chainPools(steps, { value }, termAt, ownCache) : null;
  // its one step's pools only when a sum is among them (single multipliers alone are no pools of their own), and never
  // over the rows of a pass of the game's own (tree/gold-food.ts, tree/raw-passes.ts), as the root's
  const one =
    chain === null && !ctx.passed && factorStep(steps, value)
      ? chainPools(steps, { value }, termAt, ownCache, true)
      : null;
  const found =
    Array.isArray(one) && one.some((p) => p.combine !== "product")
      ? one
      : chain;
  if (!Array.isArray(found)) return null;
  const pools = splitFactors(found, ctx.joins);
  const v = typeof value === "boolean" ? Number(value) : (value ?? NaN);
  // its checks stay rows here: the ⓘ that says them is the pair's, made where the level is placed (tree/places.ts)
  return {
    rows: pooledLevel(rows, { name: "", value }, pools, true, ctx, true, false)
      .rows,
    pair: poolsPair(pools, v),
  };
}

/** The ⓘ of a rounded root: the rounding around how its pools give the value before it ("floor(Additive pool)"). */
export function roundedPair(
  r: Rounding,
  pools: readonly Pool[],
  v: number,
): [names: string, numbers: string] {
  const pair = poolsPair(pools, r.inner);
  const names = pair?.[0] ?? pools[0]?.name ?? "";
  const numbers = pair
    ? pair[1].replace(/ = [^=]*$/, "")
    : fx3(pools[0]?.value ?? r.inner);
  return [`${r.fn}(${names})`, `${r.fn}(${numbers}) = ${fx3(v)}`];
}

/**
 * The root's pools (spec 009, FR-005; T025): a chain's from its steps (rule Y), else from its rows, its step read through
 * a top that changes nothing, else from the rows its step shows, else from its one step's terms; null when none gives
 * the root. `open` says the chain could not be read (NFR-005).
 */
function pooled(
  rows: Row[],
  root: Pick<Node, "name" | "value" | "formula">,
  ctx: FirstLevelContext,
): {
  rows: Row[];
  formula: Node["formula"];
  /** The checks beside its pools its ⓘ says, no rows (A39). */
  checks: Row[];
  pools: readonly Pool[];
  open: boolean;
} | null {
  const { expr, term, steps, termAt, ownCache } = ctx;
  const read =
    steps && termAt ? chainPools(steps, root, termAt, ownCache) : null;
  const open = read === "open";
  // a factor of several sources inside a product pool is its own pool (round 1)
  const out = (pools0: readonly Pool[], chain: boolean, keep = chain) => {
    const pools = splitFactors(pools0, ctx.joins);
    return {
      ...pooledLevel(rows, root, pools, chain, ctx, keep),
      pools,
      open,
    };
  };
  if (Array.isArray(read)) return out(read, true);
  // T025: a round or a clamp at the top that changes nothing is read through
  const v = vOf({ node: root as Node });
  const step = expr && Number.isFinite(v) ? through(expr, v) : expr;
  const own = poolsOf(rows, { value: root.value, expr: step }, term);
  if (own) return out(own, false);
  // T025: the rows no step shows (its checks, its reads) stay after the pools the others give
  const rest = new Set(restOf(rows, steps));
  const held = rows.filter((r) => !rest.has(r));
  const kept =
    rest.size && held.length
      ? poolsOf(held, { value: root.value, expr: step }, term)
      : null;
  if (kept) return out(kept, false, true);
  // T025: a root of one step whose rows do not give it (a coefficient times a source): its step's terms
  const one =
    read === null && steps && termAt && !ctx.passed
      ? chainPools(steps, root, termAt, ownCache, true)
      : null;
  return Array.isArray(one) ? out(one, true) : null;
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
  const { expr, writerOf, steps } = ctx;
  const v = vOf({ node: root as Node });
  // T030 (decision of 18/11): a root its last step rounds (floor(…), STR) has the pools of the value before the
  // rounding, and the rounding stays in sight in its ⓘ (FR-008): "floor(Additive pool × Multi pool)"
  const rounding = Number.isFinite(v) ? roundingOf(expr, steps, v) : null;
  const rounded =
    rounding &&
    pooled(
      rows,
      { ...root, value: rounding.inner },
      {
        ...ctx,
        expr: rounding.e,
        ...(rounding.steps ? { steps: rounding.steps } : {}),
      },
    );
  if (rounding && rounded)
    return {
      rows: rounded.rows,
      // the checks beside its pools said after the rounding (A39)
      formula: citing(
        formulaOut(
          roundedPair(rounding, rounded.pools, v),
          rounded.pools.map((p) => p.name),
        ),
        rounded.checks,
      ),
      ...(rounded.open ? { chainOpen: true as const } : {}),
    };
  const own = pooled(rows, root, ctx);
  const open = own?.open ? ({ chainOpen: true } as const) : {};
  if (own)
    return { rows: own.rows, formula: own.formula ?? root.formula, ...open };
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
