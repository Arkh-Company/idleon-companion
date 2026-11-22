// The answer key of a number (spec 010, FR-002c, FR-008, research R1 and R9; the prototype's gabarito.ts): what the
// recording gives, read from the root block's steps and writes only, never calling the game. Above the pools, the root
// may have a top layer (answer-key-top.ts). Below it, the root's form is a chain (a running total written more than
// once, the last write the value), an expression (no running total: the root's last step, split along its left side)
// or a leaf (a value read or a constant, no pool). Each write, or each stretch of the expression, adds or multiplies;
// same-kind ones in a row are one pool. Any other form is refused with the reason, never guessed. Two root shapes of
// the blueprint come here too (spec, Open Questions 21 and 22/11): a sum of calls, a routine run on the recorder's copy,
// and a part of a call (terms of its recorded pool, by reference; answer-key-shapes.ts).
import type { Op } from "../instrument.ts";
import type { Recording } from "../recording.ts";
import { makeSteps } from "../recorded/steps.ts";
import type { BlockSteps, Expr } from "../recorded/steps.ts";
import {
  callRef,
  KIND,
  near,
  OP,
  OutOfRule,
  outOfRule,
  relDiff,
  SCRATCH,
  joinPools,
  strip,
  termReader,
} from "./answer-key-terms.ts";
import type {
  AnswerTerm,
  PoolKind,
  RawPool,
  RawTerm,
  RootFormError,
} from "./answer-key-terms.ts";
import {
  partInWriters,
  partKey,
  routineKey,
  sumKey,
} from "./answer-key-shapes.ts";
import { branchesOf, gateOf, peelTop } from "./answer-key-top.ts";
import type { Branch, TopLayer } from "./answer-key-top.ts";

export type {
  AnswerTerm,
  PoolKind,
  RootFormError,
} from "./answer-key-terms.ts";
export type { TopLayer } from "./answer-key-top.ts";

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
  /** Each factor of a top division's divisor, a ➗ line with its sources and constants (never a pool). */
  divisors: AnswerPool[];
  /** What the trace had that the answer key skipped or crossed, by kind. */
  pollution: Record<string, number>;
}

/** The blueprint's root shape, its references already turned into keys: a sum of calls, or a part of the call. */
export type RootShape =
  { sum: number } | { part: readonly string[] } | { routine: string } | null;

/** The functions a top layer is made of: one of them holds a value of the root when one of its arguments does. */
const LAYERED = new Set(["min", "max", "round", "floor", "ceil"]);
const topOf = (rec: Recording) =>
  rec.nodes[rec.nodes[rec.root ?? -1]?.c[0] ?? -1];

export function answerKey(
  rec: Recording,
  ops: readonly Op[],
  shape: RootShape = null,
): AnswerKey | RootFormError {
  if (shape && "sum" in shape) return sumKey(rec, shape.sum);
  if (shape && "routine" in shape) return routineKey(rec, shape.routine);
  const top = topOf(rec);
  if (!top) return outOfRule("a gravação não tem raiz");
  const gate = typeof top.v !== "number" ? null : gateOf(top, ops, top.v);
  const made = makeSteps(rec, ops);
  const blockSteps = made.of(top.id);
  const branches = branchesOf(top, ops, blockSteps.exprOf);
  const key = answerKeyOfSteps(rec, blockSteps, { gate, branches });
  if (!shape || !("part" in shape)) return key;
  const own = "error" in key ? key : partKey(key, shape.part);
  if (!("error" in own)) return own;
  const inner = (node: number, value: number) =>
    answerKeyOfSteps(rec, made.of(node), { node, value });
  return partInWriters(rec, top, shape.part, inner) ?? own;
}

/** The answer key from the root block's steps already made (`makeSteps(rec, ops).of(root)`). */
export function answerKeyOfSteps(
  rec: Recording,
  { steps, checks }: BlockSteps,
  opts: {
    gate?: TopLayer | null;
    branches?: readonly Branch[];
    /** Another recorded call than the root's (a call that builds a path the root reads)… */
    node?: number;
    /** …and the value it built there, in place of what it returned. */
    value?: number;
  } = {},
): AnswerKey | RootFormError {
  const out = outOfRule;
  const top = opts.node === undefined ? topOf(rec) : rec.nodes[opts.node];
  if (!top) return out("a gravação não tem raiz");
  const final = opts.value ?? top.v;
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

  // 1. What the pools are below: the root's last step under its layers, or a running total (under them, or alone).
  const layers: TopLayer[] = opts.gate ? [opts.gate] : [];
  let target = final;
  const written = [...byPath.values()].flat();
  /** A value that comes from what the root wrote: a path it wrote, or a value with no name equal to one it wrote. */
  const fromRoot = (e: Expr): boolean => {
    const b = e.t === "def" ? e.e : e;
    if (b.t === "read") return byPath.has(b.p);
    if (b.t === "val")
      return typeof b.v === "number" && written.some((w) => near(w, b.v));
    return b.t === "fn" && LAYERED.has(b.name ?? "") && b.args.some(fromRoot);
  };
  const i = steps.findLastIndex((s) => near(s.v, final));
  const last = steps[i];
  const peeled = last ? peelTop(last.e, fromRoot) : null;
  if (peeled?.refused) return out(peeled.refused);
  const layered = !!peeled && peeled.layers.length > 0;
  let acc = chainFor(final);
  const at = last && (layered || !acc) ? { e: last.e, step: i } : null;
  let rest: Expr | null = null;
  if (at && peeled) {
    layers.push(...peeled.layers);
    rest = peeled.rest;
    // a running total under the layer (Anvil Capacity: the chain, then a floor; the Multi-Ore: the chain, then a cap)
    const v = rest.v;
    if (layered) {
      acc =
        typeof v === "number" && (rest.t === "read" || rest.t === "val")
          ? chainFor(v)
          : null;
      if (acc) target = v as number;
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

  /** Each factor of each top division's divisor, as a ➗ line; and each Cap's or Floor's limit, as its sources. */
  function divisorsAndLimits(): AnswerPool[] {
    if (!at || !peeled) return [];
    const seen = new Set([at.step]);
    // a factor of a divisor, or a limit: a line with its sources and constants, as a pool of its own kind
    const lineOf = (f: Part): AnswerPool => {
      const kind = kindOf(f.e, f.seen) === "additive" ? "additive" : "multi";
      const terms = kept(termsOf([f], kind), null);
      const value = Number(f.e.v);
      const parts =
        kind === "additive"
          ? terms.reduce((s, t) => s + t.value * t.weight, 0)
          : terms.reduce((s, t) => s * t.value, 1);
      const error = relDiff(parts, value);
      return { kind, value, after: value, steps: [at.step], error, terms };
    };
    for (const [layer, e] of peeled.limits)
      layer.limit = lineOf({ e, w: 1, seen });
    return peeled.divisors.flatMap((b) =>
      operands(b, "multi", 1, seen).map(lineOf),
    );
  }

  let raw: RawPool[];
  let divisors: AnswerPool[];
  try {
    raw = acc ? chainPools(acc[1]) : expressionPools();
    divisors = divisorsAndLimits();
  } catch (e) {
    if (e instanceof OutOfRule) return out(e.message);
    throw e;
  }

  const pools = joinPools(raw);

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
    form: acc
      ? "chain"
      : pools.length + divisors.length > 0
        ? "expression"
        : "leaf",
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
    divisors,
    pollution: r.pollution,
  };
}
