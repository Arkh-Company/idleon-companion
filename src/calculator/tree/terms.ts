// The rows a block's steps give (spec 008, T022): the port of pieces.cjs `flat`, `firstSrc`, `numRole`, `valPath`,
// `rowOfTerm`, `exprRow`, `stepRef` and `tidy` from the bench at BASELINE-4. Each term of a step is a row: a number of
// the code is a fixed value named by its place, a read or a call is the row of that source, a value with no source is
// the read that holds it, the argument the caller passed or the earlier step that made it. Left out until their own
// phase: the names (US1c: a row has the generic name), the 007 dictionary (the scratch and literal branches never run
// without it), the game's own passes (US1b-3) and the cut of the other sources of a branch (R1_CAP: a lazy branch has
// no size yet). The ×1 group of `tidy` is rows.ts `timesOne`, applied when a level is finished.
import type { RecNode, RecValue } from "../recording.ts";
import { MAX_DEPTH } from "./pieces.ts";
import { row, valueOf } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr, Step } from "./steps.ts";

export type Reads = ReadonlyMap<string, RecValue>;
type V = Expr["v"];

export interface TermContext {
  nodes: readonly RecNode[];
  /** A state read of the block as a row, open into its writer when it has one. */
  read(path: string, v: V): Row;
  /** A call as a row with the value its caller took; a curve takes its input from `reads`. */
  call(k: RecNode, v: V, reads: Reads): Row;
  /** A level's rows with their shares and their groups of 0 and, when `ones`, of ×1, under a parent of value `v`. */
  finish(v: V, rows: Row[], ones: boolean): Row[];
}
/** The call whose step is being built: its arguments, and its steps with the one being built. */
export interface Turn {
  args: readonly RecValue[];
  steps: readonly Step[];
  at: number;
}

export const near = (a: unknown, b: unknown) =>
  Math.abs(Number(a) - Number(b)) <= 1e-9 * Math.max(1, Math.abs(Number(b)));
const num = (v: unknown) =>
  Number.isInteger(Number(v))
    ? String(Number(v))
    : String(+Number(v).toPrecision(4));
const EARLIER_WHY = "a value of a step of the game the recording did not link";
const TABLE_READ =
  /^(CustomLists|CustomMaps|ItemDefinitionsGET|RANDOlist|NinjaInfo|GuildBonuses|SigilDesc|ChipDesc|JewelDesc|GodsInfo|LabMainBonus|ArcaneUpg|GrimoireUpg|UpgradeVault|ArmoryUpg|SpelunkUpg|ResGridSquares|MarketExoticInfo|ShrineInfo|TalentDescriptions)/;

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
const fixed = (name: string, v: unknown): Row => ({
  node: row({
    pieceKey: null,
    value: valueOf(v as RecValue),
    code: null,
    name,
    leaf: "fixedValue",
    flags: {},
  }),
  open: null,
});
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
export const hasKids = (r: Row) =>
  r.open !== null || (r.group?.length ?? 0) > 0 || r.node.kids === "lazy";

/** The read a value equals (the account's state first, a game table only when nothing else has it), or null. */
export function valPath(v: unknown, reads: Reads): string | null {
  const hits = [...reads].filter(
    ([p, x]) =>
      Math.abs(Number(x) - Number(v)) < 1e-9 &&
      !p.endsWith(".length") &&
      !p.includes(" contains ") &&
      !/^(CustomLists\.)?RANDOlist\[53\]/.test(p),
  );
  const pick =
    hits.find(([p]) => !TABLE_READ.test(p.replace(/^CustomLists\./, ""))) ??
    hits[0];
  return pick ? pick[0] : null;
}

/** How many sources of the player's state an expression has (a table, a cache or a running total is none). */
const stateSrc = (x: Expr): number =>
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
const readValueIn = (e: Expr, p: string): V => {
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
const adds = (x: Expr): boolean =>
  (x.t === "op" && (x.o === "+" || x.o === "-")) ||
  (x.t === "op" && (adds(x.l) || adds(x.r))) ||
  (x.t === "def" && adds(x.e)) ||
  (x.t === "not" && adds(x.a)) ||
  (x.t === "fn" && x.args.some(adds));

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
    return branch(e.v, ctx.finish(e.v, tidy(rows, "*", []), ones));
  }

  /** A value with no source of its own (pieces.cjs rowOfTerm, "val"). */
  function valRow(v: V, d: number, reads: Reads): Row {
    const vp = valPath(v, reads);
    if (vp) return ctx.read(vp, v);
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
      // DEEP3-FIX-4: a number the block cut out of a text it read is a constant of the game's table
      else if (Math.abs(v) > 1)
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
      const r = exprRow(x, d, reads);
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
    if (e.t === "read") return ctx.read(e.p, e.v);
    if (e.t === "val") return valRow(e.v, d, reads);
    if (e.t === "call") {
      const k = nodes[e.id];
      return k ? ctx.call(k, e.v, reads) : null;
    }
    // an expression around one source (1 + x ÷ 100, min(...), 5 × x): the source's row with the expression's value
    const s = firstSrc(e);
    // a read with no name of its own (every read, until US1c names them) that is no cache: the branch of the parts
    if (!s || (s.t === "read" && !s.p.startsWith("DNSM.")))
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
      )
        return exprRow(e, d, reads);
      return read;
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
      // [G5B-DEPTH] the branch is the call's row, no extra level
      return exprRow(e, d - 1, reads2, !adds(e));
    }
    return ctx.call(k, e.v, reads);
  }

  /**
   * pieces.cjs `tidy` (the ×1 group aside): a value from an earlier step that another row already shows, or that is 0
   * outside a product, leaves; one equal to a number the caller passed is that number; a cache read with nothing under
   * it beside another row of the same value leaves.
   */
  function tidy(
    rows: Row[],
    op: string | null,
    args: readonly RecValue[],
  ): Row[] {
    const isEarlier = (r: Row) => !!r.earlier && !hasKids(r);
    const passed = args.filter((x) => typeof x === "number");
    const out = rows
      .filter(
        (r) =>
          !(
            isEarlier(r) &&
            rows.some(
              (o) =>
                o !== r && !isEarlier(o) && near(o.node.value, r.node.value),
            )
          ),
      )
      .filter(
        (r) =>
          !(
            isEarlier(r) &&
            Math.abs(Number(r.node.value)) < 1e-12 &&
            op !== "*"
          ),
      )
      .map((r): Row => {
        if (!isEarlier(r) || !passed.some((x) => near(x, r.node.value)))
          return r;
        return fixed(
          `Value passed by the calling block: ${num(r.node.value)}`,
          r.node.value,
        );
      });
    return out.filter(
      (r) =>
        !(
          (r.node.code ?? "").startsWith("DNSM.") &&
          !hasKids(r) &&
          out.some(
            (o) =>
              o !== r &&
              near(o.node.value, r.node.value) &&
              (hasKids(o) || !(o.node.code ?? "").startsWith("DNSM.")),
          )
        ),
    );
  }

  return {
    /** The rows of the terms of the block's step `at` (its top sum or product). */
    stepTerms(t: Turn, op: "*" | "+", reads: Reads): Row[] {
      const st = t.steps[t.at];
      return st ? withTurn(t, () => terms(st.e, op, 1, reads)) : [];
    },
    tidy,
  };
}
