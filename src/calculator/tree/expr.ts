// The parts of a step's expression (spec 008, T022): the helpers of pieces.cjs `rowOfTerm` from the bench at
// BASELINE-4 that read an expression tree of tree/steps.ts: its top operator, its terms, its first source, how many
// sources of the player's state it has, the value a read took in it, whether it adds anything, and its text with numbers.
import { num } from "./math.ts";
import type { Expr } from "./steps.ts";

type V = Expr["v"];

export const topOp = (e: Expr | undefined): "*" | "+" | null =>
  e?.t === "op" && (e.o === "*" || e.o === "+") ? e.o : null;
export function flat(e: Expr, op: string, out: Expr[] = []): Expr[] {
  if (e.t === "op" && e.o === op) {
    flat(e.l, op, out);
    flat(e.r, op, out);
  } else out.push(e);
  return out;
}
/** The one operation of an expression that only adds, or only multiplies, its sources and numbers; else null. */
export function onlyOp(e: Expr): "+" | "*" | null {
  const ops = new Set<string>();
  const pure = (x: Expr): boolean => {
    if (x.t !== "op") return ["num", "val", "read", "call"].includes(x.t);
    ops.add(x.o);
    return pure(x.l) && pure(x.r);
  };
  const ok = pure(e);
  const [o] = ok && ops.size === 1 ? ops : [];
  return o === "+" || o === "*" ? o : null;
}
export function firstSrc(e: Expr | undefined): Expr | null {
  if (!e) return null;
  if (e.t === "def") return firstSrc(e.e);
  if (e.t === "call" || e.t === "read") return e;
  if (e.t === "op") return firstSrc(e.l) ?? firstSrc(e.r);
  if (e.t === "fn") for (const a of e.args) if (firstSrc(a)) return firstSrc(a);
  return null;
}

/** A read path of no state of the player: a table, a cache or a running total. */
export const notState = (p: string): boolean =>
  /^(DNSM|DummyNumbersStatManager|CustomLists|CustomMaps|ItemDefinitionsGET)\./.test(
    p,
  );
/** How many sources of the player's state an expression has (a table, a cache or a running total is none). */
export const stateSrc = (x: Expr): number =>
  x.t === "call"
    ? 1
    : x.t === "read"
      ? notState(x.p)
        ? 0
        : 1
      : x.t === "def"
        ? stateSrc(x.e)
        : x.t === "not"
          ? stateSrc(x.a)
          : x.t === "fn"
            ? x.args.reduce((a, y) => a + stateSrc(y), 0)
            : x.t === "op"
              ? stateSrc(x.l) + stateSrc(x.r)
              : 0;
/** A min or a max with a constant around one source of the player's state ("min(1, max(0.25, 0.25 + x))"): a clamp. */
export function isClamp(e: Expr): boolean {
  const x = e.t === "def" ? e.e : e;
  return (
    x.t === "fn" &&
    (x.name === "min" || x.name === "max") &&
    x.args.some((a) => a.t === "num") &&
    stateSrc(x) === 1
  );
}
export const readValueIn = (e: Expr, p: string): V => {
  if (e.t === "read") return e.p === p ? e.v : undefined;
  const subs =
    e.t === "op"
      ? [e.l, e.r]
      : e.t === "def"
        ? [e.e]
        : e.t === "not"
          ? [e.a]
          : e.t === "fn"
            ? e.args
            : [];
  for (const x of subs) {
    const v = readValueIn(x, p);
    if (v !== undefined) return v;
  }
  return undefined;
};

export const adds = (x: Expr): boolean =>
  (x.t === "op" && (x.o === "+" || x.o === "-")) ||
  (x.t === "op" && (adds(x.l) || adds(x.r))) ||
  (x.t === "def" && adds(x.e)) ||
  (x.t === "not" && adds(x.a)) ||
  (x.t === "fn" && x.args.some(adds));

/** A step made of numbers only, none of them read (DEEP3-FIX-1, the index of a table cell). */
export const noSource = (x: Expr): boolean =>
  x.t === "num" ||
  x.t === "val" ||
  (x.t === "op" && noSource(x.l) && noSource(x.r));

const SYM: Readonly<Record<string, string>> = {
  "*": "×",
  "/": "÷",
  "-": "−",
  "+": "+",
};
/** pieces.cjs `text`: an expression written with its numbers, the name the bench gives a branch of its parts. */
export function exprText(e: Expr): string {
  if (e.t === "def") return exprText(e.e);
  if (e.t === "op") {
    const side = (x: Expr) => {
      let y = x;
      while (y.t === "def") y = y.e;
      return y.t === "op" ? `(${exprText(x)})` : exprText(x);
    };
    return `${side(e.l)} ${SYM[e.o] ?? e.o} ${side(e.r)}`;
  }
  if (e.t === "fn")
    return `${String(e.name)}(${e.args.map(exprText).join(", ")})`;
  return num(e.v);
}
/** formulas.cjs `isFormulaName`: a name that is only a sum with numbers, which a branch's source name replaces. */
export const isFormulaName = (s: string): boolean =>
  /\d/.test(s) &&
  /[×÷+−-]|min\(|max\(|pow\(/.test(s) &&
  !/[a-z]{3,}/i.test(s.replace(/min|max|pow|floor|ceil/g, ""));
