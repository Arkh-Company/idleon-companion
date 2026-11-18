// The game's pools of a tree's first level (spec 009, FR-005, research R1): how the root's rows give its value. A root
// whose rows add up to it is one Additive pool; one whose rows multiply to it has a pool per factor, an Additive one when
// the factor sums the bonuses of two sources or more before it multiplies (`a + b`, `1 + (a + b) ÷ 100`, read in the
// root's step), else a Multi one. A root no sum and no product gives (a max, a floor or a condition at the top) has no
// pool: its rows stay as they are.
import type { CalcTreeNode } from "../tree-contract.ts";
import { fx3 } from "./curves.ts";
import { exprText, flat, topOp } from "./expr.ts";
import { near, vOf } from "./formulas.ts";
import { formulaOut } from "./math.ts";
import { aboveRenames } from "./above-renames.ts";
import type { Above } from "./above-renames.ts";
import { added, addedRows } from "./percent.ts";
import { finish } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr, Step } from "./steps.ts";

export type Combine = NonNullable<CalcTreeNode["combine"]>;
export type PoolKind = NonNullable<CalcTreeNode["poolKind"]>;
export interface Pool {
  kind: PoolKind;
  name: string;
  value: number;
  rows: Row[];
  /** How the pool's rows give its value: their sum, their product, or 1 + their sum ÷ 100. */
  combine: Combine;
  /** How the pool joins the total of the pools before it in the game's chain: added, or multiplied (when not set). */
  join?: "+" | "*";
}
/** A term of the root's step as a row (tree/terms.ts `term`). */
export type TermRow = (e: Expr, op: "+") => Row | null;
/** A term of step `at` of the root's call as a row (tree/terms.ts `term`, in that step's turn). */
export type TermAt = (e: Expr, op: "*" | "+", at: number) => Row | null;

const strip = (e: Expr): Expr => (e.t === "def" ? strip(e.e) : e);

/**
 * A step's expression under a top its value passes through (T025): a round, a floor or a ceil that changes nothing, or
 * a clamp (a max or a min with a number) that does not bite; else the expression itself.
 */
export function through(e: Expr, v: number): Expr {
  const x = strip(e);
  if (x.t !== "fn" || !x.name) return x;
  const vars = x.args.filter((a) => strip(a).t !== "num");
  const [inner] = vars;
  const round = ["round", "floor", "ceil"].includes(x.name);
  const clamp = ["max", "min"].includes(x.name) && x.args.length === 2;
  if (!inner || vars.length !== 1 || !(round ? x.args.length === 1 : clamp))
    return x;
  return near(Number(inner.v), v) ? through(inner, v) : x;
}
/** The sources an expression reads or calls (a value of an earlier step is one too). */
const sources = (e: Expr): number =>
  e.t === "call" || e.t === "read" || e.t === "val"
    ? 1
    : e.t === "def"
      ? sources(e.e)
      : e.t === "op"
        ? sources(e.l) + sources(e.r)
        : e.t === "fn"
          ? e.args.reduce((a, x) => a + sources(x), 0)
          : e.t === "not"
            ? sources(e.a)
            : 0;

/** A factor that sums the bonuses of two sources or more: its terms and how they give it. */
function additive(e: Expr): { terms: Expr[]; combine: Combine } | null {
  const x = strip(e);
  if (x.t !== "op" || x.o !== "+") return null;
  const l = strip(x.l);
  const r = strip(x.r);
  // 1 + (bonuses) ÷ 100: the bonuses are percents
  if (
    l.t === "num" &&
    Number(l.v) === 1 &&
    r.t === "op" &&
    r.o === "/" &&
    strip(r.r).t === "num" &&
    Number((strip(r.r) as { v: unknown }).v) === 100
  )
    return sources(r.l) >= 2
      ? { terms: flat(strip(r.l), "+"), combine: "onePlusPercent" }
      : null;
  return sources(x) >= 2 ? { terms: flat(x, "+"), combine: "sum" } : null;
}

