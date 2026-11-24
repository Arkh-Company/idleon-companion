// The lock (spec 010, FR-010, FR-013a, FR-002a, research R10; the prototype's trava.ts): a blueprint checked against the
// answer key of its recording. The pools' order, every source of the answer key in the blueprint (tied by pool,
// reference and occurrence, a constant by its value), the groups and the sources in the game's order, each pool closing
// with its recorded value and the pools giving the final (lock-pools.ts); below each source, lock-levels.ts. A refusal
// says why, with its place and the two values; the result keeps no calculation, only levels, kinds and values.
import type { Op } from "../instrument.ts";
import type { Recording } from "../recording.ts";
import { makeSteps } from "../recorded/steps.ts";
import { topOf } from "./answer-key.ts";
import { ambiguousCall } from "./answer-key-turn.ts";
import type { AnswerKey, PoolKind } from "./answer-key.ts";
import type { Blueprint } from "./blueprint.ts";
import { emptyOut } from "./lock-levels.ts";
import type { LevelContext } from "./lock-levels.ts";
import { pendingCover, pendingIds } from "./lock-pending.ts";
import { lockPools, POOL_NAME } from "./lock-pools.ts";

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
  | "rootForm"
  | "openingRefused"
  | "characterWritten"
  | "saveWritten";

export interface LockError {
  kind: LockErrorKind;
  /** The node's id (refs.ts, nodeId), `pool:<n>` (n from 0), `root`, or the place a pending entry names. */
  where: string;
  /** In a pool's error, the pool's kind (the text says "pool 1 Additive"). */
  pool?: PoolKind;
  /**
   * The game's side: the recorded value, the order, the missing reference, a class list, the condition's state; in a
   * childNoValue of a piece, the first of two values the place recorded (`got`, the other).
   */
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
  /** Each place that closed or is a typed leaf, out of the pending ones (lock-levels.ts LevelOut). */
  closedAt: string[];
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

/** A value in a text: a number to 10 significant digits, nothing for none. */
export const fmt = (v: unknown): string =>
  typeof v === "number"
    ? String(+v.toPrecision(10))
    : typeof v === "string"
      ? v
      : v === undefined
        ? ""
        : JSON.stringify(v);

/** The refusal's text, from its fields (data-model.md, "Resultado da trava"). */
export function lockMessage(e: LockError): string {
  // a pool of the root, `pool:<n>`, or of a piece with the form of a recipe, `<line>/pool:<n>`
  const pool = /^(?:(.*)\/)?pool:(\d+)$/.exec(e.where);
  const level = pool
    ? `${pool[1] === undefined ? "" : `${pool[1]} `}pool ${String(Number(pool[2]) + 1)} ${POOL_NAME[e.pool ?? "additive"]}`
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
      return `filho sem valor na gravação: ${level}${e.expected === undefined ? "" : `: a gravação tem ${fmt(e.expected)} e ${fmt(e.got)}`}`;
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
      return e.where === "root" ? fmt(e.got) : `${level}: ${fmt(e.got)}`;
    case "openingRefused":
      return `${level}: ${fmt(e.got)}`;
    case "characterWritten":
      return `índice do personagem por extenso: ${level}: ${fmt(e.got)} vem do personagem; a receita escreve "{character}"`;
    case "saveWritten":
      return `argumento do save por extenso: ${level}: ${fmt(e.got)} vem do save; a receita escreve "*"`;
  }
}

/**
 * The places of a checked blueprint (T199 r1, `summary.txt`): each that closed once (over every class's round), out of
 * the places with a failure and the pending ones; each place with a failure; each pending place.
 */
export function lockTally(r: LockResult): {
  passed: number;
  failed: number;
  pending: number;
} {
  const failed = new Set(
    r.errors.filter((e) => e.kind !== "pending").map((e) => e.where),
  );
  return {
    passed: new Set(r.closedAt.filter((w) => !failed.has(w))).size,
    failed: failed.size,
    pending: r.errors.filter((e) => e.kind === "pending").length,
  };
}

/** The check mode (research R10): a failure refuses the blueprint. The runtime mode comes with the closing alert (R16). */
export function lockBlueprint(input: LockInput): LockResult {
  const { blueprint: bp, key, rec, ops, character, characterClass } = input;
  const out = emptyOut();
  // a draft is checked where it is closed (T199): what its pending places lack is no failure, each place is pending
  const covered = pendingCover(bp, character);
  const waits = pendingIds(bp);
  const done = (): LockResult => {
    out.errors = out.errors.filter((e) => !covered(e));
    out.closedAt = out.closedAt.filter((w) => !waits.has(w));
    for (const p of bp.pending ?? [])
      out.errors.push({ kind: "pending", where: p.where, got: p.kind });
    return { ok: out.errors.length === 0, ...out };
  };
  const top = topOf(rec);
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
    turnOf: made.turnOf,
    character,
    where: bp.id,
    ops,
    characterClass,
  };

  lockPools(bp.pools, key, top, ctx, out);
  // a step's call no place decides, in any level the lock read (returnOf, transparentValue, the openings: T177 r2)
  const twice = ambiguousCall(made.ambiguous);
  if (twice !== null)
    out.errors.push({ kind: "rootForm", where: "root", got: twice });
  return done();
}
