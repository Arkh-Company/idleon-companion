// The answer key of a number (spec 010, FR-002c, FR-008, research R1 and R9; the prototype's gabarito.ts): what the
// recording gives, read from the root block's steps and writes only, never calling the game. Above the pools, the root
// may have a top layer (answer-key-top.ts). Below it, the root's form is a chain (a running total written more than
// once, the last write the value), an expression (no running total: the root's last step, split along its left side)
// or a leaf (a value read or a constant, no pool). Each write, or each stretch of the expression, adds or multiplies;
// same-kind ones in a row are one pool. Any other form is refused with the reason, never guessed. Two root shapes of
// the blueprint come here too (spec, Open Questions 21/11): a sum of calls, and a part of a call (the smallest recorded
// sub-expression of the root that holds the given references).
import type { Op } from "../instrument.ts";
import type { Recording } from "../recording.ts";
import { makeSteps } from "../recorded/steps.ts";
import type { BlockSteps, Expr } from "../recorded/steps.ts";
import {
  callRef,
  near,
  OutOfRule,
  outOfRule,
  relDiff,
  SCRATCH,
  termReader,
} from "./answer-key-terms.ts";
import type { AnswerTerm, RawTerm, RootFormError } from "./answer-key-terms.ts";
import { partOf, sumKey } from "./answer-key-shapes.ts";
import { branchesOf, gateOf, peelTop } from "./answer-key-top.ts";
import type { Branch, TopLayer } from "./answer-key-top.ts";

export type { AnswerTerm, RootFormError } from "./answer-key-terms.ts";
export type { TopLayer } from "./answer-key-top.ts";
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
  form: "chain" | "expression" | "leaf" | "sum";
  /** The path written in a chain. */
  accumulator: string | null;
  /** The layers above the pools, from outside in. */
  top: TopLayer[];
  pools: AnswerPool[];
  /** What the trace had that the answer key skipped or crossed, by kind. */
  pollution: Record<string, number>;
}

/** The blueprint's root shape, its references already turned into keys: a sum of calls, or a part of the call. */
export type RootShape = { sum: number } | { part: readonly string[] } | null;

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

const topOf = (rec: Recording) =>
  rec.nodes[rec.nodes[rec.root ?? -1]?.c[0] ?? -1];

export function answerKey(
  rec: Recording,
  ops: readonly Op[],
  shape: RootShape = null,
): AnswerKey | RootFormError {
  if (shape && "sum" in shape) return sumKey(rec, shape.sum);
  const top = topOf(rec);
  if (!top) return outOfRule("a gravação não tem raiz");
  const part = shape?.part ?? null;
  const gate =
    part || typeof top.v !== "number" ? null : gateOf(top, ops, top.v);
  const blockSteps = makeSteps(rec, ops).of(top.id);
  const branches = branchesOf(top, ops, blockSteps.exprOf);
  return answerKeyOfSteps(rec, blockSteps, { gate, part, branches });
}

