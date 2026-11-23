// The pools of a recipe in the lock (spec 010, FR-010, FR-013a, FR-002a; moved out of lock.ts as they were, T173): the
// pools' order, every source of the answer key in the blueprint (tied by pool, reference and occurrence, a constant by
// its value), the groups and the sources in the game's order, each pool closing with its recorded value and the pools
// giving the final when no layer stands above them; below each source, lock-levels.ts. The root's lock reads it, and so
// does a piece with the form of a recipe below its line (lock-piece-recipe.ts), its places under the line's.
import type { RecNode } from "../recording.ts";
import { relDiff } from "./answer-key-pool.ts";
import type { AnswerKey, AnswerTerm, PoolKind } from "./answer-key.ts";
import type {
  BlueprintGroup,
  BlueprintNode,
  BlueprintPool,
} from "./blueprint.ts";
import { checkCondition, lockSource } from "./lock-levels.ts";
import type { LevelContext, LevelOut } from "./lock-levels.ts";
import { TOLERANCE } from "./lock-parts.ts";
import { fill } from "./pieces.ts";
import { eachPattern, matchRead, nodeId, refKey } from "./refs.ts";

export const POOL_NAME: Record<PoolKind, string> = {
  additive: "Additive",
  multi: "Multi",
};

const termKey = (t: AnswerTerm): string =>
  t.kind === "constant" ? `=${String(t.value)}` : t.ref;

/** A source's key in its pool: a constant's value, a call's key, or the one recorded path a `*` read stands for. */
function sourceKey(
  s: BlueprintNode,
  terms: readonly AnswerTerm[],
  character: number,
): string {
  if (s.constant !== undefined) return `=${String(s.constant)}`;
  if (!s.ref) return "";
  if ("call" in s.ref || !s.ref.read.includes("[*]"))
    return refKey(s.ref, character);
  const { read } = s.ref;
  const hits = new Set(
    terms
      .filter(
        (t) =>
          t.kind === "source" && matchRead(read, [t.ref], character) !== null,
      )
      .map((t) => t.ref),
  );
  // none, or more than one recorded path: it ties to nothing, never by order
  return hits.size === 1 ? [...hits].join("") : refKey(s.ref, character);
}

/**
 * A group's sources with their places: a source with `each` and no `combine` (T174) is its model once per term of the
 * pool its `[*]` matches, in the terms' order, the item the term's place in the list; an item in two terms is refused,
 * as the tie would be by order.
 */
function sourcesOf(
  g: BlueprintGroup,
  pool: number,
  terms: readonly AnswerTerm[],
  ctx: LevelContext,
  out: LevelOut,
): { s: BlueprintNode; at: string; term?: number }[] {
  return g.sources.flatMap((s) => {
    const at = nodeId(ctx.where, pool, g.system, [s.key]);
    const [model] = s.children ?? [];
    if (!s.each || s.combine || !model) return [{ s, at }];
    out.counts.branches++;
    const { list, as } = s.each;
    const path = eachPattern(list, ctx.character);
    // a model with no ref is a fixed base of the code (T176): the constants whose guarding test found the item
    const fixed = !model.ref;
    const found = terms.flatMap((t, j) => {
      const item = fixed
        ? t.kind === "constant" && t.item !== undefined
          ? path.exec(t.item)?.[1]
          : undefined
        : t.kind === "source"
          ? path.exec(t.ref)?.[1]
          : undefined;
      return item === undefined ? [] : [{ item, j }];
    });
    const items = found.map((f) => f.item);
    const twice = items.find((x, k) => items.indexOf(x) !== k);
    if (twice !== undefined) {
      out.errors.push({
        kind: "rootForm",
        where: at,
        got: `o item ${twice} de ${list} está em mais de uma parcela do pool: a ligação seria pela ordem`,
      });
      return [];
    }
    return found.map(({ item, j }) => ({
      s: {
        ...fill(model, { [as]: Number(item) }),
        key: `${model.key}-${item}`,
        ...(s.weight !== undefined && { weight: s.weight }),
      },
      at: `${at}/${model.key}-${item}`,
      ...(fixed && { term: j }),
    }));
  });
}

function closes(
  out: LevelOut,
  where: string,
  got: number,
  expected: number,
  pool?: PoolKind,
): void {
  if (relDiff(got, expected) <= TOLERANCE) out.counts.closed++;
  else
    out.errors.push({
      kind: "notClosing",
      where,
      ...(pool ? { pool } : {}),
      expected,
      got,
    });
}

