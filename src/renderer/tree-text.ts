// How a tree row writes its numbers (design.md §3.6, C6, C15) and reads them aloud (§3.8). The root is never written
// here: it is the Stats text the main sends (rootText, FR-019).
import { MINUS, plain, valueText } from "../shared/index.ts";
import type { TreeNode } from "../shared/index.ts";

/** The same value read aloud: no symbol alone (design.md §3.8, S1). */
export function spokenValue(n: Pick<TreeNode, "value" | "fmt">): string {
  if (n.value === null) return "unavailable";
  return valueText(n)
    .replace(/^×/, "times ")
    .replace(/^\+/, "plus ")
    .replace(MINUS, "minus ")
    .replace(/^—$/, "unavailable");
}

/** The row's weight in its parent (C15): only in a sum or a product, "≈" in a mixed one. */
export function shareText(
  n: Pick<TreeNode, "share" | "shareMode" | "value">,
): string | null {
  const { share, shareMode: mode } = n;
  if (mode === "productZero" && n.value === 0) return "zeroes the total";
  if (
    share === null ||
    !mode ||
    !["sum", "product", "productZero", "mixed"].includes(mode)
  )
    return null;
  const pct =
    share > 0 && share < 0.01 ? "<1" : String(Math.round(share * 100));
  return mode === "mixed" ? `≈ ${pct}%` : `${pct}% of this list`;
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
} {
  if (!Array.isArray(formula)) {
    const [names, numbers] = formula.rule;
    const last = numbers.match(/-?\d[\d,]*(?:\.\d+)?(?:e[+-]?\d+)?/gi)?.at(-1);
    return {
      names,
      numbers,
      result: last === undefined ? "" : plain(Number(last.replace(/,/g, ""))),
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

/** How much a number moved since `was` (design.md C11): "up 0.27%" or "down 1.2%"; null when it did not or from 0. */
export function changeText(was: number, now: number): string | null {
  if (was === 0 || was === now) return null;
  const pct = ((now - was) / Math.abs(was)) * 100;
  return `${pct > 0 ? "up" : "down"} ${plain(Math.abs(pct))}%`;
}

/** A row's change since the tree before or the mark (C11): `was …` written and read aloud, or `changed inside` on a
 * closed branch with a change below it; never by color alone. */
export function rowChange(
  was: TreeNode["was"],
  fmt: TreeNode["fmt"],
  changedInside: boolean,
): { text: string; spoken: string; was: boolean } | null {
  if (was !== undefined) {
    const v = { value: was, fmt };
    return {
      text: `was ${valueText(v)}`,
      spoken: `was ${spokenValue(v)}`,
      was: true,
    };
  }
  return changedInside
    ? { text: "changed inside", spoken: "changed inside", was: false }
    : null;
}
