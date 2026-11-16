// How a tree row writes its value (design.md §3.6, C6, C15): shared, so that the main compares the text of an open
// node's part as the window writes it ("Game changed", FR-024). The root is never written here: it is the Stats text
// (rootText, FR-019).
import type { TreeNode } from "./formula-tree.ts";

export const MINUS = "−";

/** The game's E notation: the mantissa is cut at 2 places, not rounded (as the Stats). */
function eNotation(n: number): string {
  const [mantissa = "", exponent] = n.toExponential().split("e");
  const [whole, decimals = ""] = mantissa.split(".");
  return `${whole ?? ""}.${decimals.padEnd(2, "0").slice(0, 2)}E${String(Number(exponent))}`;
}

/** A number of a row: 3 significant digits under 1,000, rounded with separators above, T and E like the game. */
export function plain(v: number): string {
  const a = Math.abs(v);
  let s: string;
  if (a >= 1e15) s = eNotation(a);
  else if (a >= 1e12) {
    const t = a / 1e12;
    s = `${(t < 100 ? Math.round(t * 10) / 10 : Math.round(t)).toLocaleString("en-US")}T`;
  } else if (a >= 1000) s = Math.round(a).toLocaleString("en-US");
  else s = String(Number(a.toPrecision(3)));
  return v < 0 && s !== "0" ? `${MINUS}${s}` : s;
}

/** The row's value as written: + for a part that adds, × for one that multiplies, yes/no, — when unavailable. */
export function valueText(n: Pick<TreeNode, "value" | "fmt">): string {
  const v = n.value;
  if (v === null) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  const p = plain(v);
  const sign = v < 0 ? "" : "+";
  if (n.fmt === "x") return `×${p}`;
  if (n.fmt === "%") return `${sign}${p}%`;
  if (n.fmt === "+") return `${sign}${p}`;
  return p;
}
