// The parts of a step's expression (spec 008, T022): the helpers of pieces.cjs `rowOfTerm` from the bench at
// BASELINE-4 that read an expression tree of tree/steps.ts: its top operator, its terms, its first source, how many
// sources of the player's state it has, the value a read took in it and whether it adds anything.
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
export function firstSrc(e: Expr | undefined): Expr | null {
  if (!e) return null;
  if (e.t === "def") return firstSrc(e.e);
  if (e.t === "call" || e.t === "read") return e;
  if (e.t === "op") return firstSrc(e.l) ?? firstSrc(e.r);
  if (e.t === "fn") for (const a of e.args) if (firstSrc(a)) return firstSrc(a);
  return null;
}

/** How many sources of the player's state an expression has (a table, a cache or a running total is none). */
export const stateSrc = (x: Expr): number =>
  x.t === "call"
    ? 1
    : x.t === "read"
      ? /^(DNSM|DummyNumbersStatManager|CustomLists|CustomMaps|ItemDefinitionsGET)\./.test(
          x.p,
        )
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
