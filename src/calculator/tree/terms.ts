// The rows a block's steps give (spec 008, T022): the port of pieces.cjs `numRole`, `rowOfTerm`, `exprRow` and `stepRef`
// from the bench at BASELINE-4 (the expression helpers are in expr.ts, `valPath` in val-path.ts, `tidy` in tidy.ts, the
// opening of a cache read in caches.ts). Each term of a step is a row: a number of the code is a fixed value named by its
// place, a read or a call is the row of that source, a value with no source is the read that holds it, the argument the
// caller passed or the earlier step that made it. Left out: the 007 dictionary (the scratch and literal branches never
// run without it) and the cut of the other sources of a branch (R1_CAP: a lazy branch has no size yet).
import type { RecNode, RecValue } from "../recording.ts";
import { MAX_DEPTH } from "./pieces.ts";
import { callText, row, valueOf } from "./rows.ts";
import type { Row } from "./rows.ts";
import {
  adds,
  exprText,
  firstSrc,
  flat,
  isFormulaName,
  readValueIn,
  stateSrc,
  topOp,
} from "./expr.ts";
import { nameOf, termName } from "./names.ts";
import type { Expr, Step } from "./steps.ts";
import { near, num } from "./math.ts";
import { fixed, hasKids, tidy } from "./tidy.ts";
import { any, BUBBLE_VALUES, valPath } from "./val-path.ts";
import {
  codeTable,
  earlierTotal,
  listCount,
  wornTotal,
} from "./term-passes.ts";
import type { Reads } from "./val-path.ts";
import type { CodeFormulas } from "./code-formulas.ts";

type V = Expr["v"];

export interface TermContext {
  nodes: readonly RecNode[];
  /** A state read of the block as a row, open into its writer when it has one. */
  read(path: string, v: V): Row;
  /** A call as a row with the value its caller took; a curve takes its input from `reads`. */
  call(k: RecNode, v: V, reads: Reads): Row;
  /** A level's rows with their shares and their groups of 0 and, when `ones`, of ×1, under a parent of value `v`. */
  finish(v: V, rows: Row[], ones: boolean): Row[];
  /** The call whose terms these are (the bench's CUR_BLOCK). */
  block: RecNode;
  /** The cache entry whose loop turn is being walked (the bench's ENTRY_P). */
  entry(): string | null;
  /** The ⓘ the game's code gives a row before its own rows exist (tree/code-formulas.ts). */
  formulas: CodeFormulas;
}
/** The call whose step is being built: its arguments, and its steps with the one being built. */
export interface Turn {
  args: readonly RecValue[];
  steps: readonly Step[];
  at: number;
}

const EARLIER_WHY = "a value of a step of the game the recording did not link";

/** The role of a number of the game's code, from where it sits in the expression. */
function numRole(v: unknown, parent: Expr | null, side: number): string {
  const n = num(v);
  if (parent?.t === "fn") {
    if (parent.name === "min") return `Cap ${n}`;
    if (parent.name === "max") return `Minimum ${n}`;
    if (parent.name === "pow")
      return side === 1 ? `Exponent ${n}` : `Base ${n}`;
  }
  if (parent?.t !== "op") return `Fixed value ${n}`;
  if (parent.o === "+") return `Base ${n}`;
  if (parent.o === "-") return side === 1 ? `Minus ${n}` : `Fixed value ${n}`;
  if (parent.o === "*") return `× ${n}`;
  if (parent.o === "/" && side === 1)
    return Number(v) === 100 ? "Percent to number (÷ 100)" : `Divided by ${n}`;
  return `Fixed value ${n}`;
}
const earlier = (v: V): Row => ({
  node: row({
    pieceKey: null,
    value: valueOf(v ?? null),
    code: null,
    leaf: "unknown",
    why: EARLIER_WHY,
  }),
  open: null,
  earlier: true,
});
/** A branch built here: its rows are its parts already. */
const branch = (v: V, group: Row[]): Row => ({
  node: row({ pieceKey: null, value: valueOf(v ?? null), code: null }),
  open: null,
  group,
});
/** A branch built here named `name`, a name of its own. */
const named = (r: Row, name: string | null): Row =>
  name === null
    ? r
    : { ...r, node: { ...r.node, name, flags: withoutUnnamed(r.node.flags) } };
