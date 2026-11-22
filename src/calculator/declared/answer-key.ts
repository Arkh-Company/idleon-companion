// The answer key of a number (spec 010, FR-002c, FR-008, research R1 and R9; the prototype's gabarito.ts): what the
// recording gives, read from the root block's steps and writes only, never calling the game. Above the pools, the root
// may have a top layer (answer-key-top.ts). Below it, the root's form is a chain (a running total written more than
// once, the last write the value), an expression (no running total: the root's last step, split along its left side)
// or a leaf (a value read or a constant, no pool). Each write, or each stretch of the expression, adds or multiplies;
// same-kind ones in a row are one pool. Any other form is refused with the reason, never guessed. Two root shapes of
// the blueprint come here too (spec, Open Questions 21 and 22/11): a sum of calls, a routine run on the recorder's copy,
// and a part of a call (terms of its recorded pool, by reference; answer-key-shapes.ts).
import type { Op } from "../instrument.ts";
import type { Recording, RecNode, RecWrite } from "../recording.ts";
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
  Part,
  PoolKind,
  RawPool,
  RawTerm,
  RootFormError,
} from "./answer-key-terms.ts";
import {
  itemOf,
  partInWriters,
  partKey,
  routineKey,
  sumKey,
} from "./answer-key-shapes.ts";
import { chainPools, matchChain } from "./answer-key-chain.ts";
import type { Bound, WriteMeta } from "./answer-key-chain.ts";
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
  | { sum: number }
  | { part: readonly string[] }
  | { routine: string }
  | { item: number }
  | null;

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
  if (shape && "item" in shape) {
    const value = itemOf(rec, top, shape.item);
    if (typeof value !== "number") return value;
    // the item's step by its value: more than one step with it is ambiguous
    if (blockSteps.steps.filter((s) => near(s.v, value)).length > 1)
      return outOfRule(`o item ${String(shape.item)} está em mais de um passo`);
    return answerKeyOfSteps(rec, blockSteps, { branches, value, ops });
  }
  const key = answerKeyOfSteps(rec, blockSteps, { gate, branches, ops });
  if (!shape || !("part" in shape)) return key;
  const own = "error" in key ? key : partKey(key, shape.part);
  // found, or refused as ambiguous in the root: never looked for again elsewhere
  if (!("error" in own) || ("part" in own && own.part === "ambiguous"))
    return own;
  const inner = (
    node: number,
    value: number,
    turn?: { from: number; to: number },
  ) => {
    const n = rec.nodes[node];
    const steps = turn && n ? made.turnOf(n, turn) : made.of(node);
    return answerKeyOfSteps(rec, steps, { node, value, ops });
  };
  return partInWriters(rec, top, shape.part, inner) ?? own;
}

