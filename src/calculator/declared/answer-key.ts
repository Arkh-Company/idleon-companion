// The answer key of a number (spec 010, FR-002c, FR-008, research R1 and R9; the prototype's gabarito.ts): what the
// recording gives, read from the root block's steps and writes only, never calling the game. The root's form is a
// chain (a running total written more than once, the last write the final value) or an expression (no running total:
// the root's last step, split along its left side). Each write, or each stretch of the expression, adds or multiplies;
// same-kind ones in a row are one pool. Any other form is refused with the reason, never guessed.
import type { Op } from "../instrument.ts";
import type { Recording } from "../recording.ts";
import { makeSteps } from "../recorded/steps.ts";
import type { BlockSteps, Expr } from "../recorded/steps.ts";
import {
  callRef,
  near,
  OutOfRule,
  relDiff,
  SCRATCH,
  termReader,
} from "./answer-key-terms.ts";
import type { AnswerTerm, RawTerm } from "./answer-key-terms.ts";

export type { AnswerTerm } from "./answer-key-terms.ts";
export type PoolKind = "additive" | "multi";

export interface AnswerPool {
  kind: PoolKind;
  /** In the first pool, its value; in the others, what it adds (additive) or its factor (multi). */
  value: number;
  /** The running total after this pool. */
  after: number;
  /** The indices of the root's steps that make the pool. */
  steps: number[];
  /** The relative difference between the parts and the pool's value. */
  error: number;
  terms: AnswerTerm[];
}

export interface AnswerKey {
  /** The root call's reference key. */
  root: string;
  final: number;
  form: "chain" | "expression";
  /** The path written in a chain. */
  accumulator: string | null;
  pools: AnswerPool[];
  /** What the trace had that the answer key skipped or crossed, by kind. */
  pollution: Record<string, number>;
}

export interface RootFormError {
  error: "rootForm";
  reason: string;
}

const OUT_OF_RULE = "forma de raiz fora da regra dos pools";
const KIND: Record<string, PoolKind> = {
  "+": "additive",
  "-": "additive",
  "*": "multi",
};
const OP: Record<PoolKind, "+" | "*"> = { additive: "+", multi: "*" };

interface RawPool {
  kind: PoolKind;
  terms: AnswerTerm[];
  step: number;
  after: number;
}

const strip = (t: RawTerm): AnswerTerm => ({
  kind: t.kind,
  ref: t.ref,
  refs: t.refs,
  nodes: t.nodes,
  value: t.value,
  weight: t.weight,
  via: t.via,
});

const outOfRule = (why: string): RootFormError => ({
  error: "rootForm",
  reason: `${OUT_OF_RULE}: ${why}`,
});
const topOf = (rec: Recording) =>
  rec.nodes[rec.nodes[rec.root ?? -1]?.c[0] ?? -1];

export function answerKey(
  rec: Recording,
  ops: readonly Op[],
): AnswerKey | RootFormError {
  const top = topOf(rec);
  return top
    ? answerKeyOfSteps(rec, makeSteps(rec, ops).of(top.id))
    : outOfRule("a gravação não tem raiz");
}