const withoutUnnamed = (flags: Row["node"]["flags"]) => {
  const out = { ...flags };
  delete out.unnamed;
  return out;
};
/** formulas.cjs `fallback`: the branch of an expression takes `name` when its own name would be its sum with numbers. */
const fallback = (r: Row, e: Expr, name: string | null) =>
  isFormulaName(exprText(e)) ? named(r, name) : r;
export type Terms = ReturnType<typeof makeTerms>;
export function makeTerms(ctx: TermContext) {
  const { nodes } = ctx;
  let turn: Turn | null = null;
  function withTurn<T>(t: Turn | null, fn: () => T): T {
    const before = turn;
    turn = t;
    try {
      return fn();
    } finally {
      turn = before;
    }
  }
  const terms = (e: Expr, op: "*" | "+", d: number, reads: Reads) =>
    flat(e, op).flatMap((x) => rowOfTerm(x, op, d, reads) ?? []);

  /** A value the step took from an earlier step of the same block: that step's terms. */
  function stepRef(v: V, d: number, reads: Reads): Row | null {
    const t = turn;
    if (!t || d > MAX_DEPTH) return null;
    for (let j = t.at - 1; j >= 0; j--) {
      const st = t.steps[j];
      if (!st || !near(st.v, v)) continue;
      const op = topOp(st.e);
      const rows = withTurn({ ...t, at: j }, () => {
        if (op) return terms(st.e, op, d + 1, reads);
        const r = rowOfTerm(st.e, null, d + 1, reads);
        return r ? [r] : [];
      });
      // a step that is one term of the same value is that term
      const [only] = rows;
      if (only && rows.length === 1 && near(only.node.value, v)) return only;
      // pieces.cjs stepRef tidies with no caller ({ id: -1 }): no argument names an earlier value here
      return branch(
        v,
        op ? ctx.finish(v, tidy(rows, op, []), op === "*") : rows,
      );
    }
    return null;
  }

  /** A branch of the parts of an expression (exprRow0): its numbers by their role, its sources as rows. */
  function exprRow(e: Expr, d: number, reads: Reads, ones = true) {
    const rows: Row[] = [];
    (function walk(x: Expr, parent: Expr | null, side: number) {
      if (x.t === "num") rows.push(fixed(numRole(x.v, parent, side), x.v));
      else if (x.t === "val" || x.t === "read" || x.t === "call") {
        const o = parent?.t === "op" ? parent.o : null;
        const r = rowOfTerm(x, o, d + 1, reads);
        if (r) rows.push(r);
      } else if (x.t === "op") {
        walk(x.l, x, 0);
        walk(x.r, x, 1);
      } else if (x.t === "fn") {
        x.args.forEach((a, i) => {
          walk(a, x, i);
        });
      } else if (x.t === "not") walk(x.a, x, 0);
    })(e, null, 0);
    // [R1-PATCH] the parts of a sum are no parts at ×1: the group is undone when the expression adds anything
    const out = branch(e.v, ctx.finish(e.v, tidy(rows, "*", []), ones));
    const xf = ctx.formulas.expr(e, reads, e.v);
    return xf ? { ...out, xf } : out;
  }

  /** A value with no source of its own (pieces.cjs rowOfTerm, "val"). */
  function valRow(v: V, d: number, reads: Reads): Row {
    const vp = valPath(v, reads);
    const total = earlierTotal(ctx.entry(), v, reads, vp !== null);
    if (total) return total;
    // OPUS4-6: a bubble's value opens into the bubble, with no ⓘ of its writer
    if (vp)
      return any(BUBBLE_VALUES, vp)
        ? { ...ctx.read(vp, v), writerF: "never" }
        : ctx.read(vp, v);
    const count = listCount(v, reads);
    if (count) return count;
    let own: Row | null = null;
    if (typeof v === "number") {
      // DEEP3-FIX-3: the first numeric argument after the mode is the entry asked of the call (never a 0: rule 30)
      const ai =
        v === 0 || !turn
          ? -1
          : turn.args.findIndex(
              (x, j) => j > 0 && typeof x === "number" && x === v,
            );
      if (ai === 1)
        own = {
          node: row({
            pieceKey: null,
            value: v,
            code: null,
            name: "Entry asked of the call (argument 1)",
            leaf: "choice",
            flags: {},
          }),
          open: null,
        };
      // DEEP3-FIX-4: a table the block writes in its own code; a number it cut out of a text it read
      else own = codeTable(ctx.block, v);
      if (!own && ai !== 1 && Math.abs(v) > 1)
        for (const [, x] of reads)
          if (
            typeof x === "string" &&
            x.split(/[|,;]/).some((tk) => tk.trim() !== "" && Number(tk) === v)
          ) {
            own = {
              node: row({
                pieceKey: null,
                value: v,
                code: null,
                leaf: "fixedValue",
              }),
              open: null,
            };
            break;
          }
    }
    return stepRef(v, d, reads) ?? own ?? earlier(v);
  }

  /** The name of an expression's source (its read or its call), when it has one that is no generic name. */
  const sourceName = (src: Expr | null) => {
    const k = src?.t === "call" ? nodes[src.id] : undefined;
    return src?.t === "read"
      ? termName(src.p)
      : k
        ? termName(callText(k))
        : null;
  };

  function rowOfTerm(
    e: Expr,
    op: string | null,
    d: number,
    reads: Reads,
  ): Row | null {
    if (e.t === "def") {
      const x = e.e;
      if (["call", "read", "val", "num", "def"].includes(x.t)) {
        const r = rowOfTerm(x, op, d, reads);
        // [R1-PATCH] a call's code never goes with another value: a def that changed it is a branch over the call
        if (
          r?.node.code &&
          typeof r.node.value === "number" &&
          typeof e.v === "number" &&
          !near(r.node.value, e.v)
        )
          return branch(e.v, [r]);
        return r && { ...r, node: { ...r.node, value: valueOf(e.v ?? null) } };
      }
      // the branch of an expression is named by its first source
      const r = named(exprRow(x, d, reads), sourceName(firstSrc(x)));
      return { ...r, node: { ...r.node, value: valueOf(e.v ?? null) } };
    }
    if (e.t === "num")
      return fixed(
        op === "*"
          ? `Fixed ×${num(e.v)}`
          : op === "+"
            ? `Fixed +${num(e.v)}`
            : `Fixed value ${num(e.v)}`,
        e.v,
      );
    if (e.t === "read")
      return wornTotal(e.p, e.v, turn?.steps[turn.at]?.e) ?? ctx.read(e.p, e.v);
    if (e.t === "val") return valRow(e.v, d, reads);
    if (e.t === "call") {
      const k = nodes[e.id];
      return k ? ctx.call(k, e.v, reads) : null;
    }
    // an expression around one source (1 + x ÷ 100, min(...), 5 × x): the source's row with the expression's value
    const s = firstSrc(e);
    // a read with no name of its own (pieces.cjs readName) that is no cache: the branch of the parts
    if (!s || (s.t === "read" && !s.p.startsWith("DNSM.") && !nameOf(s.p)))
      return exprRow(e, d, reads);
    if (s.t === "read") {
      const read = ctx.read(s.p, e.v);
      const rv = readValueIn(e, s.p);
      // a sum around a product of the read by a part that is no constant is the branch of its parts
      const prodOther = (x: Expr): boolean =>
        (x.t === "op" &&
          x.o === "*" &&
          [x.l, x.r].some((y) => y.t === "read" && y.p === s.p) &&
          [x.l, x.r].some(
            (y) => !(y.t === "read" && y.p === s.p) && y.t !== "num",
          )) ||
        (x.t === "op" && (prodOther(x.l) || prodOther(x.r))) ||
        (x.t === "def" && prodOther(x.e)) ||
        (x.t === "fn" && x.args.some(prodOther));
      if (
        (!hasKids(read) || prodOther(e)) &&
        rv !== undefined &&
        !near(rv, e.v)
      ) {
        // the branch of the parts takes the read's name, unless a product's other part is no constant
        const other =
          e.t === "op" && e.o === "*"
            ? [e.l, e.r].find((x) => !(x.t === "read" && x.p === s.p))
            : undefined;
        const r = exprRow(e, d, reads);
        return !other || other.t === "num" ? fallback(r, e, termName(s.p)) : r;
      }
      return { ...read, writerF: "sameValue" };
    }
    if (s.t !== "call") return null;
    const k = nodes[s.id];
    if (!k) return null;
    // [G5B-CURVE] the curve's row only with the curve's own value
    if (
      k.b === "ArbitraryCode5Inputs" &&
      !(typeof k.v === "number" && typeof e.v === "number" && !near(k.v, e.v))
    )
      return ctx.call(k, e.v, reads);
    // [R1-PATCH] around a call whose value is not the call's own, or with two or more sources: the branch of its parts
    if (
      stateSrc(e) > 1 ||
      (typeof k.v === "number" && typeof e.v === "number" && !near(k.v, e.v))
    ) {
      const reads2 = new Map(reads);
      for (const [rp, rv] of k.r ?? []) if (!reads2.has(rp)) reads2.set(rp, rv);
      // [G5B-DEPTH] the branch is the call's row, no extra level; its name is its source's for one source, else its
      // shape's, and its first source's name tells two such branches apart (formulas.cjs r1src)
      const ns = stateSrc(e);
      const own = termName(callText(k));
      const pct =
        e.t === "op" &&
        e.o === "+" &&
        e.l.t === "num" &&
        Number(e.l.v) === 1 &&
        e.r.t === "op" &&
        e.r.o === "/";
      const shape =
        ns <= 1
          ? own
          : pct || (e.t === "op" && (e.o === "*" || e.o === "/"))
            ? `Multiplier from ${String(ns)} sources`
            : e.t === "op" && e.o === "+"
              ? `Sum of ${String(ns)} sources`
              : `Formula of ${String(ns)} sources`;
      const r = fallback(exprRow(e, d - 1, reads2, !adds(e)), e, shape);
      return own ? { ...r, r1src: own } : r;
    }
    // the expression around the call when it has two named parts or more, else the call's own ⓘ (the call row's: the
    // value here is the call's); the expression around the call alone only when neither gives one (tree/formulas.ts)
    const r = ctx.call(k, e.v, reads);
    const xf = ctx.formulas.expr(e, reads, e.v, 2);
    if (xf) return { ...r, xf };
    const weak = ctx.formulas.expr(e, reads, e.v, 1);
    return weak ? { ...r, xweak: weak } : r;
  }

  return {
    /**
     * pieces.cjs `stepRowsAt`: the rows of expression `e` taken as step `t.at` of the block, its terms tidied when it is
     * a sum or a product, else its one row; and its top operator.
     */
    rowsAt(
      t: Turn,
      e: Expr,
      reads: Reads,
    ): { rows: Row[]; op: "*" | "+" | null } {
      const op = topOp(e);
      return withTurn(t, () => {
        if (op) return { rows: tidy(terms(e, op, 1, reads), op, t.args), op };
        const r = rowOfTerm(e, null, 1, reads);
        return { rows: r ? [r] : [], op };
      });
    },
    /** pieces.cjs `exprRow` with no step around it: the branch of an expression's parts ([F2-TOP]). */
    branchOf: (e: Expr, reads: Reads) =>
      withTurn(null, () => exprRow(e, 0, reads)),
    /** One term of a product with no step around it (pieces.cjs entryRows, a multiplier's terms). */
    term: (e: Expr, op: "*" | "+", reads: Reads) =>
      withTurn(null, () => rowOfTerm(e, op, 1, reads)),
    /** The rows of the terms of the block's step `at` (its top sum or product). */
    stepTerms(t: Turn, op: "*" | "+", reads: Reads): Row[] {
      const st = t.steps[t.at];
      return st ? withTurn(t, () => terms(st.e, op, 1, reads)) : [];
    },
    tidy,
  };
}