/** The answer key from the root block's steps already made (`makeSteps(rec, ops).of(root)`). */
export function answerKeyOfSteps(
  rec: Recording,
  { steps, checks, stepAt }: BlockSteps,
  opts: {
    gate?: TopLayer | null;
    branches?: readonly Branch[];
    /** Another recorded call than the root's (a call that builds a path the root reads)… */
    node?: number;
    /** …and the value it built there, in place of what it returned. */
    value?: number;
    /** The game's code, to read a write that cuts the total under a test (T162). */
    ops?: readonly Op[];
  } = {},
): AnswerKey | RootFormError {
  const out = outOfRule;
  const top = opts.node === undefined ? topOf(rec) : rec.nodes[opts.node];
  if (!top) return out("a gravação não tem raiz");
  const final = opts.value ?? top.v;
  if (typeof final !== "number") return out("a raiz não deu número");
  const writes = rec.writes.filter((w) => w.node === top.id);
  const byPath = new Map<string, number[]>();
  const metaOf = new Map<string, WriteMeta[]>();
  for (const w of writes)
    if (typeof w.v === "number") {
      byPath.set(w.path, [...(byPath.get(w.path) ?? []), w.v]);
      metaOf.set(w.path, [
        ...(metaOf.get(w.path) ?? []),
        { xi: w.xi, bound: boundOf(top, w, opts.ops) },
      ]);
    }
  const match = (p: string, vs: readonly number[]) =>
    matchChain(steps, vs, {
      ...(stepAt ? { stepAt } : {}),
      writes: metaOf.get(p) ?? [],
    });
  /** The running total that ends in `v`: the path written most, more than once, whose last write is `v`. */
  const chainFor = (v: number) =>
    [...byPath]
      .filter(
        ([p, vs]) =>
          vs.length > 1 && near(vs.at(-1), v) && match(p, vs) !== null,
      )
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
  /** An expression that holds a value from what the root wrote, at any depth. */
  const holdsRoot = (e: Expr): boolean =>
    fromRoot(e) ||
    (e.t === "op"
      ? holdsRoot(e.l) || holdsRoot(e.r)
      : e.t === "fn"
        ? e.args.some(holdsRoot)
        : e.t === "def"
          ? holdsRoot(e.e)
          : e.t === "not" && holdsRoot(e.a));
  const peeled = last
    ? peelTop(last.e, { own: fromRoot, touches: holdsRoot })
    : null;
  if (peeled?.refused) return out(peeled.refused);
  const layered = !!peeled && peeled.layers.length > 0;
  // a running total under the layer (Anvil Capacity: the chain, then a floor; the Multi-Ore: the chain, then a cap)
  const v = peeled?.rest.v;
  const onTotal =
    layered && (peeled.rest.t === "read" || peeled.rest.t === "val");
  const under = onTotal && typeof v === "number" ? chainFor(v) : null;
  let acc = chainFor(final);
  // a layer over an expression, with a chain whose last write is the same value: either could be the root, unless the
  // chain's last write is that very step (Legend talent max LV: the chain, its last write floored)
  if (layered && !onTotal && acc) {
    const m = match(acc[0], acc[1]);
    if (!m || !("writes" in m) || m.writes.at(-1)?.step !== i)
      return out("a corrente e o último passo dão o mesmo valor");
  }
  // the peeled step only with a chain under its layer, or with no chain for the final value: a running total whose
  // last write has a layer over the total and nothing under it goes to the chain, whose step carries the layer
  // (answer-key-chain.ts)
  const at = last && (under || !acc) ? { e: last.e, step: i } : null;
  let rest: Expr | null = null;
  if (at && peeled) {
    for (const layer of peeled.layers) layer.step = at.step;
    layers.push(...peeled.layers);
    rest = peeled.rest;
    if (layered) acc = under;
    if (under && typeof v === "number") target = v;
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

  // 2. A chain (answer-key-chain.ts): the layers its steps carry, and their limits, go to the root's layers.
  const stepLimits: { limits: Map<TopLayer, Expr>; step: number }[] = [];
  const chainDivisors: { e: Expr; step: number }[] = [];
  const chain = {
    ...(stepAt ? { stepAt } : {}),
    divisors: chainDivisors,
    steps,
    reader: r,
    termsOf,
    kept,
    fromRoot,
    touches: holdsRoot,
    layers,
    stepLimits,
  };

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
    // a factor of a divisor, or a limit: a line with its sources and constants, as a pool of its own kind
    const lineOf = (f: Part, step: number): AnswerPool => {
      const kind = kindOf(f.e, f.seen) === "additive" ? "additive" : "multi";
      const terms = kept(termsOf([f], kind), null);
      const value = Number(f.e.v);
      const parts =
        kind === "additive"
          ? terms.reduce((s, t) => s + t.value * t.weight, 0)
          : terms.reduce((s, t) => s * t.value, 1);
      const error = relDiff(parts, value);
      return { kind, value, after: value, steps: [step], error, terms };
    };
    for (const { limits, step } of stepLimits)
      for (const [layer, e] of limits)
        layer.limit = lineOf({ e, w: 1, seen: new Set([step]) }, step);
    // the divisor of a chain's first write (answer-key-chain.ts)
    const fromChain = chainDivisors.flatMap((d) =>
      operands(d.e, "multi", 1, new Set([d.step])).map((f) =>
        lineOf(f, d.step),
      ),
    );
    if (!at || !peeled) return fromChain;
    const seen = new Set([at.step]);
    for (const [layer, e] of peeled.limits)
      layer.limit = lineOf({ e, w: 1, seen }, at.step);
    return [
      ...fromChain,
      ...peeled.divisors.flatMap((b) =>
        operands(b, "multi", 1, seen).map((f) => lineOf(f, at.step)),
      ),
    ];
  }

  let raw: RawPool[];
  let divisors: AnswerPool[];
  try {
    raw = acc
      ? chainPools(chain, acc[1], metaOf.get(acc[0]))
      : expressionPools();
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

/**
 * A write that cuts the total to a constant under a test (T162; spec, Open Questions 22/11): the last step the call
 * recorded before it is a comparison that held, between a number of the code equal to the written value and the
 * total. `K < x` or `x > K` cuts it down (a Cap); `K > x` or `x < K` raises it (a Floor). Read in memory only.
 */
function boundOf(
  top: RecNode,
  w: RecWrite,
  ops: readonly Op[] | undefined,
): Bound | null {
  const last = top.x?.[w.xi - 1];
  const op = last && ops?.[last[0]];
  if (!op || op.kind !== "cmp" || last[1] !== true) return null;
  const num = (side: unknown): number | null => {
    const n = side as { type?: unknown; value?: unknown } | undefined;
    return n?.type === "Literal" && typeof n.value === "number"
      ? n.value
      : null;
  };
  const l = num(op.node.left);
  const r = num(op.node.right);
  const k = l ?? r;
  if (k === null || (l !== null && r !== null) || !near(k, w.v)) return null;
  const o = op.node.operator;
  const above =
    o === "<" || o === "<="
      ? l !== null
      : o === ">" || o === ">="
        ? r !== null
        : null;
  if (above === null) return null;
  return { kind: above ? "cap" : "floor-min", value: k };
}
