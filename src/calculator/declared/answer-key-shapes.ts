// The root shapes of the blueprint beyond one call (spec 010; spec, Open Questions 21 and 22/11; ADR 0010, the
// blueprint never stores a calculation): a sum of calls (Tome Score), each recorded under the root; a part of a call,
// terms of its recorded pool named by reference (a reducer multiplied loose with the cost); and a routine run on the
// recorder's copy, the sum of the state it writes (the Cog Board). All read from the recording only.
import type { RecNode, Recording } from "../recording.ts";
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
    divisors: [],
    pollution: {},
  };
}

/**
 * The value of an item of the list the root returns (T159: TotalTalentPoints(…)[tab]): the root's last write to
 * `<path>[item]`; with no such path, or with more than one, the root is refused.
 */
export function itemOf(
  rec: Recording,
  top: RecNode,
  item: number,
): number | RootFormError {
  const last = new Map<string, number>();
  for (const w of rec.writes) {
    const m = /^(.*)\[(\d+)\]$/.exec(w.path);
    if (
      w.node === top.id &&
      m?.[1] &&
      Number(m[2]) === item &&
      typeof w.v === "number"
    )
      last.set(m[1], w.v);
  }
  const [only, ...more] = [...last.values()];
  if (only === undefined)
    return outOfRule(`a raiz não escreveu o item ${String(item)} de uma lista`);
  if (more.length > 0)
    return outOfRule(`o item ${String(item)} está em mais de uma lista`);
  return only;
}

/** Why a part was refused: a reference that is no term (`missing`), or more than one candidate (`ambiguous`). */
export type PartRefusal = RootFormError & { part: "missing" | "ambiguous" };
const refused = (part: PartRefusal["part"], why: string): PartRefusal => ({
  ...outOfRule(why),
  part,
});

/**
 * A part of a call (T153): the terms of one recorded pool that the blueprint names by reference, each once; the root's
 * value is their product (a Multi pool) or their weighted sum (an Additive pool). A reference that is no term of a
 * pool, or terms in two pools, are refused with the reason.
 */
export function partKey(
  key: AnswerKey,
  refs: readonly string[],
): AnswerKey | PartRefusal {
  const all = key.pools.flatMap((pool, p) => pool.terms.map((t) => ({ p, t })));
  // each reference the main reference of one term; a reference in two terms is ambiguous, never taken by order
  const each = refs.map((ref) => all.filter((x) => x.t.ref === ref));
  if (each.some((c) => c.length > 1))
    return refused("ambiguous", "a parte está em mais de um termo");
  const found = each.flat();
  if (found.length === refs.length) {
    const pool = key.pools[found[0]?.p ?? -1];
    if (new Set(found.map((f) => f.p)).size !== 1 || !pool)
      return refused(
        "ambiguous",
        "os termos da parte estão em pools diferentes",
      );
    return partOfPool(
      key,
      pool,
      found.map((f) => f.t),
    );
  }
  // or the one term that holds all the references (a factor (1 + (A + B) / 100))
  const holders = all.filter((x) => refs.every((r) => x.t.refs.includes(r)));
  if (holders.length > 1)
    return refused("ambiguous", "a parte está em mais de um termo");
  const [one] = holders;
  const pool = one && key.pools[one.p];
  if (one && pool) return partOfPool(key, pool, [one.t]);
  const missing = refs.filter((_, i) => each[i]?.length === 0);
  return refused(
    "missing",
    `a parte não é termo de um pool gravado: ${missing.join(", ")}`,
  );
}

/**
 * The part in the running total a call builds in a scratch path that the root only reads (a bubble's cost, T155):
 * each call that wrote a path the root reads, keyed by `keyOf` at the last value it wrote there. A call that holds the
 * part, or where the part is ambiguous, is a candidate: one gives its part or its refusal, none gives null, and more
 * than one is ambiguous and refused.
 */
export function partInWriters(
  rec: Recording,
  top: RecNode,
  refs: readonly string[],
  keyOf: (node: number, value: number) => AnswerKey | RootFormError,
): AnswerKey | RootFormError | null {
  const read = new Set((top.r ?? []).map(([p]) => p));
  const writers = new Map<string, { node: number; value: number }>();
  for (const w of rec.writes)
    if (
      w.node !== null &&
      w.node !== top.id &&
      read.has(w.path) &&
      typeof w.v === "number"
    )
      writers.set(`${String(w.node)} ${w.path}`, { node: w.node, value: w.v });
  const parts = [...writers.values()].flatMap(({ node, value }) => {
    const inner = keyOf(node, value);
    const part = "error" in inner ? inner : partKey(inner, refs);
    const ambiguous = "part" in part && part.part === "ambiguous";
    return "error" in part && !ambiguous ? [] : [part];
  });
  if (parts.length > 1) return outOfRule("a parte vem de mais de uma chamada");
  return parts[0] ?? null;
}

/** The part's key: the terms chosen of one pool, its value their product (Multi) or their weighted sum (Additive). */
function partOfPool(
  key: AnswerKey,
  pool: AnswerKey["pools"][number],
  terms: AnswerTerm[],
): AnswerKey {
  const value =
    pool.kind === "multi"
      ? terms.reduce((s, t) => s * t.value, 1)
      : terms.reduce((s, t) => s + t.value * t.weight, 0);
  return {
    ...key,
    final: value,
    top: [],
    divisors: [],
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
    divisors: [],
    pollution: {},
  };
}
