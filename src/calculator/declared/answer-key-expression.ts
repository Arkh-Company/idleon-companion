// The expression form of the answer key (spec 010, FR-002c, research R1; moved out of answer-key.ts as it was): a root
// with no running total, its last step split along its left side into stretches, each one adding or multiplying; or a
// leaf with its proof, no pool.
import type { RecNode } from "../recording.ts";
import type { Expr } from "../recorded/steps.ts";
import { KIND, near, OutOfRule } from "./answer-key-terms.ts";
import type {
  AnswerTerm,
  Part,
  PoolKind,
  RawPool,
  RawTerm,
  termReader,
} from "./answer-key-terms.ts";

// `seen`: the root's steps already opened on the way down to a part, the one being opened included
// (answer-key-terms.ts, unwrap): a passage never leads back into them.
type Seen = ReadonlySet<number>;

export interface ExpressionContext {
  reader: ReturnType<typeof termReader>;
  /** `scale`: a ➗ line, where a constant times a sum scales each term of the sum */
  termsOf: (
    parts: readonly Part[],
    kind: PoolKind,
    scale?: number,
  ) => RawTerm[];
  kept: (terms: RawTerm[], prev: number | null) => AnswerTerm[];
}

/** The expression's readers over one root: its operands, the pool kind of a part, and its pools. */
export function expressionReader({
  reader: r,
  termsOf,
  kept,
}: ExpressionContext) {
  // 3. An expression: the operands of its top operator; the leftmost one is an earlier stretch when it is a sum inside
  // a product (in parentheses), or a product that starts with such a sum; otherwise it is the first pool's term.
  function operands(
    e: Expr,
    kind: PoolKind,
    w = 1,
    seen: Seen = new Set(),
  ): Part[] {
    const s = new Set(seen);
    const u = r.unwrap(e, [], true, s);
    if (
      u.t === "op" &&
      KIND[u.o] === kind &&
      (kind === "additive" || u.o === "*")
    )
      return [
        ...operands(u.l, kind, w, s),
        ...operands(u.r, kind, u.o === "-" ? -w : w, s),
      ];
    return [{ e, w, seen }];
  }
  const kindOf = (e: Expr, seen: Seen): PoolKind | undefined => {
    const u = r.unwrap(e, [], true, new Set(seen));
    return u.t === "op" ? KIND[u.o] : undefined;
  };
  /** `1 + sum / 100`: the % factor of a sum. */
  const isPct = (p: Part): boolean => {
    const u = r.unwrap(p.e, [], true, new Set(p.seen));
    if (u.t !== "op" || u.o !== "+") return false;
    const one = (x: Expr) => x.t === "num" && x.v === 1;
    const pct = (x: Expr) => {
      const d = r.unwrap(x, [], true, new Set(p.seen));
      return d.t === "op" && d.o === "/" && d.r.t === "num" && d.r.v === 100;
    };
    return (one(u.l) && pct(u.r)) || (one(u.r) && pct(u.l));
  };
  /**
   * Of a sum's terms, the one product of a sum and its % factor, `(1 + P/100) × (B + C)`, by the expression's shape
   * (T178): one only, added with weight 1, and some other term beside it; else null.
   */
  function baseTimesPct(all: readonly Part[]) {
    const hits = all.flatMap((p) => {
      const u = r.unwrap(p.e, [], true, new Set(p.seen));
      if (p.w !== 1 || u.t !== "op" || u.o !== "*") return [];
      const fs = operands(p.e, "multi", 1, p.seen);
      const [pct, ...pcts] = fs.filter(isPct);
      const [base, ...bases] = fs.filter(
        (f) => !isPct(f) && kindOf(f.e, f.seen) === "additive",
      );
      return fs.length === 2 && pct && base && pcts.length + bases.length === 0
        ? [{ part: p, pct, base, v: u.v }]
        : [];
    });
    const [hit, ...more] = hits;
    if (!hit || more.length > 0 || all.length < 2) return null;
    return {
      base: hit.base,
      pct: hit.pct,
      others: all.filter((p) => p !== hit.part),
      product: hit.v,
    };
  }
  function stretches(e: Expr, step: number, seen: Seen = new Set()): RawPool[] {
    const s = new Set(seen);
    const u = r.unwrap(e, [], true, s);
    const kind = kindOf(u, s);
    if (!kind || typeof u.v !== "number")
      throw new OutOfRule("a expressão da raiz não soma nem multiplica");
    const all = operands(u, kind, 1, s);
    const endFirst = kind === "additive" ? baseTimesPct(all) : null;
    if (endFirst) {
      // the code writes the end first (T178, the LUK): the base's sum, then its % factor, then the other terms
      const { base, pct, others } = endFirst;
      return [
        ...stretches(base.e, step, base.seen),
        {
          kind: "multi",
          terms: kept(termsOf([pct], "multi"), 0),
          step,
          after: Number(endFirst.product),
        },
        { kind, terms: kept(termsOf(others, kind), 0), step, after: u.v },
      ];
    }
    const [first, ...rest] = all;
    const inner = first ? kindOf(first.e, first.seen) : undefined;
    const lead =
      first && inner ? operands(first.e, inner, 1, first.seen)[0] : undefined;
    const earlier =
      first &&
      inner &&
      inner !== kind &&
      (kind === "multi" ||
        (lead !== undefined && kindOf(lead.e, lead.seen) === "additive"));
    if (earlier) {
      const before = stretches(first.e, step, first.seen);
      return [
        ...before,
        { kind, terms: kept(termsOf(rest, kind), 0), step, after: u.v },
      ];
    }
    return [
      {
        kind,
        terms: kept(termsOf(first ? [first, ...rest] : rest, kind), null),
        step,
        after: u.v,
      },
    ];
  }
  /**
   * Below the layers: the pools of an expression, or none for a leaf with its proof: a value the root read (a read
   * in the step, or with no step a recorded read of the root with the final value) or a constant (a number of the
   * code, or with no step a root that read and called nothing).
   */
  function expressionPools(
    at: { e: Expr; step: number } | null,
    rest: Expr | null,
    {
      kids,
      reads,
      target,
    }: {
      kids: readonly RecNode[];
      reads: NonNullable<RecNode["r"]>;
      target: number;
    },
  ): RawPool[] {
    if (!at || !rest) {
      // a child call with the final value wins over a read with it: the root passes the call on
      if (kids.some((k) => near(k.v, target)))
        throw new OutOfRule("a raiz só repassa uma chamada");
      if (reads.some(([, v]) => near(v, target))) return [];
      if (reads.length === 0 && kids.length === 0) return [];
      throw new OutOfRule("nenhum passo dá o valor final");
    }
    r.usedSteps.add(at.step);
    const seen = new Set([at.step]);
    const u = r.unwrap(rest, [], true, new Set(seen));
    if (u.t === "op" && KIND[u.o]) return stretches(rest, at.step, seen);
    // a curve with a constant (pow) is a term, its curve in the term's ⓘ: never a pool of its own
    if (
      u.t === "fn" &&
      u.name === "pow" &&
      u.args.some((a) => a.t === "num") &&
      typeof u.v === "number"
    ) {
      const terms = termsOf([{ e: rest, w: 1, seen }], "additive");
      return [
        {
          kind: "additive",
          terms: kept(terms, null),
          step: at.step,
          after: u.v,
        },
      ];
    }
    if (u.t === "read" || u.t === "num") return [];
    if (u.t === "call") throw new OutOfRule("a raiz só repassa uma chamada");
    if (u.t === "val") throw new OutOfRule("nenhum passo dá o valor final");
    throw new OutOfRule("a expressão da raiz não soma nem multiplica");
  }

  return { operands, kindOf, expressionPools };
}
