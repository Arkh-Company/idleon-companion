// The levels that open by the recording rather than by their own expression (spec 010, spec, Open Questions 23/11): a
// read of a cache built before the root opens into the block that wrote it (T166, cache-author.ts), and a sum of a list
// in a loop into its turns (T167, loop-turns.ts). The lock and the draft read the same opening: each child is one of
// its parts, and the level closes by their sum.
import type { RecNode } from "../recording.ts";
import type { Expr } from "../recorded/steps.ts";
import { callRef } from "./answer-key-pool.ts";
import { cacheAuthor, isCacheRead, writeExpr } from "./cache-author.ts";
import type { LevelContext } from "./lock-levels.ts";
import { loopOpening } from "./loop-turns.ts";
import { returnOf } from "./lock-parts.ts";

/** A part of an opened level: its reference key, its recorded call (null for a read) with its expression, its value. */
export interface Opening {
  part: string;
  call: RecNode | null;
  /** The expression that gave the value, when it is not what the call returned (a cache's write). */
  expr?: Expr | null;
  value: number | null;
}
export interface Opened {
  below: Opening[];
}

/** The opening of a level, its refusal's reason, or null when the level opens by its own expression. */
export function openingOf(
  level: { expr: Expr | null; scope: RecNode; value: number | null },
  ctx: LevelContext,
): Opened | string | null {
  const { expr, scope, value } = level;
  if (expr?.t !== "read" || !isCacheRead(expr.p))
    return loopOpening(expr, scope, ctx);
  const a = cacheAuthor(ctx.rec, expr.p, scope, value ?? undefined);
  if (a === null) return null;
  if ("refused" in a) return a.refused;
  const v = a.write.v;
  return {
    below: [
      {
        part: callRef(a.node),
        call: a.node,
        expr: writeExpr(ctx.rec, a, ctx.turnOf),
        value: typeof v === "number" ? v : null,
      },
    ],
  };
}

/** The level a part of an opened level opens into: its expression, or what its call returned, or the read itself. */
export const levelOfOpening = (
  o: Opening,
  scope: RecNode,
  ctx: LevelContext,
): { expr: Expr | null; scope: RecNode; value: number | null } =>
  o.call
    ? {
        expr: o.expr === undefined ? returnOf(o.call, ctx) : o.expr,
        scope: o.call,
        value: o.value,
      }
    : { expr: { t: "read", p: o.part, v: o.value }, scope, value: o.value };
