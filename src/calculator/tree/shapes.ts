// The name of a branch of an expression's parts (spec 008, T023): the rename of formulas.cjs `formulaOf` (A) and then
// `fallback`, from the bench at BASELINE-4. The bench names such a branch by its own sum with numbers ("1 + (3 ÷ 100)");
// when each number is one of its parts and the sum with the parts' values gives the branch's value, the sum's shape
// names it ("Multiplier"); else, while its name is still that sum, its source's name does. The app's branch has no such
// name: it keeps the generic one when neither applies.
import { exprText, isFormulaName } from "./expr.ts";
import { fx3 } from "./curves.ts";
import { isCond, isAtOne, near, vOf } from "./formulas.ts";
import { evaluate } from "./math.ts";
import { withName } from "./row-checks.ts";
import type { Row } from "./rows.ts";
import type { Expr } from "./steps.ts";

/** formulas.cjs SHAPES: the sum with each distinct number written as a letter, in order of first place. */
export const BRANCH_SHAPES: readonly {
  test: RegExp;
  proof: string;
  name: string;
}[] = [
  {
    test: /^a ÷ \((b \+ a|a \+ b)\)$/,
    proof: "bench formulas.cjs formulaOf SHAPES",
    name: "Level factor",
  },
  {
    test: /^(1 \+ \(?a ÷ b\)?|a \+ \(b ÷ c\))$/,
    proof: "bench formulas.cjs formulaOf SHAPES",
    name: "Multiplier",
  },
  {
    test: /^\(\(a − b\) × c\) \+ d$/,
    proof: "bench formulas.cjs formulaOf SHAPES",
    name: "Bonus from level",
  },
  {
    test: /^pow\(floor\(/,
    proof: "bench formulas.cjs formulaOf SHAPES",
    name: "Points curve",
  },
];

const NUMBER = /\d+(?:\.\d+)?/g;

/**
 * formulas.cjs `formulaOf` (A), its rename: the shape's name of branch `r` of expression `e`, when its parts (the ×1
 * group aside, the parts at 0 among them) have no Condition, each number of the sum is one part's value, and the sum
 * with the parts' exact values is the branch's; else null.
 */
export function shapeName(e: Expr, r: Row): string | null {
  const text = exprText(e);
  const kids = (r.group ?? []).flatMap((k) =>
    k.node.role === "atZero" ? (k.group ?? []) : isAtOne(k) ? [] : [k],
  );
  if (kids.some(isCond) || !isFormulaName(text)) return null;
  const parts = new Map<string, Row>();
  for (const x of new Set(text.match(NUMBER))) {
    const c = kids.filter((k) => near(vOf(k), Number(x)) || fx3(vOf(k)) === x);
    if (c.length !== 1 || !c[0]) return null;
    parts.set(x, c[0]);
  }
  const at = (m: string) => {
    const k = parts.get(m);
    return k ? `(${String(vOf(k))})` : m;
  };
  if (!near(evaluate(text.replace(NUMBER, at)), vOf(r))) return null;
  const ids = new Map<string, string>();
  const shape = text.replace(NUMBER, (m) => {
    if (!ids.has(m)) ids.set(m, String.fromCharCode(97 + ids.size));
    return ids.get(m) ?? m;
  });
  return BRANCH_SHAPES.find((s) => s.test.test(shape))?.name ?? null;
}

/**
 * The branch `r` of expression `e` with its name: its shape's (shapeName), else, when its name would be its own sum with
 * numbers, `fallback` (formulas.cjs `fallback`, the source's name); null leaves it as it is.
 */
export const branchName = (r: Row, e: Expr, fallback: string | null): Row =>
  withName(
    r,
    shapeName(e, r) ?? (isFormulaName(exprText(e)) ? fallback : null),
  );