/** The rows of an additive factor of value `v`, when its terms give it; else null. */
function additiveRows(
  e: Expr,
  v: number,
  term: TermRow,
): { rows: Row[]; combine: Combine } | null {
  const a = additive(e);
  if (!a) return null;
  // the bonuses inside 1 + (…) ÷ 100 are percents already
  const parts = a.terms.map((t) =>
    a.combine === "sum" ? addedRows(t, (x) => term(x, "+")) : term(t, "+"),
  );
  if (parts.some((p) => !p)) return null;
  const rows = parts.flatMap((p) => p ?? []);
  const sum = rows.reduce((s, r) => s + added(r), 0);
  const gives = a.combine === "sum" ? sum : 1 + sum / 100;
  if (!near(gives, v)) return null;
  return { rows: finish(sum, rows, false), combine: a.combine };
}

/** A factor that sums bonuses inside 1 + (…) ÷ 100 multiplies: its own Multi pool; one that sums sources adds them. */
const kindOf = (c: Combine): PoolKind =>
  c === "onePlusPercent" ? "multi" : "additive";
/** A Multi pool of single multipliers, which share one pool when they come in a row (the order changes nothing). */
const isSingles = (p: Omit<Pool, "name">) =>
  p.kind === "multi" && p.combine === "product";
function singlesTogether(pools: Omit<Pool, "name">[]): Omit<Pool, "name">[] {
  const out: Omit<Pool, "name">[] = [];
  for (const p of pools) {
    const last = out.at(-1);
    if (last && isSingles(last) && isSingles(p) && last.join === p.join)
      out[out.length - 1] = {
        ...last,
        value: last.value * p.value,
        rows: [...last.rows, ...p.rows],
      };
    else out.push(p);
  }
  return out;
}

/** Each pool its name: "Additive pool", "Multi pool", numbered in the game's order when there are two or more. */
function named(pools: Omit<Pool, "name">[]): Pool[] {
  const count = (k: PoolKind) => pools.filter((p) => p.kind === k).length;
  const seen = new Map<PoolKind, number>();
  return pools.map((p) => {
    const n = (seen.get(p.kind) ?? 0) + 1;
    seen.set(p.kind, n);
    const base = p.kind === "additive" ? "Additive pool" : "Multi pool";
    return { ...p, name: count(p.kind) > 1 ? `${base} ${String(n)}` : base };
  });
}

/**
 * The pools of the root's `rows`, in the game's order; `root.expr` is the root's step, read for its additive factors
 * with `term`. Null when the rows neither add up nor multiply to the root's value.
 */
export function poolsOf(
  rows: readonly Row[],
  root: { value: CalcTreeNode["value"]; expr?: Expr | null },
  term?: TermRow,
): Pool[] | null {
  const v = typeof root.value === "boolean" ? Number(root.value) : root.value;
  const parts = [...rows];
  const vals = parts.map(vOf);
  if (v === null || !parts.length || !vals.every(Number.isFinite)) return null;
  const isProduct = near(
    vals.reduce((a, x) => a * x, 1),
    v,
  );
  const isSum = near(
    vals.reduce((a, x) => a + x, 0),
    v,
  );
  const expr = root.expr ? strip(root.expr) : null;
  // both close (1 + 2 + 3 = 1 × 2 × 3, or all at 0): the step's top decides, else the level's own rule (rows.ts
  // finish); a lone row is a Multi pool
  const sumFirst =
    parts.length > 1 &&
    (expr ? topOp(expr) === "+" : rows.some((r) => r.node.shareMode === "sum"));
  if (isSum && (!isProduct || sumFirst))
    return named([
      { kind: "additive", value: v, rows: [...rows], combine: "sum" },
    ]);
  if (!isProduct) return null;
  const pools: Omit<Pool, "name">[] = parts.map((r) => ({
    kind: "multi",
    value: vOf(r),
    rows: [r],
    combine: "product",
  }));
  // an additive factor of the step takes the place of the first row of its value
  const used = new Set<number>();
  for (const e of expr && term ? flat(expr, "*") : []) {
    const fv = Number(e.v);
    const i = pools.findIndex(
      (p, j) => !used.has(j) && p.kind === "multi" && near(p.value, fv),
    );
    if (i < 0) continue;
    used.add(i);
    const add = term && additiveRows(e, fv, term);
    if (add) pools[i] = { kind: kindOf(add.combine), value: fv, ...add };
  }
  return named(singlesTogether(pools));
}

