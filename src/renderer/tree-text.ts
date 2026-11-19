// How a tree row writes its numbers (design.md §3.6, C6, C15) and reads them aloud (§3.8). The root is never written
// here: it is the Stats text the main sends (rootText, FR-019).
import { MINUS, plain, valueText } from "../shared/index.ts";
import type { TreeNode } from "../shared/index.ts";

/** The same value read aloud: no symbol alone (design.md §3.8, S1). */
export function spokenValue(
  n: Pick<TreeNode, "value" | "fmt"> & Partial<Pick<TreeNode, "combine">>,
): string {
  if (n.value === null) return "unavailable";
  return valueText(n)
    .replace(/^×/, "times ")
    .replace(/^\+/, "plus ")
    .replace(MINUS, "minus ")
    .replace(/^—$/, "unavailable");
}

/** "zeroes the total": a 0 in a product, shown with the share hidden too (spec 009 FR-016). */
export const ZEROES = "zeroes the total";

/** The row's weight in its parent (C15), only its number ("26%", spec 009 FR-014): in a sum, a product or a mixed one. */
export function shareText(
  n: Pick<TreeNode, "share" | "shareMode" | "value">,
): string | null {
  const { share, shareMode: mode } = n;
  if (mode === "productZero" && n.value === 0) return ZEROES;
  if (
    share === null ||
    !mode ||
    !["sum", "product", "productZero", "mixed"].includes(mode)
  )
    return null;
  const pct =
    share > 0 && share < 0.01 ? "<1" : String(Math.round(share * 100));
  return `${pct}%`;
}

/** FR-015a: "62% reached · max +40%", with the maximum written like the row's value. */
export function reachedText(
  n: Pick<TreeNode, "maxReached" | "fmt">,
): string | null {
  const r = n.maxReached;
  if (!r) return null;
  return `${String(Math.round(r.share * 100))}% reached · max ${valueText({ value: r.max, fmt: n.fmt ?? "+" })}`;
}

const OPERATOR =
  /^([×÷+−\-*/^:(),]|min|max|pow|floor|ceil|round|abs|sqrt|log|log10|log₁₀)$/;

/** Spaces between terms, none inside parentheses, before a comma or after a function's name. */
function joined(terms: string[]): string {
  return terms
    .join(" ")
    .replace(/\( /g, "(")
    .replace(/ \)/g, ")")
    .replace(/ ,/g, ",")
    .replace(
      /\b(min|max|pow|floor|ceil|round|abs|sqrt|log|log10|log₁₀) \(/g,
      "$1(",
    );
}

/**
 * "How it adds up" in two lines (contracts/tree-worker.md): the names, then each name's number with the result; a rule's
 * two lines as they come, its result the last number of its line of numbers.
 */
export function formulaLines(formula: NonNullable<TreeNode["formula"]>): {
  names: string;
  numbers: string;
  result: string;
  /** The game's text of the row's bonus, a line before its math; null with none. */
  text: string | null;
} {
  if (!Array.isArray(formula)) {
    const [names, numbers] = formula.rule;
    const last = numbers.match(/-?\d[\d,]*(?:\.\d+)?(?:e[+-]?\d+)?/gi)?.at(-1);
    return {
      names,
      numbers,
      result: last === undefined ? "" : plain(Number(last.replace(/,/g, ""))),
      text: formula.text ?? null,
    };
  }
  const [terms, numbers] = formula;
  let i = 0;
  const filled = terms.map((t) =>
    OPERATOR.test(t) ? t : plain(numbers[i++] ?? NaN),
  );
  const last = numbers.at(-1);
  const result = last === undefined ? "" : plain(last);
  return {
    names: joined(terms),
    numbers: `${joined(filled)} = ${result}`,
    result,
    text: formula[2] ?? null,
  };
}

/** The value's color by its role: adds, multiplies, or 0 and ×1 (design.md §3.2). */
export function valueClass(n: Pick<TreeNode, "value" | "fmt">): string {
  const v = n.value;
  if (typeof v === "number" && (v === 0 || (n.fmt === "x" && v === 1)))
    return "num num--zero";
  if (n.fmt === "x") return "num num--mult";
  return n.fmt === "%" || n.fmt === "+" ? "num num--add" : "num";
}
