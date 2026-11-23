// A piece with the form of a recipe in the lock (spec 010, T173; spec, Open Questions 23/11): below the line that calls
// it, its pools (with weights and constants) and the layers above them close by the root's engine, the answer key
// (answer-key.ts) and the pools' lock (lock-pools.ts), their places under the line's. The answer key is the line's
// call's, or the one of the author of the cache the line reads, at the write it read (level-openings.ts), with that
// write's value. A line with neither has no answer key, and is refused with the reason, as a root out of the rule.
import type { RecNode } from "../recording.ts";
import { callRef } from "./answer-key-pool.ts";
import { branchesOf, gateOf } from "./answer-key-top.ts";
import { answerKeyOfSteps } from "./answer-key.ts";
import type { BlueprintNode, BlueprintPool } from "./blueprint.ts";
import { isCacheRead } from "./cache-author.ts";
import { openingOf } from "./level-openings.ts";
import type { Level, LevelContext, LevelOut } from "./lock-levels.ts";
import { lockPools } from "./lock-pools.ts";
import { refKey } from "./refs.ts";

export function lockRecipePiece(
  node: BlueprintNode,
  pools: readonly BlueprintPool[],
  level: Level,
  ctx: LevelContext,
  out: LevelOut,
): void {
  out.counts.branches++;
  const refuse = (got: string) => {
    out.errors.push({ kind: "rootForm", where: ctx.where, got });
  };
  const { ref } = node;
  let call: RecNode | null = null;
  let { value } = level;
  if (ref && "call" in ref) {
    if (callRef(level.scope) === refKey(ref, ctx.character)) call = level.scope;
  } else if (level.expr?.t === "read" && isCacheRead(level.expr.p)) {
    const open = openingOf(level, ctx);
    if (typeof open === "string") {
      refuse(open);
      return;
    }
    const [o] = open ?? [];
    call = o?.call ?? null;
    value = o?.value ?? null;
  }
  if (!call) {
    refuse("o pedaço com pools explica uma chamada ou um cache");
    return;
  }
  if (value === null) {
    refuse("a linha não deu número");
    return;
  }
  const ops = ctx.ops ?? [];
  const steps = ctx.stepsOf(call.id);
  const key = answerKeyOfSteps(ctx.rec, steps, {
    gate: gateOf(call, ops, value),
    branches: branchesOf(call, ops, steps.exprOf),
    node: call.id,
    value,
    ops,
  });
  if ("error" in key) refuse(key.reason);
  else lockPools(pools, key, call, ctx, out, ctx.where);
}
