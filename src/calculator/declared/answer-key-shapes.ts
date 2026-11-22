// The root shapes of the blueprint beyond one call (spec 010; spec, Open Questions 21 and 22/11; ADR 0010, the
// blueprint never stores a calculation): a sum of calls (Tome Score), each recorded under the root; a part of a call,
// terms of its recorded pool named by reference (a reducer multiplied loose with the cost); and a routine run on the
// recorder's copy, the sum of the state it writes (the Cog Board). All read from the recording only.
import { LOG_CAP } from "../recording.ts";
import type { RecNode, Recording } from "../recording.ts";
import type { AnswerKey } from "./answer-key.ts";
import { callRef, near, outOfRule } from "./answer-key-terms.ts";
import type { AnswerTerm, RootFormError } from "./answer-key-terms.ts";
import { starPattern } from "./refs.ts";

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
 * `<path>[item]`, only in the list it returned when the recording has its path (T162: the root's working lists stay
 * out); with no such path, or with more than one, the root is refused.
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
      (top.vp === undefined || m[1] === top.vp) &&
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
 * pool, or terms in two pools, are refused with the reason. The ➗ lines count too (T161, the Mob respawn): there the
 * part is a sum the game divides by 100 as a whole, and its value is in %.
 */
export function partKey(
  key: AnswerKey,
  refs: readonly string[],
): AnswerKey | PartRefusal {
  const lines = [...key.pools, ...key.divisors];
  const all = lines.flatMap((pool, p) => pool.terms.map((t) => ({ p, t })));
  // each reference in one term, as its main reference or inside it (a factor (1 + (A + 40 × B) / 100), T155 and
  // T162); a reference in two terms is ambiguous, never taken by order; terms that hold more than one are one term
  const each = refs.map((ref) => all.filter((x) => x.t.refs.includes(ref)));
  if (each.some((c) => c.length > 1))
    return refused("ambiguous", "a parte está em mais de um termo");
  const missing = refs.filter((_, i) => each[i]?.length === 0);
  if (missing.length > 0)
    return refused(
      "missing",
      `a parte não é termo de um pool gravado: ${missing.join(", ")}`,
    );
  const found = [...new Set(each.flat())];
  const at = found[0]?.p ?? -1;
  const pool = lines[at];
  if (new Set(found.map((f) => f.p)).size !== 1 || !pool)
    return refused("ambiguous", "os termos da parte estão em pools diferentes");
  const terms = found.map((f) => f.t);
  if (at < key.pools.length) return partOfPool(key, pool, terms);
  // a term scaled by a constant (the 0.65 of W7, T163) keeps the constant in its weight
  const scaleOf = (t: AnswerTerm) => t.scale ?? 1;
  if (
    pool.kind !== "additive" ||
    terms.some((t) => !near(Math.abs(t.weight / scaleOf(t)), 0.01))
  )
    return refused("ambiguous", "a parte da linha ➗ não está em %");
  return partOfPool(
    key,
    pool,
    terms.map((t) => ({
      ...t,
      weight: Math.round((t.weight / scaleOf(t)) * 100) * scaleOf(t),
    })),
  );
}

/**
 * The part in a running total that the root reads and that the root itself or a call under it builds (a bubble's cost
 * in a scratch path, T155; the Obol stat multi's second total, T162): each path written there, keyed by `keyOf` at the
 * last value written to it; calls outside the root (the helpers, another root) never count. A path that holds the part,
 * or where the part is ambiguous, is a candidate: one gives its part or its refusal, none gives null, and candidates
 * of more than one call are refused. A write in a turn of a loop is keyed with the steps of its turn (the Seraph, the
 * Mob respawn: the step that gave it was recorded again after it); the same part in each turn, with the same terms
 * and the same value, is one part, and a part that changes from turn to turn is refused (spec, Open Questions 22/11).
 * With a `branch` (T163, a world of the Mob respawn), only the turns whose search of that list found the item count,
 * whatever their order, and none of them is left out: a turn without the part refuses the root.
 */
export function partInWriters(
  rec: Recording,
  top: RecNode,
  refs: readonly string[],
  keyOf: (
    node: number,
    value: number,
    turn?: { from: number; to: number },
  ) => AnswerKey | RootFormError,
  branch?: string,
): AnswerKey | RootFormError | null {
  // the log too: the first reads stop at the recorder's cap
  const read = new Set([
    ...(top.r ?? []).map(([p]) => p),
    ...(top.rx ?? []).map(([p]) => p),
  ]);
  const under = (id: number | null): boolean => {
    for (let n = id; n !== null; n = rec.nodes[n]?.p ?? null)
      if (n === top.id) return true;
    return false;
  };
  const writers = new Map<
    string,
    { node: number; value: number; turn: { from: number; to: number } }
  >();
  // the branch's search that found the item, logged in the turn (the steps run when it searched)
  const found = (node: number, from: number, to: number) =>
    (rec.nodes[node]?.rx ?? []).some(
      ([p, v, at]) =>
        v === true &&
        p.startsWith(`${branch ?? ""} contains `) &&
        at >= from &&
        at <= to,
    );
  // a turn: the steps its call recorded since the call's write before it
  const lastXi = new Map<number, number>();
  for (const w of rec.writes) {
    if (w.node === null || !under(w.node)) continue;
    const from = lastXi.get(w.node) ?? 0;
    lastXi.set(w.node, w.xi);
    if (branch !== undefined) {
      // a log cut at the recorder's cap could leave turns of the branch out
      if ((rec.nodes[w.node]?.rx?.length ?? 0) >= LOG_CAP)
        return outOfRule(
          "o log da chamada chegou ao limite antes das voltas do ramo",
        );
      if (!found(w.node, from, w.xi)) continue;
    }
    if (read.has(w.path) && typeof w.v === "number")
      writers.set(`${String(w.node)} ${w.path}`, {
        node: w.node,
        value: w.v,
        turn: { from, to: w.xi - 1 },
      });
  }
  const partOf = (inner: AnswerKey | RootFormError) =>
    "error" in inner ? inner : partKey(inner, refs);
  const kept = (part: AnswerKey | RootFormError) =>
    !("error" in part) || ("part" in part && part.part === "ambiguous");
  const parts = [...writers.values()].flatMap(({ node, value, turn }) => {
    let part = partOf(keyOf(node, value));
    if (!kept(part)) part = partOf(keyOf(node, value, turn));
    return branch !== undefined || kept(part) ? [{ node, part }] : [];
  });
  const [first, ...rest] = parts;
  if (!first) return null;
  if (new Set(parts.map((p) => p.node)).size > 1)
    return outOfRule("a parte vem de mais de uma chamada");
  if ("error" in first.part) return first.part;
  const sig = (k: AnswerKey) =>
    JSON.stringify(k.pools.map((p) => p.terms.map((t) => [t.refs, t.weight])));
  const one = first.part;
  if (
    rest.some(
      ({ part }) =>
        "error" in part ||
        sig(part) !== sig(one) ||
        !near(part.final, one.final),
    )
  )
    return outOfRule(
      "a parte não tem os mesmos termos e o mesmo valor em todas as voltas do laço",
    );
  return one;
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
  const re = new RegExp(`^${starPattern(pattern)}$`);
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
