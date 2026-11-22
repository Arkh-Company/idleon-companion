// The chain form of the answer key (spec 010, FR-002c, research R1; T148, T158): how each write of a running total
// maps to the root's steps, and the pools the writes make. A write is the step that gave its value; or, with no such
// step, `path *= x` or `path += x` in place, when the next step's value times or plus the total gives it (both is
// ambiguous and refused); or a turn of a loop (the 0 of its start, an earlier turn), never the last write. A step may
// carry a layer (a max, a floor…): the layer is a line of the root, and a step that only caps the total makes no pool.
import type { Expr, Step } from "../recorded/steps.ts";
import { KIND, near, OutOfRule } from "./answer-key-terms.ts";
import type {
  AnswerTerm,
  Part,
  PoolKind,
  RawPool,
  RawTerm,
  termReader,
} from "./answer-key-terms.ts";
import { peelTop } from "./answer-key-top.ts";
import type { TopLayer } from "./answer-key-top.ts";

export interface ChainWrite {
  value: number;
  /** The step that gave the write, or its operand in place; null for a loop's turn. */
  step: number | null;
  /** `path *= x` (multi) or `path += x` (additive) in place, or null. */
  compound: PoolKind | null;
}

/** The writes of a running total matched to the steps, in order; null when the last write has no step. */
export function matchChain(
  steps: readonly Step[],
  values: readonly number[],
): { writes: ChainWrite[] } | { refused: string } | null {
  const writes: ChainWrite[] = [];
  let from = 0;
  let before: number | null = null;
  for (const [n, w] of values.entries()) {
    const i = steps.findIndex((s, j) => j >= from && near(s.v, w));
    const pv = before;
    // in place only over a total that is not 0 (0 × anything is 0); a write equal to the total is in place only when
    // no step gives it (`path *= 1`, the factor of a locked bonus)
    const inPlace = pv !== null && pv !== 0 && (i < 0 || !near(w, pv));
    const times = inPlace
      ? steps.findIndex((s, j) => j >= from && j !== i && near(pv * s.v, w))
      : -1;
    const plus = inPlace
      ? steps.findIndex((s, j) => j >= from && j !== i && near(pv + s.v, w))
      : -1;
    // a step that gives the write and another that gives it in place: ambiguous, whichever comes first
    if (i >= 0 && (times >= 0 || plus >= 0))
      return {
        refused: `a escrita ${String(w)} do acumulador casa com um passo e com outro no lugar`,
      };
    if (i < 0 && times >= 0 && plus >= 0)
      return {
        refused: `a escrita ${String(w)} do acumulador soma e multiplica ao mesmo tempo`,
      };
    const at = i >= 0 ? i : times >= 0 ? times : plus;
    if (at < 0 && n === values.length - 1) return null;
    const compound =
      i >= 0 ? null : times >= 0 ? "multi" : plus >= 0 ? "additive" : null;
    writes.push({ value: w, step: at < 0 ? null : at, compound });
    if (at >= 0) from = at + 1;
    before = w;
  }
  return { writes };
}

export interface ChainContext {
  steps: readonly Step[];
  reader: ReturnType<typeof termReader>;
  termsOf: (parts: readonly Part[], kind: PoolKind) => RawTerm[];
  kept: (terms: RawTerm[], prev: number | null) => AnswerTerm[];
  /** A value that comes from what the root wrote (answer-key.ts)… */
  fromRoot: (e: Expr) => boolean;
  /** …and an expression that holds one, at any depth. */
  touches: (e: Expr) => boolean;
  /** Where the steps' layers go, in the chain's order, and their limits to build. */
  layers: TopLayer[];
  stepLimits: { limits: Map<TopLayer, Expr>; step: number }[];
}

/** The pools of a chain: each write's step adds to or multiplies the running total it had just before. */
export function chainPools(
  c: ChainContext,
  values: readonly number[],
): RawPool[] {
  const r = c.reader;
  const m = matchChain(c.steps, values);
  if (!m)
    throw new OutOfRule("nenhum passo deu a última escrita do acumulador");
  if ("refused" in m) throw new OutOfRule(m.refused);
  const raw: RawPool[] = [];
  let before: number | null = null;
  for (const w of m.writes) {
    const s = w.step === null ? undefined : c.steps[w.step];
    if (!s || w.step === null) {
      r.bump("loopWrite");
      before = w.value;
      continue;
    }
    r.usedSteps.add(w.step);
    const opened = new Set([w.step]);
    const prev = raw.length > 0 ? before : null;
    if (w.compound) {
      // `path *= x` or `path += x` in place: the step is the operand, with no running total in it
      r.bump("compoundWrite");
      const terms = c.termsOf([{ e: s.e, w: 1, seen: opened }], w.compound);
      raw.push({
        kind: w.compound,
        terms: c.kept(terms, prev),
        step: w.step,
        after: w.value,
      });
      before = w.value;
      continue;
    }
    const peeled = peelTop(s.e, {
      own: c.fromRoot,
      touches: c.touches,
      noDivision: true,
    });
    if (peeled.refused) throw new OutOfRule(peeled.refused);
    for (const layer of peeled.layers) layer.step = w.step;
    c.layers.push(...peeled.layers);
    c.stepLimits.push({ limits: peeled.limits, step: w.step });
    const body = peeled.rest;
    const u = r.unwrap(body, [], true, new Set(opened));
    // a step that only caps or rounds the running total: its layer, and no pool; the stretch before it ends there
    if (
      peeled.layers.length > 0 &&
      before !== null &&
      (u.t === "val" || u.t === "read") &&
      near(u.v, before)
    ) {
      const last = raw.at(-1);
      if (last) last.next = w.value;
      before = w.value;
      continue;
    }
    const kind = u.t === "op" ? KIND[u.o] : undefined;
    if (!kind || (u.t === "op" && u.o === "-"))
      throw new OutOfRule(`o passo ${String(w.step)} não soma nem multiplica`);
    const terms = c.termsOf([{ e: body, w: 1, seen: opened }], kind);
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
      throw new OutOfRule(`o passo ${String(w.step)} troca o acumulador`);
    raw.push({
      kind,
      terms: c.kept(terms, prev),
      step: w.step,
      after:
        peeled.layers.length > 0 && typeof body.v === "number"
          ? body.v
          : w.value,
      // the total after the step's layer, where the next stretch starts
      ...(peeled.layers.length > 0 ? { next: w.value } : {}),
    });
    before = w.value;
  }
  return raw;
}
