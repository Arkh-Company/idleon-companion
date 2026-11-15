// The stand-in context of the term tests (pieces.cjs rowOfTerm, exprRow, stepRef and tidy, over written steps): each read
// and call is a plain row named by its code, so only the term's own rule is under test.
import type { RecNode } from "../recording.ts";
import { callText, row, valueOf } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr, Step } from "./steps.ts";
import { makeTerms } from "./terms.ts";
import { makeCodeFormulas } from "./code-formulas.ts";

export const nodes: RecNode[] = [
  { id: 0, b: "Top", a: [], c: [1, 2], p: null, pxi: 0, v: 9 },
  { id: 1, b: "B", a: [], c: [], p: 0, pxi: 0, v: 3 },
  { id: 2, b: "C", a: [], c: [], p: 0, pxi: 0, v: 2 },
  { id: 3, b: "ArbitraryCode5Inputs", a: [], c: [], p: 0, pxi: 0, v: 8 },
  // two calls named by their mode in words (tree/names.ts, P2)
  { id: 4, b: "Invented", a: ["SomeMode", 0, 0], c: [], p: 0, pxi: 0, v: 3 },
  { id: 5, b: "Invented", a: ["OtherMode", 0, 0], c: [], p: 0, pxi: 0, v: 2 },
];
export const finished: boolean[] = [];
/** The terms of `block`'s steps (the first node by default), in the loop entry `entry` gives. */
export const termsOf = (
  block?: RecNode,
  entry: () => string | null = () => null,
) =>
  makeTerms({
    nodes,
    // a read of a cache "DNSM.W…" has a writer to open into; any other read has none
    read: (p, v) => ({
      node: row({
        pieceKey: p,
        value: valueOf(v ?? null),
        code: p,
        kids: p.startsWith("DNSM.W") ? "lazy" : [],
      }),
      open: p.startsWith("DNSM.W") ? 9 : null,
    }),
    call: (k, v) => ({
      node: row({
        pieceKey: k.b,
        value: valueOf(v ?? null),
        code: callText(k),
      }),
      open: null,
    }),
    finish: (_v, rows, ones) => {
      finished.push(ones);
      return rows;
    },
    block: block ?? { id: 0, b: "Top", a: [], c: [], p: null, pxi: 0 },
    entry,
    formulas: makeCodeFormulas(nodes, () => []),
  });
export const terms = termsOf();
export const num = (v: number): Expr => ({ t: "num", v });
export const val = (v: number): Expr => ({ t: "val", v });
export const read = (p: string, v: number): Expr => ({ t: "read", p, v });
export const call = (id: number, v: number): Expr => ({ t: "call", id, v });
export const op = (o: string, l: Expr, r: Expr, v: number): Expr => ({
  t: "op",
  o,
  l,
  r,
  v,
});
/** The rows of the last step, a sum unless `op` says otherwise, with the reads given. */
export function rowsOf(
  steps: Step[],
  reads: [string, number | string][] = [],
  args: number[] = [],
  top: "*" | "+" = "+",
): Row[] {
  return terms.stepTerms(
    { args, steps, at: steps.length - 1 },
    top,
    new Map(reads),
  );
}
export const brief = (r: Row): unknown[] => [
  r.node.name,
  r.node.code,
  r.node.value,
  (r.group ?? []).map(brief),
];
export const fn = (name: string, args: Expr[], v: number): Expr => ({
  t: "fn",
  name,
  args,
  v,
});
