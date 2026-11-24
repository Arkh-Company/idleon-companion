// The parts of a level (spec 010, FR-010, research R6; moved out of lock-levels.ts as it was): its expression's
// references, and with a curve or a log in it what builds their arguments. A pass-through variable (T188; the game's
// PostOfficeINFO and its DNSM.PostOffInfoDN1) is no part: a DNSM path the call read after its own write, at the read's
// place. The tree goes down through what gave that write in the call's turn (cache-author.ts writeSource: its step, or
// the bare read or the call right before it), and on through its own passages; never back to the call itself.
// The cache whose write the level came from stays: an author's read of its own earlier turn goes a turn at a time (T168).
import type { RecNode, RecWrite } from "../recording.ts";
import type { BlockSteps, Expr, LoopTurn } from "../recorded/steps.ts";
import { astPattern, matchPattern } from "../recorded/ast.ts";
import { callRef } from "./answer-key-pool.ts";
import {
  isCacheRead,
  seenSeqs,
  writeRange,
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
): { e: Expr; steps: BlockSteps; range: LoopTurn } | null {
  const a = { node: scope, write: w };
  const steps = writeTurn(ctx.rec, a, ctx.turnOf);
  const e = writeSource(ctx.rec, a, ctx.turnOf, steps);
  // a refused source is none here: the pass-through gives no part (the opening of its read gives the reason)
  return e && typeof e !== "string"
    ? { e, steps, range: writeRange(ctx.rec, a) }
    : null;
}

/**
 * The leaves, each pass-through variable among them swapped for the leaves of what gave its write, down; each write's
 * turn it went through goes to `turns`, with its steps.
 */
function passThrough(
  leaves: readonly Expr[],
  scope: RecNode,
  steps: BlockSteps,
  ctx: LevelContext,
  sum: string | undefined,
  turns: { range: LoopTurn; steps: BlockSteps }[] = [],
): Expr[] {
  return leaves.flatMap((l) => {
    // a loose value of the call's own variable (T209, form 5) is its read at that place
    const path = l.t === "read" ? l.p : l.t === "val" ? l.own : undefined;
    const w = path ? ownWrite(scope, path, steps, ctx, sum, l) : null;
    if (!w) return [l];
    const src = writeOf(scope, w, ctx);
    if (src) turns.push(src);
    return src
      ? passThrough(leavesOf(src.e), scope, src.steps, ctx, sum, turns)
      : [];
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
  const turns: { range: LoopTurn; steps: BlockSteps }[] = [];
  const keys = (es: readonly Expr[]) =>
    passThrough(es, scope, steps, ctx, level.write?.path, turns).flatMap(
      (e) => keyOfLeaf(e, ctx.rec) ?? [],
    );
  const own = keys(leaves);
  const feeds = (k: string) => {
    const role = notLeafOf(k, ctx.character)?.role;
    return role === "curve" || role === "log";
  };
  const fed = own.some(feeds);
  // a curve of the level's own count is fed by the whole call; one only past a write, by that write's turn
  const curveHere = leaves.some((l) => {
    const k = keyOfLeaf(l, ctx.rec);
    return k !== null && feeds(k);
  });
  if (curveHere) turns.length = 0;
  if (!fed && !literal(level.expr))
    return [...new Set(own)].filter((k) => !transparent(k));
  // past a write, a curve's parts are its turn's (as T168's turns); else the call's
  const inTurn = (i: number) =>
    turns.length === 0 ||
    turns.some(({ range }) => i >= range.from && i <= range.to);
  const all = ctx.stepsOf(scope.id);
  const others = (turns.length ? turns.map((t) => t.steps) : [all]).flatMap(
    (b) => b.steps.flatMap((s) => (s.e === level.expr ? [] : leavesOf(s.e))),
  );
  // a check of the code (a length, a contains) among the call's reads is never a part (FR-018 of 009: the ⓘ's text)
  const used = new Set(
    [...leaves, ...others].flatMap((l) => (l.t === "read" ? [l.p] : [])),
  );
  // what a comparison or a branch's test of the call read (each op once)
  const testOps = new Set(
    (scope.x ?? []).flatMap(([id]) =>
      ["cmp", "test"].includes(ctx.ops?.[id]?.kind ?? "") ? [id] : [],
    ),
  );
  // the paths the code names in those: a test's read in any turn, never by its value
  const testPats = (ctx.ops ?? []).flatMap((o) =>
    o.kind === "leaf" && o.parent !== undefined && testOps.has(o.parent)
      ? (astPattern(o.node) ?? [])
      : [],
  );
  const tested = (p: string) => testPats.some((t) => matchPattern(p, t));
  // a branch's test only in a loop's turn routes the loop (past a write); out of a loop it is the value's condition
  const check = (p: string) =>
    p.endsWith(".length") ||
    p.includes(" contains ") ||
    (turns.length > 0 && tested(p) && !used.has(p));
  const seen = turns.length
    ? (scope.rx ?? []).flatMap(([p, v, xi]) =>
        inTurn(xi) ? [[p, v] as const] : [],
      )
    : (scope.r ?? []);
  const reads = [
    ...new Set(
      seen.flatMap(([p, v]) =>
        num(v) === null ||
        check(p) ||
        ownWrite(scope, p, steps, ctx, level.write?.path)
          ? []
          : [p],
      ),
    ),
  ];
  const calls = scope.c.flatMap((c) => {
    const n = ctx.rec.nodes[c];
    return n && inTurn(n.pxi) ? [callRef(n)] : [];
  });
  return [...new Set([...own, ...keys(others), ...reads, ...calls])].filter(
    (k) => !transparent(k),
  );
}