/**
 * A root with no pool whose step is a max or a min at the top, which its rows give by that same rule: that rule, which
 * its groups by system take (spec 009, US2 scenario 4); else null.
 */
export function rootExtreme(
  rows: readonly Row[],
  root: { value: CalcTreeNode["value"]; expr?: Expr | null },
): "max" | "min" | null {
  const e = root.expr ? strip(root.expr) : null;
  const rule =
    e?.t === "fn" && (e.name === "max" || e.name === "min") ? e.name : null;
  const vals = rows.map(vOf);
  if (!rule || !vals.length || !vals.every(Number.isFinite)) return null;
  const v = typeof root.value === "boolean" ? Number(root.value) : root.value;
  return v !== null && near(Math[rule](...vals), v) ? rule : null;
}

/**
 * The root's ⓘ as its two lines: how its pools give it, in the game's chain ("(Additive pool 1 × Multi pool 1 +
 * Additive pool 2) × Multi pool 2"); none for a single pool.
 */
export function poolsPair(
  pools: readonly Pool[],
  value: number,
): [names: string, numbers: string] | null {
  if (pools.length < 2) return null;
  const line = (text: (p: Pool) => string) =>
    pools.reduce(
      (acc, p, i) => {
        if (i === 0) return { s: text(p), sum: false };
        if (p.join === "+") return { s: `${acc.s} + ${text(p)}`, sum: true };
        return {
          s: `${acc.sum ? `(${acc.s})` : acc.s} × ${text(p)}`,
          sum: false,
        };
      },
      { s: "", sum: false },
    ).s;
  return [line((p) => p.name), `${line((p) => fx3(p.value))} = ${fx3(value)}`];
}

/** The root's ⓘ as the contract writes it (atoms). */
export function poolsFormula(
  pools: readonly Pool[],
  value: number,
): CalcTreeNode["formula"] {
  const pair = poolsPair(pools, value);
  return (
    pair &&
    formulaOut(
      pair,
      pools.map((p) => p.name),
    )
  );
}

/**
 * A step of the root's chain: its operation, its terms but the running total it takes, and the working values its rows
 * were read back from (the caches above them in the 008).
 */
interface Link {
  at: number;
  op: "*" | "+";
  terms: Expr[];
  up: Above[];
}
/** Whether a read of a step is a working value the root's own call wrote (its cache's writer is the root). */
export type OwnCache = (e: Expr, at: number) => boolean;
/**
 * The root's chain of steps, first to last, from the step that gives `value`: each step takes the total of an earlier
 * one, back to the first, which takes none. The total comes as a value with no source or as a working value the root's
 * own call wrote and reads back: the recording tells the two apart, not the game (tree/steps.ts). Null for a root of one
 * step, unless `single` (T025: its one step's terms are its pools); "open" for a chain a step of which neither adds nor
 * multiplies.
 */
