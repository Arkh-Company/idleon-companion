// The factors of a pool that sum bonuses (spec 009, FR-005, research R1): a factor that sums two sources or more is an
// Additive pool, one that sums bonuses inside 1 + (…) ÷ 100 its own Multi pool. And a part of a sum that is the running
// total times such a factor (answer A of 19/11, audit families 11, 14 and 24: the game adds the bases into one total,
// multiplies it by 1 + the sum of its % ÷ 100, then adds the other parts) is that chain of pools: the bases are the
// Additive pool before it, the % its own Multi pool, the other parts the Additive pool after it, each closing (FR-008).
import { flat } from "./expr.ts";
import { near } from "./formulas.ts";
import { added, addedRows } from "./percent.ts";
import { finish } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Combine, Pool, PoolKind, TermRow } from "./pools.ts";
import type { Expr } from "./steps.ts";

export const strip = (e: Expr): Expr => (e.t === "def" ? strip(e.e) : e);

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

/** Whether a factor sums the bonuses of two sources or more: an Additive pool, or the Multi pool of 1 + (…) ÷ 100. */
export const addsSources = (e: Expr): boolean => additive(e) !== null;

/** The rows of an additive factor of value `v`, when its terms give it; else null. */
export function additiveRows(
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
export const kindOf = (c: Combine): PoolKind =>
  c === "onePlusPercent" ? "multi" : "additive";

type Part = Omit<Pool, "name">;

/** A running total: a sum, a value of an earlier step, or a working value of the game (a DNSM read). */
const isTotal = (e: Expr): boolean => {
  const x = strip(e);
  return (
    (x.t === "op" && x.o === "+") ||
    x.t === "val" ||
    (x.t === "read" && x.p.startsWith("DNSM."))
  );
};

/** A part that is a running total times 1 + the sum of its bonuses ÷ 100: the total and the factor; else null. */
function scaledPart(e: Expr): { total: Expr; pct: Expr } | null {
  const x = strip(e);
  if (x.t !== "op" || x.o !== "*") return null;
  const pct = (f: Expr) => additive(f)?.combine === "onePlusPercent";
  if (pct(x.r) && isTotal(x.l)) return { total: x.l, pct: x.r };
  if (pct(x.l) && isTotal(x.r)) return { total: x.r, pct: x.l };
  return null;
}

/**
 * The pools of a sum (`terms`, value `v`) one part of which is a running total times 1 + its % ÷ 100: the total's
 * parts, the % pool, and the other parts as `rest` gives them (their finished rows, or null); null when no part, or two, are
 * such, or when a pool does not close.
 */
export function scaledPools(
  terms: readonly Expr[],
  v: number,
  term: TermRow,
  rest: (others: Expr[], part: Expr) => Row[] | null,
): Part[] | null {
  const found = terms.flatMap((e) => {
    const s = scaledPart(e);
    return s ? [{ e, ...s }] : [];
  });
  const [one] = found;
  if (!one || found.length !== 1) return null;
  const tv = Number(one.total.v);
  const pv = Number(one.pct.v);
  const t = strip(one.total);
  const bases = (t.t === "op" ? flat(t, "+") : [t]).map((x) =>
    addedRows(x, (y) => term(y, "+")),
  );
  const pct = additiveRows(one.pct, pv, term);
  const others = rest(
    terms.filter((x) => x !== one.e),
    one.e,
  );
  if (bases.some((b) => !b) || !pct || !others) return null;
  const base = bases.flatMap((b) => b ?? []);
  const bv = base.reduce((a, r) => a + added(r), 0);
  const ov = others.reduce((a, r) => a + added(r), 0);
  if (!near(bv, tv) || !near(tv * pv + ov, v)) return null;
  const out: Part[] = [
    {
      kind: "additive",
      combine: "sum",
      value: tv,
      rows: finish(tv, base, false),
    },
    { kind: "multi", join: "*", value: pv, ...pct },
  ];
  if (others.length)
    out.push({
      kind: "additive",
      combine: "sum",
      join: "+",
      value: ov,
      rows: others,
    });
  return out;
}
