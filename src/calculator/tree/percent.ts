// The bonuses in % the game sums and divides by 100 before the sum enters a pool (spec 009, FR-017): such a term of a
// sum gives its bonuses, each marked `percent` (tree/rows.ts), which add a hundredth of their value to the pool and go
// into their system's group of `combine: "percent"` (tree/mould.ts).
import { flat } from "./expr.ts";
import { near, vOf } from "./formulas.ts";
import type { Row } from "./rows.ts";
import type { Expr } from "../recorded/steps.ts";

const strip = (e: Expr): Expr => (e.t === "def" ? strip(e.e) : e);

/** What a row adds to its pool: its value, or a hundredth of it for a bonus in % (rows.ts `percent`). */
export const added = (r: Row): number => (r.percent ? vOf(r) / 100 : vOf(r));

/** A sum of bonuses in % the game divides by 100 ((a + b) ÷ 100): its terms; else null. */
function percentTerms(e: Expr): Expr[] | null {
  const x = strip(e);
  if (x.t !== "op" || x.o !== "/") return null;
  const d = strip(x.r);
  const s = strip(x.l);
  return d.t === "num" && Number(d.v) === 100 && s.t === "op" && s.o === "+"
    ? flat(s, "+")
    : null;
}

/**
 * The rows of a term of a sum: a sum of bonuses in % the game divides by 100 gives its bonuses, each in %, when they
 * give it; any other term its own row. Null when a row cannot be read.
 */
export function addedRows(
  e: Expr,
  term: (t: Expr) => Row | null,
): Row[] | null {
  const terms = percentTerms(e);
  const rows = terms?.map(term) ?? [];
  const bonuses = rows.flatMap((r) =>
    r ? [{ ...r, percent: true as const }] : [],
  );
  if (
    bonuses.length === terms?.length &&
    near(
      bonuses.reduce((a, r) => a + added(r), 0),
      Number(e.v),
    )
  )
    return bonuses;
  const own = term(e);
  return own ? [own] : null;
}
