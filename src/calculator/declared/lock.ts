// The lock (spec 010, FR-010, FR-013a, FR-002a, research R10; the prototype's trava.ts): a blueprint checked against the
// answer key of its recording. The pools' order, every source of the answer key in the blueprint (tied by pool,
// reference and occurrence, a constant by its value), the groups and the sources in the game's order, each pool closing
// with its recorded value and the pools giving the final; below each source, lock-levels.ts. A refusal says why, with
// its place and the two values; the result keeps no calculation, only levels, kinds and values.
import type { Op } from "../instrument.ts";
import type { Recording } from "../recording.ts";
import { makeSteps } from "../recorded/steps.ts";
import { relDiff } from "./answer-key-pool.ts";
import type { AnswerKey, AnswerTerm, PoolKind } from "./answer-key.ts";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import {
  checkCondition,
  emptyOut,
  lockSource,
  TOLERANCE,
} from "./lock-levels.ts";
import type { LevelContext, LevelOut } from "./lock-levels.ts";
import { matchRead, nodeId, refKey } from "./refs.ts";

export type LockErrorKind =
  | "poolOrder"
  | "missingSource"
  | "extraSource"
  | "groupOrder"
  | "sourceOrder"
  | "notClosing"
  | "undeclaredPart"
  | "childOutside"
  | "childNoValue"
  | "conditionMismatch"
  | "leafType"
  | "leafHasChildren"
  | "pending"
  | "classMismatch"
  | "rootForm";

export interface LockError {
  kind: LockErrorKind;
  /** The node's id (refs.ts, nodeId), `pool:<n>` (n from 0), `root`, or the place a pending entry names. */
  where: string;
  /** In a pool's error, the pool's kind (the text says "pool 1 Additive"). */
  pool?: PoolKind;
  /** The game's side: the recorded value, the order, the missing reference, a class list, the condition's state. */
  expected?: number | string;
  /**
   * The blueprint's side: what the parts give, its order, its reference, the character's class, the condition's value,
   * a leaf's first child.
   */
  got?: number | string;
}

export interface LockResult {
  /** In the check mode, true with no error. */
  ok: boolean;
  errors: LockError[];
  counts: {
    /** Levels closed by their remounted count (root, pools, nodes with children). */
    closed: number;
    /** Levels closed through a curve's recorded value, its arguments not tied one to one (research R6). */
    closedByRecorded: number;
    leaves: number;
    /** Nodes with children. */
    branches: number;
  };
}

export interface LockInput {
  blueprint: Blueprint;
  key: AnswerKey;
  rec: Recording;
  ops: readonly Op[];
  /** The tree's character: its place in the game's list. */
  character: number;
  /** Its class id; null when the snapshot does not say. */
  characterClass: number | null;
}

const NAME: Record<PoolKind, string> = { additive: "Additive", multi: "Multi" };
const fmt = (v: number | string | undefined): string =>
  typeof v === "number" ? String(+v.toPrecision(10)) : (v ?? "");

