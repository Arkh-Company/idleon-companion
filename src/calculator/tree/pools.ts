// The game's pools of a tree's first level (spec 009, FR-005, research R1): how the root's rows give its value. A root
// whose rows add up to it is one Additive pool; one whose rows multiply to it has a pool per factor, an Additive one when
// the factor sums the bonuses of two sources or more before it multiplies (`a + b`, `1 + (a + b) ÷ 100`, read in the
// root's step), else a Multi one. The parts at ×1 and at 0 (rows.ts) are factors and terms like the others. A root no
// sum and no product gives (a max, a floor or a condition at the top) has no pool: its rows stay as they are.
import type { CalcTreeNode } from "../tree-contract.ts";
import { fx3 } from "./curves.ts";
import { flat, topOp } from "./expr.ts";
import { near, vOf } from "./formulas.ts";
import { formulaOut } from "./math.ts";
import { finish } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr } from "./steps.ts";

export type Combine = NonNullable<CalcTreeNode["combine"]>;
export type PoolKind = NonNullable<CalcTreeNode["poolKind"]>;
export interface Pool {
  kind: PoolKind;
  name: string;
  value: number;
  rows: Row[];
  /** How the pool's rows give its value: their sum, their product, or 1 + their sum ÷ 100. */
  combine: Combine;
}
/** A term of the root's step as a row (tree/terms.ts `term`). */
export type TermRow = (e: Expr, op: "+") => Row | null;

const GROUPS = new Set(["atZero", "atOne"]);
const strip = (e: Expr): Expr => (e.t === "def" ? strip(e.e) : e);
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
  const rows = a.terms.flatMap((t) => term(t, "+") ?? []);
  const sum = rows.reduce((s, r) => s + vOf(r), 0);
  const gives = a.combine === "sum" ? sum : 1 + sum / 100;
  if (rows.length !== a.terms.length || !near(gives, v)) return null;
  return { rows: finish(sum, rows, false), combine: a.combine };
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
  const parts = rows.flatMap((r) =>
    GROUPS.has(r.node.role) && r.group ? r.group : [r],
  );
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
  if (isSum && (!isProduct || topOp(expr ?? undefined) === "+"))
    return named([{ kind: "additive", value: v, rows: parts, combine: "sum" }]);
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
    if (add) pools[i] = { kind: "additive", value: fv, ...add };
  }
  return named(pools);
}

/** The root's ⓘ: how its pools give it ("Additive pool × Multi pool"); none for a single pool. */
export function poolsFormula(
  pools: readonly Pool[],
  value: number,
): CalcTreeNode["formula"] {
  if (pools.length < 2) return null;
  const names = pools.map((p) => p.name);
  return formulaOut(
    [
      names.join(" × "),
      `${pools.map((p) => fx3(p.value)).join(" × ")} = ${fx3(value)}`,
    ],
    names,
  );
}