function chainOf(
  steps: readonly Step[],
  value: number,
  ownCache: OwnCache,
  single = false,
): Link[] | "open" | null {
  const out: Link[] = [];
  let up: Above[] = [];
  for (let k = steps.findLastIndex((s) => near(s.v, value)); k >= 0;) {
    const step = steps[k];
    const e = step && through(step.e, step.v);
    // the earlier step a term takes the value of: a value with no source, or a working value of the root's own call
    const prevOf = (x: Expr): number => {
      const i = steps.findLastIndex(
        (p, j) =>
          j < k &&
          near(p.v, Number(x.v)) &&
          (x.t !== "def" || exprText(p.e) === exprText(x.e)),
      );
      return i >= 0 && (x.t !== "read" || ownCache(x, k)) ? i : -1;
    };
    // a step that only clamps or rounds an earlier one, which it leaves as it is: that step (T025)
    if (step && e !== strip(step.e) && (e?.t === "val" || e?.t === "read")) {
      const i = prevOf(e);
      if (i >= 0) {
        k = i;
        continue;
      }
    }
    const op = topOp(e);
    if (!e || !op) return out.length ? "open" : null;
    const ts = flat(e, op);
    const first = (fits: (x: Expr) => boolean) =>
      ts.findIndex((x) => fits(x) && prevOf(x) >= 0);
    let run = first(
      (x) => x.t === "val" || (x.t === "read" && x.p.startsWith("DNSM.")),
    );
    // only when no running total links it: a multiplier the block keeps in a variable set by an earlier step (`def`,
    // tree/steps.ts) is that step's value too, when the step is its expression, the golden food's shared multiplier
    // (spec 009, FR-017); a variable that is added stays a term, which the pool takes apart as any unnamed sum
    if (run < 0 && op === "*") run = first((x) => x.t === "def");
    out.unshift({ at: k, op, terms: ts.filter((_, i) => i !== run), up });
    const via = ts[run];
    if (!via) break;
    if (via.t === "read") up = [...up, { code: via.p, name: via.p }];
    k = prevOf(via);
  }
  return out.length > (single ? 0 : 1) ? out : null;
}

/**
 * The pools of a root whose steps are a chain (spec 009, FR-005, rule Y of 17/11): sums in a row are an Additive pool,
 * single multipliers in a row one Multi pool, a factor that sums bonuses inside its own pool (`additive`); each change
 * of + to × opens a pool. Null for a root of one step (`poolsOf` reads it); "open" for a chain the pools cannot read or
 * that does not give the root, which the caller logs (NFR-005).
 */
export function chainPools(
  steps: readonly Step[],
  root: { value: CalcTreeNode["value"] },
  termAt: TermAt,
  ownCache: OwnCache = () => false,
  single = false,
): Pool[] | "open" | null {
  const v = typeof root.value === "boolean" ? Number(root.value) : root.value;
  const chain = v === null ? null : chainOf(steps, v, ownCache, single);
  if (v === null || chain === null) return null;
  if (chain === "open") return "open";
  const pools: Omit<Pool, "name">[] = [];
  for (const { at, op, terms, up } of chain) {
    // rows read back from a working value are renamed under it, as in the 008, and open under it
    const under = (rows: Row[]) =>
      up.length ? aboveRenames(rows, up).map((r) => ({ ...r, up })) : rows;
    // the added terms or the single multipliers of a step are one level, finished together as in the 008
    let batch: Row[] = [];
    const flush = () => {
      if (!batch.length) return;
      const value = batch.reduce(
        (a, r) => (op === "*" ? a * vOf(r) : a + added(r)),
        op === "*" ? 1 : 0,
      );
      const rows = under(finish(value, batch, op === "*"));
      const last = pools.at(-1);
      batch = [];
      if (op === "+" && last?.combine === "sum" && last.join === "+")
        pools[pools.length - 1] = {
          ...last,
          value: last.value + value,
          rows: [...last.rows, ...rows],
        };
      else
        pools.push({
          kind: op === "+" ? "additive" : "multi",
          combine: op === "+" ? "sum" : "product",
          join: op,
          value,
          rows,
        });
    };
    for (const e of terms) {
      const factor =
        op === "*"
          ? additiveRows(e, Number(e.v), (t) => termAt(t, "+", at))
          : null;
      if (factor) {
        flush();
        pools.push({
          kind: kindOf(factor.combine),
          value: Number(e.v),
          join: "*",
          combine: factor.combine,
          rows: under(factor.rows),
        });
        continue;
      }
      const rs = (op === "+"
        ? addedRows(e, (t) => termAt(t, "+", at))
        : [termAt(e, op, at)]) ?? [null];
      if (rs.some((r) => r === null)) return "open";
      batch.push(...rs.filter((r): r is Row => r !== null));
    }
    flush();
  }
  const out = singlesTogether(pools);
  const total = out.reduce(
    (acc, p, i) =>
      i === 0 ? p.value : p.join === "+" ? acc + p.value : acc * p.value,
    0,
  );
  return near(total, v) ? named(out) : "open";
}
