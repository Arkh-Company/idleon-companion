// The recorded value a declared reference stands for in a level, and whether a child covers a part (spec 010, FR-010;
// moved out of lock-levels.ts as it was).
import type { RecNode } from "../recording.ts";
import type { Expr } from "../recorded/steps.ts";
import { callRef } from "./answer-key-pool.ts";
import type { BlueprintNode } from "./blueprint.ts";
import type { LevelContext } from "./lock-levels.ts";
import { num } from "./lock-parts.ts";
import { keyMatches, matchRead, savedTwice } from "./refs.ts";

type Ref = NonNullable<BlueprintNode["ref"]>;
/** The recorded call a call reference stands for in a level: one of its expression's, or one the level made. */
export function callIn(
  ref: Extract<Ref, { call: string }>,
  scope: RecNode,
  leaves: readonly Expr[],
  ctx: LevelContext,
  /** The parts of the chosen member's turn (T212): its calls only. */
  only?: ReadonlySet<string>,
): RecNode | undefined {
  const calls = [
    ...leaves.flatMap((l) => (l.t === "call" ? [l.id] : [])),
    ...scope.c,
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
): number | null {
  if ("call" in ref) return num(callIn(ref, scope, leaves, ctx, only)?.v);
  const reads = new Map<string, unknown>();
  for (const l of leaves) if (l.t === "read") reads.set(l.p, l.v);
  // a text the step read a number from (T209, form 2) keeps the step's number
  for (const [p, v] of scope.r ?? [])
    if (num(v) !== null || !reads.has(p)) reads.set(p, v);
  const m = matchRead(ref.read, [...reads.keys()], ctx.character);
  return m ? num(reads.get(m.path)) : null;
}

/** Whether a reference stands for a recorded part: a call's key, or a path it reads. */
export const refCovers = (ref: Ref, part: string, character: number) =>
  "call" in ref
    ? keyMatches(ref, part, character)
    : matchRead(ref.read, [part], character) !== null;

export const covers = (child: BlueprintNode, part: string, ctx: LevelContext) =>
  !!child.ref && refCovers(child.ref, part, ctx.character);