/** The answer key from the root block's steps already made (`makeSteps(rec, ops).of(root)`). */
export function answerKeyOfSteps(
  rec: Recording,
  { steps, checks }: BlockSteps,
  opts: {
    gate?: TopLayer | null;
    part?: readonly string[] | null;
    branches?: readonly Branch[];
  } = {},
): AnswerKey | RootFormError {
  const out = outOfRule;
  const top = topOf(rec);
  if (!top) return out("a gravação não tem raiz");
  const final = top.v;
  if (typeof final !== "number") return out("a raiz não deu número");
  const writes = rec.writes.filter((w) => w.node === top.id);
  const byPath = new Map<string, number[]>();
  for (const w of writes)
    if (typeof w.v === "number")
      byPath.set(w.path, [...(byPath.get(w.path) ?? []), w.v]);
  /** The running total that ends in `v`: the path written most, more than once, whose last write is `v`. */
  const chainFor = (v: number) =>
    [...byPath]
      .filter(([, vs]) => vs.length > 1 && near(vs.at(-1), v))
      .sort((a, b) => b[1].length - a[1].length)[0] ?? null;

  // 1. What the pools are below: a part of the call, a running total, or the root's last step under its layers.
  const layers: TopLayer[] = opts.gate ? [opts.gate] : [];
  let target = final;
  let at: { e: Expr; step: number } | null = null;
  let acc: [string, number[]] | null = null;
  if (opts.part) {
    const found = partOf(rec, steps, opts.part);
    if (!found || typeof found.e.v !== "number")
      return out("a parte indicada não está nos passos gravados da raiz");
    if (found.extra.length > 0)
      return out(
        `o passo da parte tem referências a mais: ${found.extra.join(", ")}`,
      );
    at = found;
    target = found.e.v;
  } else {
    acc = chainFor(final);
    const i = acc ? -1 : steps.findLastIndex((s) => near(s.v, final));
    const s = steps[i];
    if (s) at = { e: s.e, step: i };
  }
  let rest: Expr | null = null;
  if (at) {
    const peeled = peelTop(at.e);
    layers.push(...peeled.layers);
    rest = peeled.rest;
    // a running total under the layer (Anvil Capacity: the chain, then a floor)
    const v = rest.v;
    if (
      !opts.part &&
      peeled.layers.length > 0 &&
      typeof v === "number" &&
      (rest.t === "read" || rest.t === "val")
    ) {
      acc = chainFor(v);
      if (acc) target = v;
    }
  }

  const finals = [...byPath].filter(([, vs]) => near(vs.at(-1), target));
  const passage = new Map(
    [...byPath].filter(
      ([p]) => !finals.some(([q]) => q === p) && !p.startsWith(SCRATCH),
    ),
  );
  const kids = top.c.flatMap((c) => rec.nodes[c] ?? []);
  const reads = top.r ?? [];
  const r = termReader({
    nodes: rec.nodes,
    steps,
    kids,
    passage,
    accumulator: acc?.[0] ?? null,
    branches: opts.branches ?? [],
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
  // the running total, found among its terms by the value it had just before. A write no step gave is the total's
  // start (a 0 in a for loop's init) or an earlier turn of the loop whose last turn is a step; never the last write.
  function chainPools(values: readonly number[]): RawPool[] {
    const raw: RawPool[] = [];
    let from = 0;
    let before: number | null = null;
    values.forEach((w, n) => {
      const i = steps.findIndex((s, j) => j >= from && near(s.v, w));
      const s = steps[i];
      if (!s) {
        if (n === values.length - 1)
          throw new OutOfRule(
            `nenhum passo deu a escrita ${String(w)} do acumulador`,
          );
        r.bump("loopWrite");
        before = w;
        return;
      }
      r.usedSteps.add(i);
      from = i + 1;
      const opened = new Set([i]);
      const u = r.unwrap(s.e, [], true, new Set(opened));
      const kind = u.t === "op" ? KIND[u.o] : undefined;
      if (!kind || (u.t === "op" && u.o === "-"))
        throw new OutOfRule(`o passo ${String(i)} não soma nem multiplica`);
      const terms = termsOf([{ e: s.e, w: 1, seen: opened }], kind);
      const pv = before;
      const k =
        pv === null
          ? -1
          : terms.findIndex(
              (t) =>
                near(t.value, pv) &&
                (t.e.t === "val" || t.e.t === "read" || t.e.t === "def"),
            );
      if (k >= 0) {
        r.bump(
          terms[k]?.e.t === "read" ? "readAccumulator" : "unnamedAccumulator",
        );
        terms.splice(k, 1);
      } else if (pv !== null && raw.length > 0)
        throw new OutOfRule(`o passo ${String(i)} troca o acumulador`);
      raw.push({
        kind,
        terms: kept(terms, raw.length > 0 ? pv : null),
        step: i,
        after: s.v,
      });
      before = s.v;
    });
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
  /**
   * Below the layers: the pools of an expression, or none for a leaf with its proof: a value the root read (a read
   * in the step, or with no step a recorded read of the root with the final value) or a constant (a number of the
   * code, or with no step a root that read and called nothing).
   */
  function expressionPools(): RawPool[] {
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
    if (u.t === "read" || u.t === "num") return [];
    if (u.t === "call") throw new OutOfRule("a raiz só repassa uma chamada");
    if (u.t === "val") throw new OutOfRule("nenhum passo dá o valor final");
    throw new OutOfRule("a expressão da raiz não soma nem multiplica");
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
    final: opts.part ? target : final,
    form: acc ? "chain" : pools.length > 0 ? "expression" : "leaf",
    accumulator: acc?.[0] ?? null,
    // each condition whose path the pools crossed is a ❓ layer, in the code's order
    top: [
      ...layers,
      ...(opts.branches ?? [])
        .filter((_, i) => r.crossed.has(i))
        .map((b): TopLayer => ({
          kind: "cond",
          value: b.test,
          before: b.value,
          after: b.value,
        })),
    ],
    pools,
    pollution: r.pollution,
  };
}
