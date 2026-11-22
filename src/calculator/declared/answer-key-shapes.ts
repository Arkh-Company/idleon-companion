// The root shapes of the blueprint beyond one call (spec 010; spec, Open Questions 21 and 22/11; ADR 0010, the
// blueprint never stores a calculation): a sum of calls (Tome Score), each recorded under the root; a part of a call,
// terms of its recorded pool named by reference (a reducer multiplied loose with the cost); and a routine run on the
// recorder's copy, the sum of the state it writes (the Cog Board). All read from the recording only.
import type { Recording } from "../recording.ts";
import type { AnswerKey } from "./answer-key.ts";
import { callRef, outOfRule } from "./answer-key-terms.ts";
import type { AnswerTerm, RootFormError } from "./answer-key-terms.ts";

/** A sum of calls: each call recorded under the root, in order, is a source of one Additive pool. */
export function sumKey(rec: Recording, n: number): AnswerKey | RootFormError {
  const calls = (rec.nodes[rec.root ?? -1]?.c ?? [])
    .slice(0, n)
    .flatMap((id) => rec.nodes[id] ?? []);
  if (calls.length !== n)
    return outOfRule("uma chamada da soma não foi gravada");
  const terms: AnswerTerm[] = [];
  for (const c of calls) {
    if (typeof c.v !== "number")
      return outOfRule(`a chamada ${callRef(c)} da soma não deu número`);
    const ref = callRef(c);
    terms.push({
      kind: "source",
      ref,
      refs: [ref],
      nodes: [c.id],
      value: c.v,
      weight: 1,
      via: [],
    });
  }
  const final = terms.reduce((s, t) => s + t.value, 0);
  return {
    root: `sum of ${String(n)} calls`,
    final,
    form: "sum",
    accumulator: null,
    top: [],
    pools: [
      {
        kind: "additive",
        value: final,
        after: final,
        steps: [],
        error: 0,
        terms,
      },
    ],
    pollution: {},
  };
}

/**
 * A part of a call (T153): the terms of one recorded pool that the blueprint names by reference, each once; the root's
 * value is their product (a Multi pool) or their weighted sum (an Additive pool). A reference that is no term of a
 * pool, or terms in two pools, are refused with the reason.
 */
export function partKey(
  key: AnswerKey,
  refs: readonly string[],
): AnswerKey | RootFormError {
  const taken = new Set<AnswerTerm>();
  const found = refs.map((ref) => {
    for (const [p, pool] of key.pools.entries()) {
      const t = pool.terms.find((x) => x.ref === ref && !taken.has(x));
      if (t) {
        taken.add(t);
        return { p, t };
      }
    }
    return null;
  });
  const missing = refs.filter((_, i) => !found[i]);
  if (missing.length > 0)
    return outOfRule(
      `a parte não é termo de um pool gravado: ${missing.join(", ")}`,
    );
  const pools = new Set(found.map((f) => f?.p));
  const pool = key.pools[found[0]?.p ?? -1];
  if (pools.size !== 1 || !pool)
    return outOfRule("os termos da parte estão em pools diferentes");
  const terms = found.flatMap((f) => (f ? [f.t] : []));
  const value =
    pool.kind === "multi"
      ? terms.reduce((s, t) => s * t.value, 1)
      : terms.reduce((s, t) => s + t.value * t.weight, 0);
  return {
    ...key,
    final: value,
    top: [],
    pools: [
      {
        kind: pool.kind,
        value,
        after: value,
        steps: pool.steps,
        error: 0,
        terms,
      },
    ],
  };
}

/**
 * A routine's root (T152): the routine ran once on the recorder's copy, under its own node; the root is the sum of
 * the state paths it wrote that match `pattern` (`[*]` any index), the last value of each, in the order first written.
 */
export function routineKey(
  rec: Recording,
  pattern: string,
): AnswerKey | RootFormError {
  const routine = rec.nodes.find((n) => n.b === "(routine)");
  if (!routine) return outOfRule("a rotina não rodou");
  const inside = (id: number | null): boolean => {
    for (let n = id; n !== null; n = rec.nodes[n]?.p ?? null)
      if (n === routine.id) return true;
    return false;
  };
  const re = new RegExp(
    `^${pattern
      .split("[*]")
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\[\\d+\\]")}$`,
  );
  const last = new Map<string, number>();
  for (const w of rec.writes)
    if (inside(w.node) && re.test(w.path) && typeof w.v === "number")
      last.set(w.path, w.v);
  if (last.size === 0)
    return outOfRule(`a rotina não escreveu nada em ${pattern}`);
  const terms: AnswerTerm[] = [...last].map(([path, value]) => ({
    kind: "source",
    ref: path,
    refs: [path],
    nodes: [null],
    value,
    weight: 1,
    via: [],
  }));
  const final = terms.reduce((s, t) => s + t.value, 0);
  return {
    root: `routine ${pattern}`,
    final,
    form: "sum",
    accumulator: null,
    top: [],
    pools: [
      {
        kind: "additive",
        value: final,
        after: final,
        steps: [],
        error: 0,
        terms,
      },
    ],
    pollution: {},
  };
}
