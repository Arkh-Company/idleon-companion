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
import type { Opening } from "./level-openings.ts";
import type { Level, LevelContext, LevelOut } from "./lock-levels.ts";
import { lockPools } from "./lock-pools.ts";
import { keyMatches } from "./refs.ts";

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
  let o: Opening | undefined;
  if (ref && "call" in ref) {
    if (keyMatches(ref, callRef(level.scope), ctx.character))
      call = level.scope;
  } else if (level.expr?.t === "read" && isCacheRead(level.expr.p)) {
    const open = openingOf(level, ctx);
    if (typeof open === "string") {
      refuse(open);
      return;
    }
    [o] = open ?? [];
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
  const all = ctx.stepsOf(call.id);
  // the cache's write the line read, at its place: one write is the last step of its turn, more its running total's
  const path = o?.write?.path;
  const id = call.id;
  const one =
    path !== undefined &&
    ctx.rec.writes.filter(
      (w) => w.node === id && w.path === path && typeof w.v === "number",
    ).length === 1;
  const steps = one && o?.steps ? o.steps : all;
  const key = answerKeyOfSteps(ctx.rec, steps, {
    gate: gateOf(call, ops, value),
    branches: branchesOf(call, ops, all.exprOf),
    node: call.id,
    value,
    ops,
    turnOf: ctx.turnOf,
    ...(path !== undefined && { path }),
    ...(steps !== all && { at: o?.expr ?? null }),
  });
  if ("error" in key) refuse(key.reason);
  else {
    // more than one write: the terms of the last are in its own turn (a loop over the cache's keys, the star signs), at
    // the write's place, never in the call's last step of that code
    const turn = !one && o?.steps;
    const at: typeof ctx = turn
      ? { ...ctx, stepsOf: (n) => (n === id ? turn : ctx.stepsOf(n)) }
      : ctx;
    lockPools(pools, key, call, at, out, ctx.where);
  }
}
