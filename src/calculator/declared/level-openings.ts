// The levels that open by the recording rather than by their own expression (spec 010, spec, Open Questions 23/11): a
// read of a cache built before the root opens into the block that wrote it (T166, cache-author.ts), a sum of a list in
// a loop into its turns (T167, loop-turns.ts), and the author's write of a cache it summed in turns into those turns
// (T168). The lock and the draft read the same opening: each child is one of its parts, and the level closes by their
// sum.
import type { RecNode, RecWrite } from "../recording.ts";
import type { BlockSteps, Expr } from "../recorded/steps.ts";
import { callRef } from "./answer-key-pool.ts";
import {
  cacheAuthor,
  isCacheRead,
  writeSource,
  writeTurn,
} from "./cache-author.ts";
import type { LevelContext } from "./lock-levels.ts";
import { emptyStart, loopOpening, writeTurns } from "./loop-turns.ts";
import { returnOf } from "./lock-parts.ts";
import { writesAt } from "./own-writes.ts";

/** A part of an opened level: its reference key, its recorded call (null for a read) with its expression, its value. */
export interface Opening {
  part: string;
  call: RecNode | null;
  /** The expression that gave the value, when it is not what the call returned (a cache's write). */
  expr?: Expr | null;
  /** The cache's write the call made, whose turns open it when it wrote the path more than once. */
  write?: RecWrite;
  /** The steps of the call's turn `expr` came from (a cache's write): the places of the reads in it. */
  steps?: BlockSteps;
  value: number | null;
  /** The number of its loop's turn, only on a part another turn has too (T198): the child ties by its key's `-turn-N`. */
  turn?: number;
}

/** The part's label in a level's coverage: with its turn's number when another turn has the same part (T198). */
export const openingLabel = (o: Opening): string =>
  o.turn === undefined ? o.part : `${o.part} (volta ${String(o.turn)})`;

/** The turn's number a child's key names (`-turn-N`, T198), or null. */
export const keyTurn = (key: string): number | null => {
  const m = /-turn-(\d+)$/.exec(key);
  return m ? Number(m[1]) : null;
};

/** The opening of a level, its refusal's reason, or null when the level opens by its own expression. */
export function openingOf(
  level: {
    expr: Expr | null;
    scope: RecNode;
    write?: RecWrite;
    steps?: BlockSteps | undefined;
  },
  ctx: LevelContext,
): Opening[] | string | null {
  const { expr, scope } = level;
  const turns = level.write ? writeTurns(scope, level.write, ctx) : null;
  if (turns !== null) return turns;
  if (expr?.t !== "read" || !isCacheRead(expr.p))
    return loopOpening(expr, scope, ctx);
  // in an author's turn, its own working variable (T212: TalentCalc(-3)'s CalcTalentDN3) is a passage, no cache
  // (level-parts.ts goes down through its write); the path it sums is the author's earlier turn (T168)
  const { write } = level;
  const own = (w: RecWrite) =>
    w.node === scope.id && w.path === expr.p && w.seq < (write?.seq ?? 0);
  if (write && expr.p !== write.path && writesAt(ctx.rec, expr.p).some(own))
    return null;
  // the read is the leaf of its place when the level came from one (lock-levels.ts levelOfChild, draft.ts walkPart),
  // in the steps of the turn its expression came from when it did (an author's write: new objects at each turnOf)
  const steps = level.steps ?? ctx.stepsOf(scope.id);
  const a = cacheAuthor(ctx.rec, expr.p, scope, steps, expr);
  if (a === null) return null;
  if ("refused" in a) return a.refused;
  const v = a.write.v;
  const turn = writeTurn(ctx.rec, a, ctx.turnOf);
  const source = writeSource(ctx.rec, a, ctx.turnOf, turn, ctx.ops);
  if (typeof source === "string") return source;
  // one write onto a key not yet set: the sum starts at the empty key's 0, no part (loop-turns.ts emptyStart)
  const start = emptyStart(a.node, a.write, source, ctx.rec.writes);
  return [
    {
      part: callRef(a.node),
      call: a.node,
      expr: start ?? source,
      write: a.write,
      steps: turn,
      value: typeof v === "number" ? v : null,
    },
  ];
}

/** The level a part of an opened level opens into: its expression, or what its call returned, or the read itself. */
export const levelOfOpening = (
  o: Opening,
  scope: RecNode,
  ctx: LevelContext,
): {
  expr: Expr | null;
  scope: RecNode;
  value: number | null;
  write?: RecWrite;
  steps?: BlockSteps;
} =>
  o.call
    ? {
        expr: o.expr === undefined ? returnOf(o.call, ctx) : o.expr,
        scope: o.call,
        value: o.value,
        ...(o.write ? { write: o.write } : {}),
        ...(o.steps ? { steps: o.steps } : {}),
      }
    : { expr: { t: "read", p: o.part, v: o.value }, scope, value: o.value };
