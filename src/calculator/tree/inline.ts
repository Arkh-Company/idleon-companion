// No unnamed step inside a source, whatever its math (spec 009, FR-007, FR-018; audit families 7, 11, 14 and 24):
// tree/flatten.ts moves up a step that only adds (or only multiplies) as its level does; a step of any other math
// (1 + x ÷ 100 inside a product, a floor, a power) moves up too, its ⓘ written inside the ⓘ of the row above, in
// brackets, so that ⓘ still closes with the numbers of the rows on screen. A step moves up only when both ⓘ are atoms
// (math.ts `formulaOut`) and the joined one recomputes the row's value; else it stays as it is. The 1 and the ÷ 100
// that turn a bonus in % into a multiplier are numbers of the ⓘ, never rows of their own, as in the sigils' build-up.
import type { CalcTreeNode } from "../tree-contract.ts";
import { byShapeOnly, movedUp } from "./flatten.ts";
import { isCond, near, withFormula } from "./formulas.ts";
import type { FormulaRow } from "./formulas.ts";
import { evaluate, isOperator } from "./math.ts";
import { withShares } from "./rows.ts";
import type { Row } from "./rows.ts";

type Atoms = [string[], number[]];
interface Built {
  formula: CalcTreeNode["formula"];
  rows: Row[];
}

/** A step's private name while the ⓘ of its row is written: two marks no name has. */
const mark = (i: number) => `\u0004${String(i)}\u0004`;

/** A step with no code and no proven name (a name after its first source is the parent's, family 7: it stays). */
function isStep(r: Row): boolean {
  const n = r.node;
  return (
    n.code === null &&
    r.open === null &&
    n.role === "piece" &&
    !isCond(r) &&
    !n.flags.truncated &&
    !r.bySource &&
    !r.ceiling &&
    (!!n.flags.unnamed || byShapeOnly(n.name)) &&
    (r.group?.length ?? 0) > 0
  );
}

/** The constants that turn a bonus in % into a multiplier: numbers of the ⓘ only. */
export const isPercentForm = (r: Row): boolean =>
  r.node.leaf === "fixedValue" &&
  r.node.code === null &&
  !r.group?.length &&
  ((r.node.name === "Base 1" && r.node.value === 1) ||
    (r.node.name === "Percent to number (÷ 100)" && r.node.value === 100));

/** Whether the atoms recompute their result, as math.ts `formulaOut` checks. */
function closes([terms, numbers]: Atoms): boolean {
  let i = 0;
  const filled = terms
    .map((t) => (isOperator(t) ? t : String(numbers[i++])))
    .join(" ");
  const result = numbers.at(-1) ?? NaN;
  return (
    i + 1 === numbers.length &&
    Math.abs(evaluate(filled) - result) <= 1e-3 * Math.max(1, Math.abs(result))
  );
}

/** The two lines of the atoms, as tree/share.ts reads a formula. */
function pairOf([terms, numbers]: Atoms): [string, string] {
  let i = 0;
  const filled = terms.map((t) => (isOperator(t) ? t : String(numbers[i++])));
  return [terms.join(" "), `${filled.join(" ")} = ${String(numbers.at(-1))}`];
}

/** Atoms `outer` with the term `term` (one, never an operator) replaced by `inner` in brackets; null when not once. */
function splice(outer: Atoms, term: string, inner: Atoms): Atoms | null {
  const [terms, numbers] = outer;
  const at = terms.flatMap((t, i) => (t === term ? [i] : []));
  if (at.length !== 1 || at[0] === undefined) return null;
  const j = at[0];
  const k = terms.slice(0, j).filter((t) => !isOperator(t)).length;
  return [
    [...terms.slice(0, j), "(", ...inner[0], ")", ...terms.slice(j + 1)],
    [...numbers.slice(0, k), ...inner[1].slice(0, -1), ...numbers.slice(k + 1)],
  ];
}

/**
 * The ⓘ and rows of `row`'s level `rows`, each unnamed step in it replaced by its parts and its ⓘ in brackets, all the
 * way down, when the ⓘ still closes; else the level's own (tree/formulas.ts `withFormula`).
 */
export function inlined(row: FormulaRow, rows: Row[]): Built {
  const plain = (): Built => withFormula(row, rows);
  if (!rows.some(isStep) || row.node.formula) return plain();
  const marked = rows.map((r, i) =>
    isStep(r) ? { ...r, node: { ...r.node, name: mark(i) } } : r,
  );
  const top = withFormula(row, marked).formula;
  if (!Array.isArray(top)) return plain();
  let atoms: Atoms = top;
  let moved = 0;
  const out: Row[] = [];
  for (const [i, r] of rows.entries()) {
    const inner = isStep(r) ? inlined(r, r.group ?? []) : null;
    const joined =
      inner && Array.isArray(inner.formula)
        ? splice(atoms, mark(i), inner.formula)
        : null;
    if (!inner || !joined) {
      atoms = [
        atoms[0].map((t) => (t === mark(i) ? r.node.name : t)),
        atoms[1],
      ];
      out.push(r);
      continue;
    }
    atoms = joined;
    moved++;
    out.push(
      ...movedUp(
        r,
        inner.rows.filter((k) => !isPercentForm(k)),
      ),
    );
  }
  const result = atoms[1].at(-1);
  if (
    moved === 0 ||
    !closes(atoms) ||
    result === undefined ||
    !near(result, Number(row.node.value))
  )
    return plain();
  return {
    formula: atoms,
    rows: withShares(row.node, pairOf(atoms), out).rows,
  };
}