/**
 * The pools against the answer key of `top`, the call whose steps made them; `at` is the root (`root`) or the line a
 * piece explains, whose pools are `<line>/pool:<n>`. The sources' places are under `ctx.where`.
 */
export function lockPools(
  pools: readonly BlueprintPool[],
  key: AnswerKey,
  top: RecNode,
  ctx: LevelContext,
  out: LevelOut,
  at = "root",
): void {
  const { character } = ctx;
  const characterClass = ctx.characterClass ?? null;
  const order = (ks: readonly PoolKind[]) =>
    ks.map((k) => POOL_NAME[k]).join(" → ");
  const expected = order(key.pools.map((p) => p.kind));
  const got = order(pools.map((p) => p.kind));
  if (expected !== got) {
    out.errors.push({ kind: "poolOrder", where: at, expected, got });
    return;
  }
  pools.forEach((pool, i) => {
    const kp = key.pools[i];
    if (!kp) return;
    const where = `${at === "root" ? "" : `${at}/`}pool:${String(i)}`;
    // each term's place by its key and its occurrence in the pool (the same call may come twice)
    const place = new Map<string, number>();
    const seen = new Map<string, number>();
    kp.terms.forEach((t, j) => {
      const n = (seen.get(termKey(t)) ?? 0) + 1;
      seen.set(termKey(t), n);
      place.set(`${termKey(t)}#${String(n)}`, j);
    });
    const used = new Set<number>();
    const seenB = new Map<string, number>();
    const firsts: { system: string; first: number }[] = [];
    let parts = pool.kind === "additive" ? 0 : 1;
    for (const g of pool.groups) {
      let last = -1;
      let first = Infinity;
      for (const { s, at: sourceAt, term } of sourcesOf(
        g,
        i,
        kp.terms,
        ctx,
        out,
      )) {
        const k = sourceKey(s, kp.terms, character);
        const n = (seenB.get(k) ?? 0) + 1;
        seenB.set(k, n);
        // a fixed base comes tied to its term by its item (T176); any other source, by its key and occurrence
        const j = term ?? place.get(`${k}#${String(n)}`);
        const t = kp.terms[j ?? -1];
        const sctx = { ...ctx, where: sourceAt };
        const otherClass =
          s.classes !== undefined &&
          characterClass !== null &&
          !s.classes.includes(characterClass);
        if (j === undefined || !t) {
          // absent: another class's source, or a class source when the snapshot gives no class (FR-002a), or one its
          // condition switched off (research R3)
          if (
            otherClass ||
            (s.classes !== undefined && characterClass === null)
          )
            continue;
          if (s.condition) checkCondition(s, false, top, sctx, out);
          else
            out.errors.push({
              kind: "extraSource",
              where: sctx.where,
              got: k.startsWith("=") ? k.slice(1) : k,
            });
          continue;
        }
        used.add(j);
        if (j < last)
          out.errors.push({ kind: "sourceOrder", where: sctx.where });
        last = Math.max(last, j);
        first = Math.min(first, j);
        // the game calls another class's talent for every character: only a value that is not neutral is a mismatch
        if (otherClass && t.value !== (pool.kind === "additive" ? 0 : 1))
          out.errors.push({
            kind: "classMismatch",
            where: sctx.where,
            expected: s.classes?.join(", ") ?? "",
            got: characterClass,
          });
        parts =
          pool.kind === "additive"
            ? parts + (s.weight ?? pool.weight ?? 1) * t.value
            : parts * t.value;
        lockSource(s, t, top, sctx, out);
      }
      if (first !== Infinity) firsts.push({ system: g.system, first });
    }
    // FR-013a: the groups in the order the game adds or multiplies the first source of each
    const want = firsts
      .toSorted((a, b) => a.first - b.first)
      .map((g) => g.system)
      .join(", ");
    const have = firsts.map((g) => g.system).join(", ");
    if (want !== have)
      out.errors.push({
        kind: "groupOrder",
        where,
        pool: pool.kind,
        expected: want,
        got: have,
      });
    kp.terms.forEach((t, j) => {
      if (!used.has(j))
        out.errors.push({
          kind: "missingSource",
          where,
          pool: pool.kind,
          expected: t.ref,
        });
    });
    closes(out, where, parts, kp.value, pool.kind);
  });

  // the final: the chain of pools gives it, when no layer stands above them (a top layer is no blueprint field)
  if (key.top.length === 0 && key.divisors.length === 0) {
    const [first, ...rest] = key.pools;
    const total = rest.reduce(
      (acc, p) => (p.kind === "additive" ? acc + p.value : acc * p.value),
      first?.value ?? Number.NaN,
    );
    closes(out, at, total, key.final);
  }
}
