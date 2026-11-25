// The recorded value a declared reference stands for in a level, and whether a child covers a part (spec 010, FR-010;
// moved out of lock-levels.ts as it was).
import type { RecNode } from "../recording.ts";
import type { Expr, LoopTurn } from "../recorded/steps.ts";
import { callRef } from "./answer-key-pool.ts";
import type { BlueprintNode } from "./blueprint.ts";
import { textPart } from "./level-parts.ts";
import { onlyRead } from "./cache-author.ts";
import type { Level, LevelContext } from "./lock-levels.ts";
import { keyOfLeaf, num, returnOf } from "./lock-parts.ts";
import { keyMatches, matchRead, savedTwice } from "./refs.ts";

type Ref = NonNullable<BlueprintNode["ref"]>;

/**
 * Whether a call was made in the loop's turn `range` (any, with no range): its place in its caller's step log; in an
 * author's write's turn, by the write it began after (T226: a step's place does not part a call right before a write
 * from one right after it).
 */
export const inTurn = (n: RecNode, range?: LoopTurn): boolean =>
  !range ||
  (range.seq && n.seq !== undefined
    ? n.seq >= range.seq.from && n.seq < range.seq.to
    : n.pxi >= range.from && n.pxi <= range.to);

/** A turn's count line's loop turn (T193), where its children's calls are, as the draft's (draft-walk.ts walkOpening). */
export const lineTurn = (level: Level): LoopTurn | undefined =>
  level.line ? level.steps?.range : undefined;

/** The call `scope` made whose reference is the part `p` (in the turn `range`, when given), or null. */
export const kidOf = (
  scope: RecNode,
  p: string,
  ctx: LevelContext,
  range?: LoopTurn,
): RecNode | null =>
  scope.c
    .map((id) => ctx.rec.nodes[id])
    .find((k) => k !== undefined && callRef(k) === p && inTurn(k, range)) ??
  null;

/**
 * The call a turn's item's reference `p` stands for (T193, research R4), by its place: the item's call leaf of that key,
 * else the call the turn made (what gave a pass-through's write, T188); null for a read.
 */
export function callAt(
  leaves: readonly Expr[],
  p: string,
  scope: RecNode,
  ctx: LevelContext,
  range?: LoopTurn,
): RecNode | null {
  const leaf = leaves.find((l) => keyOfLeaf(l, ctx.rec) === p);
  return leaf?.t === "call"
    ? (ctx.rec.nodes[leaf.id] ?? null)
    : kidOf(scope, p, ctx, range);
}
/** The recorded call a call reference stands for in a level: one of its expression's, or one the level made. */
export function callIn(
  ref: Extract<Ref, { call: string }>,
  scope: RecNode,
  leaves: readonly Expr[],
  ctx: LevelContext,
  /** The parts of the chosen member's turn (T212): its calls only. */
  only?: ReadonlySet<string>,
  /** A count line's loop turn (lineTurn, r1 of part U): the calls the level made in it only, by their place. */
  range?: LoopTurn,
): RecNode | undefined {
  const made = scope.c.filter((id) => {
    const n = ctx.rec.nodes[id];
    return n !== undefined && inTurn(n, range);
  });
  const calls = [
    ...leaves.flatMap((l) => (l.t === "call" ? [l.id] : [])),
    ...made,
  ]
    .flatMap((id) => ctx.rec.nodes[id] ?? [])
    .filter((n) => !only || only.has(callRef(n)));
  // two calls a `*` makes equal tie to none (lockLevel says why)
  if (savedTwice(ref, calls.map(callRef), ctx.character) !== null) return;
  return calls.find((n) => keyMatches(ref, callRef(n), ctx.character));
}

/** The recorded value of a reference in a level: a call it made, or a path it read (`*` takes the first reading). */
export function valueIn(
  ref: Ref,
  scope: RecNode,
  leaves: readonly Expr[],
  ctx: LevelContext,
  only?: ReadonlySet<string>,
  range?: LoopTurn,
): number | null {
  if ("call" in ref)
    return num(callIn(ref, scope, leaves, ctx, only, range)?.v);
  const reads = new Map<string, unknown>();
  for (const l of leaves) if (l.t === "read") reads.set(l.p, l.v);
  // a text the step read a number from (T209, form 2) keeps the step's number
  for (const [p, v] of scope.r ?? [])
    if (num(v) !== null || !reads.has(p)) reads.set(p, v);
  const m = matchRead(ref.read, [...reads.keys()], ctx.character);
  return m ? num(reads.get(m.path)) : null;
}

/** The level a declared node opens into: a call's returned expression, or a read standing for itself. */
export function levelOfChild(
  child: BlueprintNode,
  parent: Level,
  leaves: readonly Expr[],
  ctx: LevelContext,
  only?: ReadonlySet<string>,
): Level {
  const { ref } = child;
  const n =
    ref && "call" in ref
      ? callIn(ref, parent.scope, leaves, ctx, only, lineTurn(parent))
      : undefined;
  if (n) return { expr: returnOf(n, ctx), scope: n, value: num(n.v) };
  const p =
    ref && "read" in ref
      ? ref.read.replaceAll("{character}", String(ctx.character))
      : "";
  const value = ref ? valueIn(ref, parent.scope, leaves, ctx) : null;
  // the read at its place in the parent's expression (one only), for a cache's author (cache-author.ts)
  const at = onlyRead(parent.expr, p);
  const expr: Expr = at ?? { t: "read", p, v: value };
  return { expr, scope: parent.scope, value, steps: parent.steps };
}

/** Whether a reference stands for a recorded part: a call's key, or a path it reads. */
export const refCovers = (ref: Ref, part: string, character: number) =>
  "call" in ref
    ? keyMatches(ref, part, character)
    : matchRead(ref.read, [part], character) !== null;

export const covers = (child: BlueprintNode, part: string, ctx: LevelContext) =>
  !!child.ref && refCovers(child.ref, part, ctx.character);

/** A child that is a text of the save the code's literal was picked by (T195): a condition, with no number of its own. */
export const textCondition = (
  child: BlueprintNode,
  level: { expr: Expr | null; scope: RecNode },
  ctx: LevelContext,
) =>
  child.leaf === "condition" &&
  (level.scope.r ?? []).some(
    ([p]) => covers(child, p, ctx) && textPart(level.scope, level.expr, p, ctx),
  );
