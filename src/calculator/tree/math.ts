// The arithmetic of a formula line as the tree writes it ("1 + 4 × 3 ÷ (3 + 200)", "min(5, pow(2, 3))"), evaluated
// without `Function` or `eval`: the bench's `evalNum` (share.cjs, from audit-e/flat.cjs) and the sum check of
// formulas.cjs `formulaOf`. Anything else in the line gives NaN, as there.
import type { CalcTreeNode } from "../tree-contract.ts";

const FNS: Readonly<Record<string, (...x: number[]) => number>> = {
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  abs: Math.abs,
  sqrt: Math.sqrt,
  log: Math.log,
  log10: Math.log10,
};
const TOKEN = /\s*(\d*\.?\d+(?:e[+-]?\d+)?|[a-z]\w*|\*\*|[-+*/^(),])/iy;

export function evaluate(line: string): number {
  const text = line
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/log₁₀/g, "log10")
    .replace(/,(?=\d{3})/g, "");
  const tokens: string[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < text.length) {
    const at = TOKEN.lastIndex;
    const m = TOKEN.exec(text);
    if (!m?.[1]) {
      if (text.slice(at).trim() === "") break;
      return NaN;
    }
    tokens.push(m[1]);
  }
  let i = 0;
  const peek = () => tokens[i];
  const take = (t: string) => (tokens[i] === t ? (i++, true) : false);

  function primary(): number {
    const t = tokens[i++];
    if (t === undefined) return NaN;
    if (t === "(") {
      const v = sum();
      return take(")") ? v : NaN;
    }
    if (/^[\d.]/.test(t)) return Number(t);
    const fn = Object.hasOwn(FNS, t) ? FNS[t] : undefined;
    if (!fn || !take("(")) return NaN;
    const args = [sum()];
    while (take(",")) args.push(sum());
    return take(")") ? fn(...args) : NaN;
  }
  function unary(): number {
    if (take("-")) return -unary();
    if (take("+")) return unary();
    return power();
  }
  function power(): number {
    const base = primary();
    return take("^") || take("**") ? base ** unary() : base;
  }
  function product(): number {
    let v = unary();
    for (;;)
      if (take("*")) v *= unary();
      else if (take("/")) v /= unary();
      else return v;
  }
  function sum(): number {
    let v = product();
    for (;;)
      if (take("+")) v += product();
      else if (take("-")) v -= product();
      else return v;
  }
  const v = sum();
  return peek() === undefined ? v : NaN;
}

const TERMS = /(\s*[×÷+−*/(),^:]\s*|\s+-\s+)/;
const NUMBER = /-?\d*\.?\d+(?:e[+-]?\d+)?/g;
const THOUSANDS = /,(?=\d{3})/g;
// A known term's place while the line is split: two private-use characters no formula has.
const SLOT = /(\d+)/g;

/** A term of `formula` that takes no number: a sign, a bracket, a comma or a math name (contracts/tree-worker.md). */
export const isOperator = (t: string): boolean =>
  /^[×÷+−*/(),^:-]$/.test(t) || t === "log₁₀" || Object.hasOwn(FNS, t);

/**
 * The contract's formula from the bench's two lines (data-model `formula`, FR-010: only atoms): the line with names
 * split into its terms (names, the code's numbers and operators), and every number of the line with numbers, in order,
 * the result last. A `known` term (a kid's name or path) stays whole, brackets and all.
 */
export function formulaAtoms(
  [names, numbers]: [string, string],
  known: readonly string[] = [],
): [string[], number[]] {
  const whole = [...new Set(known)]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  let line = names;
  whole.forEach((t, i) => {
    line = line.split(t).join(`${String(i)}`);
  });
  return [
    line
      .replace(THOUSANDS, "")
      .split(TERMS)
      .map((t) => t.trim().replace(SLOT, (_, i: string) => whole[+i] ?? ""))
      .filter(Boolean),
    [...numbers.replace(THOUSANDS, "").matchAll(NUMBER)].map((m) =>
      Number(m[0]),
    ),
  ];
}

/**
 * The ⓘ as it leaves the worker (contracts/tree-worker.md): its atoms when each term's number recomputes the line's
 * result, else a rule's two lines as they are ("If …: 35" / "yes → 35"), so no term is ever matched to another number.
 */
export function formulaOut(
  pair: [string, string],
  known: readonly string[] = [],
): CalcTreeNode["formula"] {
  const [terms, numbers] = formulaAtoms(pair, known);
  let i = 0;
  const filled = terms
    .map((t) => (isOperator(t) ? t : String(numbers[i++])))
    .join(" ");
  const result = numbers.at(-1) ?? NaN;
  const sum =
    pair[1].includes(" = ") && i + 1 === numbers.length
      ? evaluate(filled)
      : NaN;
  return Math.abs(sum - result) <= 1e-3 * Math.max(1, Math.abs(result))
    ? [terms, numbers]
    : { rule: pair };
}

/** pieces.cjs `near`: equal within 1e-9 of the second number, relative (a yes/no counts as 1 or 0). */
export const near = (a: unknown, b: unknown): boolean =>
  Math.abs(Number(a) - Number(b)) <= 1e-9 * Math.max(1, Math.abs(Number(b)));
/** pieces.cjs `num`: a number as a row's name writes it, whole or with 4 significant digits. */
export const num = (v: unknown): string =>
  Number.isInteger(Number(v))
    ? String(Number(v))
    : String(+Number(v).toPrecision(4));
