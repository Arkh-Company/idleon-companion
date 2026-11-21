// The ⓘ of a cache read (spec 008, T022): the port of the writer's formula that pieces.cjs `cacheRows` and `entryRows`
// leave for the cache's row (LAST_WRITER_FORMULA) and of each loop turn's (`turnF`), from the bench at BASELINE-4. The
// bench keeps it in a variable of the module that a cache opened inside another can overwrite; here each opening
// returns its own, so a cache's row never takes the ⓘ of a cache opened under it.
import type { RecNode } from "../recording.ts";
import { turnReads } from "./cache-picks.ts";
import { isZero } from "./code-formulas.ts";
import type { CodeFormulas } from "./code-formulas.ts";
import type { Entry } from "./entries.ts";
import { fx3 } from "./curves.ts";
import type { FormulaRow, Pair } from "./formulas.ts";
import type { Part } from "./loop-parts.ts";
import { near } from "../recorded/math.ts";
import type { Row } from "./rows.ts";

/** A cache's rows and the ⓘ its writer gives it (null: none). */
export interface Opened {
  rows: Row[];
  f: Pair | null;
}

/**
 * (11/11) the ⓘ of a cache one turn `q` made: the turn's step with the value; a turn that only adds 0 to one call, that
 * call's ⓘ.
 */
export function oneTurnFormula(
  w: RecNode,
  q: Entry,
  value: number,
  formulas: CodeFormulas,
  nodes: readonly RecNode[],
): Pair | null {
  const e = q.s.find((x) => near(x.v, value))?.e;
  if (e?.t === "op" && e.o === "+") {
    const other = isZero(e.r) ? e.l : isZero(e.l) ? e.r : null;
    const k = other?.t === "call" ? nodes[other.id] : undefined;
    if (k) return formulas.call(k);
  }
  return formulas.expr(e, turnReads(w, q.r), value, 1);
}

/**
 * (11/11) the ⓘ of a turn's part `d` of the total the turn wrote: the side its step adds to the running total, else the
 * whole step (the step with the new total, else the turn's last one). (The bench's test that the whole step has the
 * part's value is left out: the formula is only kept when it gives that value.)
 */
export function turnFormula(
  w: RecNode,
  pt: Pick<Part, "d" | "q">,
  formulas: CodeFormulas,
): Pair | null {
  const { q, d } = pt;
  const e0 = (q.s.find((x) => near(x.v, q.v)) ?? q.s.at(-1))?.e;
  const prev = Number(q.v) - d;
  const side =
    e0?.t === "op" && e0.o === "+"
      ? near(e0.l.v, prev)
        ? e0.r
        : near(e0.r.v, prev)
          ? e0.l
          : null
      : null;
  const reads = turnReads(w, q.r);
  return (
    (side && formulas.expr(side, reads, d, 1)) ?? formulas.expr(e0, reads, d, 1)
  );
}

/**
 * The cache row `r` with its writer's ⓘ `f`: never on a bubble's value (pieces.cjs rowOfTerm OPUS4-6), and on a read
 * with an expression's value only when `f` gives that value (the bench's `writerF0`).
 */
export function withWriterFormula(r: Row, f: Pair | null): FormulaRow {
  if (
    !f ||
    r.writerF === "never" ||
    (r.writerF === "sameValue" &&
      !f[1].endsWith(`= ${fx3(Number(r.node.value))}`))
  )
    return r;
  return { ...r, xf: f };
}