/** The answer key from the root block's steps already made (`makeSteps(rec, ops).of(root)`). */
export function answerKeyOfSteps(
  rec: Recording,
  { steps, checks }: BlockSteps,
): AnswerKey | RootFormError {
  const out = outOfRule;
  const top = topOf(rec);
  if (!top) return out("a gravação não tem raiz");
  const final = top.v;
  if (typeof final !== "number") return out("a raiz não deu número");
  const writes = rec.writes.filter((w) => w.node === top.id);

  // 1. The accumulator: the path the root wrote most, more than once, whose last write is the final value.
  const byPath = new Map<string, number[]>();
  for (const w of writes)
    if (typeof w.v === "number")
      byPath.set(w.path, [...(byPath.get(w.path) ?? []), w.v]);
  const finals = [...byPath].filter(([, vs]) => near(vs.at(-1), final));
  finals.sort((a, b) => b[1].length - a[1].length);
  const best = finals[0];
  const acc = best && best[1].length > 1 ? best : null;
  const passage = new Map(
    [...byPath].filter(
      ([p]) => !finals.some(([q]) => q === p) && !p.startsWith(SCRATCH),
    ),
  );
  const kids = top.c.flatMap((c) => rec.nodes[c] ?? []);
  const r = termReader({
    nodes: rec.nodes,
    steps,
    kids,
    passage,
    accumulator: acc?.[0] ?? null,
  });
  r.bump("totalCopy", finals.length - (acc ? 1 : 0));
  r.bump(
    "scratchWrite",
    writes.filter((w) => w.path.startsWith(SCRATCH)).length,
  );

  // `seen`: the root's steps already opened on the way down to a part, the one being opened included
  // (answer-key-terms.ts, unwrap): a passage never leads back into them.
  type Seen = ReadonlySet<number>;
  interface Part {
    e: Expr;
    w: number;
    seen: Seen;
  }
  const termsOf = (parts: readonly Part[], kind: PoolKind): RawTerm[] => {
    const terms: RawTerm[] = [];
    for (const p of parts) r.flat(p.e, OP[kind], p.w, terms, [], p.seen);
    return terms;
  };
  const kept = (terms: RawTerm[], prev: number | null): AnswerTerm[] => {
    for (const t of terms) {
      r.keep(t.noise);
      if (t.kind === "constant") r.bump("looseConstant");
    }
    // A step that only adds or multiplies a constant came from a `cond && (...)` the trace keeps no check of.
    if (prev !== null && terms.every((t) => t.kind === "constant"))
      r.bump("conditionedStep");
    return terms.map(strip);
  };

  // 2. A chain: each accumulator write matched, in order, with the step that gave it; each step adds to or multiplies
  // the running total, found among its terms by the value it had.
  function chainPools(writes: readonly number[]): RawPool[] {
    const raw: RawPool[] = [];
    let from = 0;
    let prev: number | null = null;
    for (const w of writes) {
      const i = steps.findIndex((s, j) => j >= from && near(s.v, w));
      const s = steps[i];
      if (!s)
        throw new OutOfRule(
          `nenhum passo deu a escrita ${String(w)} do acumulador`,
        );
      r.usedSteps.add(i);
      from = i + 1;
      const opened = new Set([i]);
      const u = r.unwrap(s.e, [], true, new Set(opened));
      const kind = u.t === "op" ? KIND[u.o] : undefined;
      if (!kind || (u.t === "op" && u.o === "-"))
        throw new OutOfRule(`o passo ${String(i)} não soma nem multiplica`);
      const terms = termsOf([{ e: s.e, w: 1, seen: opened }], kind);
      if (prev !== null) {
        const pv = prev;
        const k = terms.findIndex(
          (t) =>
            near(t.value, pv) &&
            (t.e.t === "val" || t.e.t === "read" || t.e.t === "def"),
        );
        if (k < 0)
          throw new OutOfRule(`o passo ${String(i)} troca o acumulador`);
        r.bump(
          terms[k]?.e.t === "read" ? "readAccumulator" : "unnamedAccumulator",
        );
        terms.splice(k, 1);
      }
      raw.push({ kind, terms: kept(terms, prev), step: i, after: s.v });
      prev = s.v;
    }
    return raw;
  }

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
  function stretches(e: Expr, step: number, seen: Seen = new Set()): RawPool[] {
    const s = new Set(seen);
    const u = r.unwrap(e, [], true, s);
    const kind = kindOf(u, s);
    if (!kind || typeof u.v !== "number")
      throw new OutOfRule("a expressão da raiz não soma nem multiplica");
    const [first, ...rest] = operands(u, kind, 1, s);
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
  function expressionPools(): RawPool[] {
    const i = steps.findLastIndex((s) => near(s.v, final));
    const s = steps[i];
    if (!s) throw new OutOfRule("nenhum passo dá o valor final");
    r.usedSteps.add(i);
    return stretches(s.e, i, new Set([i]));
  }

  let raw: RawPool[];
  try {
    raw = acc ? chainPools(acc[1]) : expressionPools();
  } catch (e) {
    if (e instanceof OutOfRule) return out(e.message);
    throw e;
  }

  // 4. Same-kind pools in a row are one pool; each pool's value from the running total around it.
  const pools: AnswerPool[] = [];
  for (const p of raw) {
    const last = pools.at(-1);
    if (last?.kind === p.kind) {
      last.terms.push(...p.terms);
      if (!last.steps.includes(p.step)) last.steps.push(p.step);
      last.after = p.after;
    } else
      pools.push({
        kind: p.kind,
        value: 0,
        after: p.after,
        terms: [...p.terms],
        steps: [p.step],
        error: 0,
      });
  }
  let before: number | null = null;
  for (const p of pools) {
    p.value =
      p.kind === "additive" ? p.after - (before ?? 0) : p.after / (before ?? 1);
    const parts =
      p.kind === "additive"
        ? p.terms.reduce((s, t) => s + t.value * t.weight, 0)
        : p.terms.reduce((s, t) => s * t.value, 1);
    p.error = relDiff(parts, p.value);
    before = p.after;
  }

  r.bump("stepOutsideChain", steps.length - r.usedSteps.size);
  const touches = [acc?.[0], ...passage.keys()].filter((p) => p !== undefined);
  const own = checks.filter((c) => {
    const j = JSON.stringify(c.e);
    return touches.some((p) => j.includes(JSON.stringify(p)));
  }).length;
  r.bump("branchCheck", own);
  r.bump("preambleCheck", checks.length - own);
  r.bump("mergedSteps", raw.length - pools.length);
  return {
    root: callRef(top),
    final,
    form: acc ? "chain" : "expression",
    accumulator: acc?.[0] ?? null,
    pools,
    pollution: r.pollution,
  };
}
