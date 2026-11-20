// No unnamed step inside a source, whatever its math (spec 009, FR-007, FR-018; audit families 7, 11, 14 and 24):
// tree/flatten.ts moves up a step that only adds (or only multiplies) as its level does; a step of any other math
// (1 + x ÷ 100 inside a product, a floor, a power) moves up too, its ⓘ written inside the ⓘ of the row above, in
// brackets, so that ⓘ still closes with the numbers of the rows on screen. A step moves up only when both ⓘ are atoms
// (math.ts `formulaOut`) and the joined one recomputes the row's value; else it stays as it is. The code's constants
// among its parts ("Base 1", "÷ 100") stay rows (spec 009 Open Questions, Vinicius 18/11).
import type { CalcTreeNode } from "../tree-contract.ts";
import { byShapeOnly, movedUp } from "./flatten.ts";
import { isCond, withFormula } from "./formulas.ts";
import type { FormulaRow } from "./formulas.ts";
import { evaluate, formulaOut, isOperator } from "./math.ts";
import { withName } from "./row-checks.ts";
import { withShares } from "./rows.ts";
import type { Row } from "./rows.ts";
import { termOf } from "./share.ts";

type Atoms = [string[], number[]];
interface Built {
  formula: CalcTreeNode["formula"];
  rows: Row[];
}

/** A step's private name while the ⓘ of its row is written: two marks no name has. */
const mark = (i: number) => `\u0004${String(i)}\u0004`;

/**
 * A curve's row (tree/rows.ts `curveRow`, FR-018, decision of 19/11): no row, its curve in the ⓘ above, its constants
 * and its level rows of the row above.
 */
const isCurve = (r: Row): boolean =>
  r.node.name.startsWith("Curve: ") &&
  r.open === null &&
  !!r.f &&
  (r.group?.length ?? 0) > 0;

/**
 * A step with no code and no proven name (a name after its first source is the parent's, family 7: it stays), or a
 * curve's row.
 */
export function isStep(r: Row): boolean {
  const n = r.node;
  if (isCurve(r)) return true;
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

/** A step's own ⓘ and rows; a curve's names its constants by their role (FR-018), its rows' names. */
function innerOf(r: Row): Built {
  const own = inlined(r, r.group ?? []);
  const roles =
    isCurve(r) && r.roles
      ? formulaOut(
          r.roles,
          (r.group ?? []).map((k) => termOf(k.node)),
        )
      : null;
  return Array.isArray(roles) ? { ...own, formula: roles } : own;
}

/**
 * The ⓘ and rows of `row`'s level `rows`, each unnamed step in it replaced by its parts and its ⓘ in brackets, all the
 * way down, when the ⓘ still closes; else the level's own (tree/formulas.ts `withFormula`).
 */
export function inlined(row: FormulaRow, rows: Row[]): Built {
  const plain = (): Built => withFormula(row, rows);
  if (!rows.some(isStep) || row.node.formula) return plain();
  const top = withFormula(row, marked(rows)).formula;
  return spliced(row.node, top, rows) ?? plain();
}

/** The rows with each step's private name, for the ⓘ that holds them. */
const marked = (rows: readonly Row[], moves = isStep): Row[] =>
  rows.map((r, i) =>
    moves(r) ? { ...r, node: { ...r.node, name: mark(i) } } : r,
  );

/**
 * The ⓘ and rows of a pool or a group (spec 009, FR-017) whose rows hold an unnamed step: each step replaced by its
 * parts and its ⓘ in brackets, as `inlined` does, the ⓘ around them `pairOf` the rows; null when none moves. Only
 * the steps `moves` says move, and of their parts only those `shows` says are rows (a pool's take no constant of the
 * code, which its ⓘ says: fix tree-shape-091).
 */
export function inPool(
  node: Pick<Row["node"], "name" | "value">,
  rows: Row[],
  pairOf: (rows: readonly Row[]) => [string, string] | null,
  moves: (r: Row) => boolean = isStep,
  shows: (part: Row) => boolean = () => true,
): Built | null {
  if (!rows.some(moves)) return null;
  const m = marked(rows, moves);
  const pair = pairOf(m);
  const top =
    pair &&
    formulaOut(
      pair,
      m.map((r) => termOf(r.node)),
    );
  return spliced(node, top, rows, moves, shows);
}

/**
 * The ⓘ `top` (of the rows with each step's private name) with each step's ⓘ in brackets, and the rows with each step
 * replaced by its parts; null when none moves or the joined ⓘ does not give the value of `node`.
 */
function spliced(
  node: Pick<Row["node"], "name" | "value">,
  top: CalcTreeNode["formula"],
  rows: readonly Row[],
  moves = isStep,
  shows: (part: Row) => boolean = () => true,
): Built | null {
  if (!Array.isArray(top)) return null;
  // the names and the numbers; the game's text of the bonus, when the ⓘ has one, stays its first line
  const [names0, numbers0, text] = top;
  let atoms: Atoms = [names0, numbers0];
  let moved = 0;
  const out: Row[] = [];
  for (const [i, r] of rows.entries()) {
    const inner = moves(r) ? innerOf(r) : null;
    const joined =
      inner && Array.isArray(inner.formula)
        ? splice(atoms, mark(i), [inner.formula[0], inner.formula[1]])
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
    out.push(...movedUp(r, inner.rows.filter(shows)));
  }
  const result = atoms[1].at(-1);
  const v = Number(node.value);
  // the ⓘ's result is the value rounded to 3 (curves.ts fx3), as `closes` reads it
  if (
    moved === 0 ||
    !closes(atoms) ||
    result === undefined ||
    Math.abs(result - v) > 1e-3 * Math.max(1, Math.abs(v))
  )
    return null;
  return {
    formula: text === undefined ? atoms : [...atoms, text],
    rows: withShares(node, pairOf(atoms), out).rows,
  };
}

/** The role of a source's own part in its math (decision of 19/11, as in cards and talents). */
const roleOf = (r: Row) => (r.node.leaf === "level" ? "Level" : "Bonus");

/**
 * The ⓘ and rows of the source `name` (audit family 7, decision of 19/11): a part that says the source's name again
 * takes its role, in the rows and in an ⓘ of atoms.
 */
export function byRole(name: string, w: Built): Built {
  if (!Array.isArray(w.formula)) return w;
  const [terms, numbers] = w.formula;
  const same = (r: Row) => !r.node.flags.unnamed && r.node.name === name;
  const roles = new Set(w.rows.filter(same).map(roleOf));
  const rows = w.rows.map((r) => (same(r) ? withName(r, roleOf(r)) : r));
  // one role names the source's term in the ⓘ; two would say nothing of which is which
  const [role] = roles.size === 1 ? [...roles] : [];
  return {
    formula: role
      ? [terms.map((t) => (t === name ? role : t)), numbers]
      : w.formula,
    rows,
  };
}
