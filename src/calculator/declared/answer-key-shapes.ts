// Two root shapes of the blueprint (spec 010; spec, Open Questions 21/11; ADR 0010, the blueprint never stores a
// calculation): a sum of calls (Tome Score), each recorded under the root; and a part of a call, the smallest recorded
// sub-expression of the root's steps that holds the given references (a reducer inside a cost), read from the
// recording only.
import type { Recording } from "../recording.ts";
import type { Expr, Step } from "../recorded/steps.ts";
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
 * The smallest recorded sub-expression of the root's steps (no bare reference) that holds every key of `refs`, with
 * the keys of calls and reads it holds beyond them (`extra`): a part with extra references is not the one the
 * blueprint names.
 */
export function partOf(
  rec: Recording,
  steps: readonly Step[],
  refs: readonly string[],
): { e: Expr; step: number; extra: string[] } | null {
  let best: { e: Expr; step: number; size: number; extra: string[] } | null =
    null;
  steps.forEach((s, step) => {
    const visit = (e: Expr): { keys: Set<string>; size: number } => {
      const keys = new Set<string>();
      let size = 1;
      const add = (x: Expr) => {
        const r = visit(x);
        for (const k of r.keys) keys.add(k);
        size += r.size;
      };
      if (e.t === "call") {
        const n = rec.nodes[e.id];
        if (n) keys.add(callRef(n));
      } else if (e.t === "read") keys.add(e.p);
      else if (e.t === "def") add(e.e);
      else if (e.t === "op") {
        add(e.l);
        add(e.r);
      } else if (e.t === "fn") e.args.forEach(add);
      else if (e.t === "not") add(e.a);
      const whole = e.t !== "call" && e.t !== "read" && typeof e.v === "number";
      if (
        whole &&
        refs.every((k) => keys.has(k)) &&
        (!best || size < best.size)
      )
        best = {
          e,
          step,
          size,
          extra: [...keys].filter((k) => !refs.includes(k)),
        };
      return { keys, size };
    };
    visit(s.e);
  });
  return best;
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