/** The refusal's text, from its fields (data-model.md, "Resultado da trava"). */
export function lockMessage(e: LockError): string {
  const level = e.where.startsWith("pool:")
    ? `pool ${String(Number(e.where.slice(5)) + 1)} ${NAME[e.pool ?? "additive"]}`
    : e.where === "root"
      ? "raiz"
      : e.where;
  switch (e.kind) {
    case "poolOrder":
      return `ordem dos pools errada: a ordem esperada é ${fmt(e.expected)}; a receita tem ${fmt(e.got)}`;
    case "missingSource":
      return `fonte que falta: ${fmt(e.expected)} (${level})`;
    case "extraSource":
      return `fonte a mais na receita (não está no gabarito): ${level} (${fmt(e.got)})`;
    case "groupOrder":
      return `ordem dos grupos do ${level}: a ordem esperada é ${fmt(e.expected)}; a receita tem ${fmt(e.got)}`;
    case "sourceOrder":
      return `ordem das fontes: ${level} vem depois de uma fonte que o jogo soma depois dela`;
    case "notClosing":
      return `nível não fecha: ${level}: ${e.got === undefined ? "as partes não dão número" : `as partes dão ${fmt(e.got)}`}, o valor gravado é ${fmt(e.expected)}`;
    case "undeclaredPart":
      return `parte não declarada: ${level}: ${fmt(e.got)}`;
    case "childOutside":
      return `filho fora da conta: ${level}`;
    case "childNoValue":
      return `filho sem valor na gravação: ${level}`;
    case "conditionMismatch":
      return `condição não confere: ${level}: o jogo ${e.expected === "on" ? "usou" : "não usou"} o termo, e a condição ${e.got === undefined ? "não está na gravação" : `vale ${fmt(e.got)}`}`;
    case "leafType":
      return `folha sem tipo: ${level}`;
    case "leafHasChildren":
      return `folha com filhos na gravação: ${level}: o primeiro é ${fmt(e.got)}`;
    case "pending":
      return `receita com pendência: ${level} (${fmt(e.got)})`;
    case "classMismatch":
      return `fonte de outra classe na gravação: ${level} (classes ${fmt(e.expected)}; o personagem é da classe ${fmt(e.got)})`;
    case "rootForm":
      return fmt(e.got);
  }
}

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

/** The check mode (research R10): a failure refuses the blueprint. The runtime mode comes with the closing alert (R16). */
export function lockBlueprint(input: LockInput): LockResult {
  const { blueprint: bp, key, rec, ops, character, characterClass } = input;
  const out = emptyOut();
  const done = (): LockResult => ({ ok: out.errors.length === 0, ...out });
  if (bp.pending?.length) {
    for (const p of bp.pending)
      out.errors.push({ kind: "pending", where: p.where, got: p.kind });
    return done();
  }
  const order = (ks: readonly PoolKind[]) => ks.map((k) => NAME[k]).join(" → ");
  const expected = order(key.pools.map((p) => p.kind));
  const got = order(bp.pools.map((p) => p.kind));
  if (expected !== got) {
    out.errors.push({ kind: "poolOrder", where: "root", expected, got });
    return done();
  }
  const top = rec.nodes[rec.nodes[rec.root ?? -1]?.c[0] ?? -1];
  if (!top) {
    out.errors.push({
      kind: "rootForm",
      where: "root",
      got: "a gravação não tem raiz",
    });
    return done();
  }
  const made = makeSteps(rec, ops);
  const ctx: LevelContext = {
    rec,
    stepsOf: (id) => made.of(id),
    character,
    where: bp.id,
  };

  bp.pools.forEach((pool, i) => {
    const kp = key.pools[i];
    if (!kp) return;
    const where = `pool:${String(i)}`;
    // each term's place by its key and its occurrence in the pool (the same call may come twice)
    const at = new Map<string, number>();
    const seen = new Map<string, number>();
    kp.terms.forEach((t, j) => {
      const n = (seen.get(termKey(t)) ?? 0) + 1;
      seen.set(termKey(t), n);
      at.set(`${termKey(t)}#${String(n)}`, j);
    });
    const used = new Set<number>();
    const seenB = new Map<string, number>();
    const firsts: { system: string; first: number }[] = [];
    let parts = pool.kind === "additive" ? 0 : 1;
    for (const g of pool.groups) {
      let last = -1;
      let first = Infinity;
      for (const s of g.sources) {
        const k = sourceKey(s, kp.terms, character);
        const n = (seenB.get(k) ?? 0) + 1;
        seenB.set(k, n);
        const j = at.get(`${k}#${String(n)}`);
        const t = kp.terms[j ?? -1];
        const sctx = { ...ctx, where: nodeId(bp.id, i, g.system, [s.key]) };
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

  // the root: the chain of pools gives the final, when no layer stands above them (a top layer is no blueprint field)
  if (key.top.length === 0 && key.divisors.length === 0) {
    const [first, ...rest] = key.pools;
    const total = rest.reduce(
      (acc, p) => (p.kind === "additive" ? acc + p.value : acc * p.value),
      first?.value ?? Number.NaN,
    );
    closes(out, "root", total, key.final);
  }
  return done();
}
