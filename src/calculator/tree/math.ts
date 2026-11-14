// The arithmetic of a formula line as the tree writes it ("1 + 4 × 3 ÷ (3 + 200)", "min(5, pow(2, 3))"), evaluated
// without `Function` or `eval`: the bench's `evalNum` (share.cjs, from audit-e/flat.cjs) and the sum check of
// formulas.cjs `formulaOf`. Anything else in the line gives NaN, as there.

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
