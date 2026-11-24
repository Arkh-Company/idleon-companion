// The parts of a level (spec 010, FR-010, research R6; moved out of lock-levels.ts as it was): its expression's
// references, and with a curve or a log in it what builds their arguments. A pass-through variable (T188; the game's
// PostOfficeINFO and its DNSM.PostOffInfoDN1) is no part: a DNSM path the call read after its own write, at the read's
// place. The tree goes down through what gave that write in the call's turn (cache-author.ts writeSource: its step, or
// the bare read or the call right before it), and on through its own passages; never back to the call itself.
// The cache whose write the level came from stays: an author's read of its own earlier turn goes a turn at a time (T168).
import type { RecNode, RecWrite } from "../recording.ts";
import type { BlockSteps, Expr } from "../recorded/steps.ts";
import { callRef } from "./answer-key-pool.ts";
import {
  isCacheRead,
  seenSeqs,
  writeSource,
  writeTurn,
} from "./cache-author.ts";
import type { Level, LevelContext } from "./lock-levels.ts";
import { keyOfLeaf, leavesOf, literal, num } from "./lock-parts.ts";
import { notLeafOf } from "./not-leaves.ts";

/**
 * The call's own write that each read of `path` saw (at `leaf`, when given), or null when one saw another's or none, or
 * `path` is `sum`, the cache whose write the level came from.
 */
function ownWrite(
  scope: RecNode,
  path: string,
  steps: BlockSteps,
  ctx: LevelContext,
  sum: string | undefined,
  leaf?: Expr,
): RecWrite | null {
  // the game's working maps: DNSM and DummyNumbersStatManager (T209, form 5)
  const working =
    isCacheRead(path) || path.startsWith("DummyNumbersStatManager.");
  if (!working || path === sum) return null;
  const writes = [...ctx.rec.writes, ...ctx.rec.spliced]
    .filter((w) => w.path === path)
    .sort((a, b) => a.seq - b.seq);
  const saw = seenSeqs(scope, path, steps, leaf).map((s) =>
    s === undefined ? undefined : writes.findLast((w) => w.seq <= s),
  );
  const last = saw.at(-1);
  return last && saw.every((w) => w?.node === scope.id) ? last : null;
}

/** What gave the call's write `w` (cache-author.ts writeSource), with the steps of its turn. */
function writeOf(
  scope: RecNode,
  w: RecWrite,
  ctx: LevelContext,
): { e: Expr; steps: BlockSteps } | null {
  const a = { node: scope, write: w };
  const steps = writeTurn(ctx.rec, a, ctx.turnOf);
  const e = writeSource(ctx.rec, a, ctx.turnOf, steps);
  // a refused source is none here: the pass-through gives no part (the opening of its read gives the reason)
  return e && typeof e !== "string" ? { e, steps } : null;
}

/** The leaves, each pass-through variable among them swapped for the leaves of what gave its write, down. */
function passThrough(
  leaves: readonly Expr[],
  scope: RecNode,
  steps: BlockSteps,
  ctx: LevelContext,
  sum: string | undefined,
): Expr[] {
  return leaves.flatMap((l) => {
    // a loose value of the call's own variable (T209, form 5) is its read at that place
    const path = l.t === "read" ? l.p : l.t === "val" ? l.own : undefined;
    const w = path ? ownWrite(scope, path, steps, ctx, sum, l) : null;
    if (!w) return [l];
    const src = writeOf(scope, w, ctx);
    return src ? passThrough(leavesOf(src.e), scope, src.steps, ctx, sum) : [];
  });
}

/**
 * The parts of a level: its expression's references; with a curve or a log in it, also what builds their arguments
 * (the level's other steps, its numeric reads and its calls), which are the parent's children (research R6).
 */
export function partsOf(
  level: Level,
  leaves: readonly Expr[],
  ctx: LevelContext,
): string[] {
  const transparent = (k: string) => notLeafOf(k, ctx.character) !== null;
  const { scope } = level;
  const steps = level.steps ?? ctx.stepsOf(scope.id);
  const keys = (es: readonly Expr[]) =>
    passThrough(es, scope, steps, ctx, level.write?.path).flatMap(
      (e) => keyOfLeaf(e, ctx.rec) ?? [],
    );
  const own = keys(leaves);
  const fed = own.some((k) => {
    const role = notLeafOf(k, ctx.character)?.role;
    return role === "curve" || role === "log";
  });
  if (!fed && !literal(level.expr))
    return [...new Set(own)].filter((k) => !transparent(k));
  const others = ctx
    .stepsOf(scope.id)
    .steps.flatMap((s) => (s.e === level.expr ? [] : leavesOf(s.e)));
  const reads = (scope.r ?? []).flatMap(([p, v]) =>
    num(v) === null || ownWrite(scope, p, steps, ctx, level.write?.path)
      ? []
      : [p],
  );
  const calls = scope.c.flatMap((c) => {
    const n = ctx.rec.nodes[c];
    return n ? [callRef(n)] : [];
  });
  return [...new Set([...own, ...keys(others), ...reads, ...calls])].filter(
    (k) => !transparent(k),
  );
}
