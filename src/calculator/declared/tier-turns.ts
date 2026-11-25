// A tier (spec 010, T229; FR-018 of 009: the ladder `Sigil level < x.5` is no line): a call that returns what it set in
// the last turn of its loop whose test passed (the game's Breeding("SpecialPassives","Lv",…): `DN1 = r + 2` under the
// turn's test), a step that reads no call, no read and not its own value. It is a leaf whose value is what the game
// returned; the ladder's tests are its ⓘ, never children. The lock checks that value is the step's record in the turn of
// the last test the recording saw true, by its place: after that test and before the next one.
import type { RecNode } from "../recording.ts";
import { callRef, near } from "./answer-key-pool.ts";
import type { BlueprintNode } from "./blueprint.ts";
import { guardOf } from "./count-turns.ts";
import type { LevelContext, LevelOut } from "./lock-levels.ts";
import { keyOfLeaf, leavesOf } from "./lock-parts.ts";
import { fnFor } from "./write-rhs.ts";

/** Whether a step's op sets a value that is no part of it (`lv = r + 2`, never `t = t + 1`). */
function setsAfresh(op: number, ctx: LevelContext): boolean {
  const o = ctx.ops?.[op];
  const f = o ? fnFor(o.fnText) : null;
  const same = (a: { range: number[] }, b: { range: number[] }) =>
    a.range[0] === b.range[0] && a.range[1] === b.range[1];
  const n = o && f?.all.find((m) => same(m, o.node));
  const w = n && f?.up.get(n);
  if (!f || !n || w?.type !== "AssignmentExpression" || w.right !== n)
    return false;
  const src = (m: { range: number[] }) => f.text.slice(m.range[0], m.range[1]);
  const left = src(w.left as { range: number[] });
  return !f.all.some(
    (m) =>
      m.range[0] >= n.range[0] && m.range[1] <= n.range[1] && src(m) === left,
  );
}

/** Null when `scope` is no tier; else "" when its value is its last passing turn's, by its place, or the reason. */
export function tierOf(scope: RecNode, ctx: LevelContext): string | null {
  const { steps, stepAt } = ctx.stepsOf(scope.id);
  const last = steps.at(-1);
  const at = stepAt?.at(-1) ?? -1;
  const xs = scope.x ?? [];
  const op = xs[at]?.[0];
  const test = op === undefined || !ctx.ops ? -1 : guardOf(op, ctx.ops);
  if (
    !last ||
    op === undefined ||
    test < 0 ||
    !near(last.v, scope.v) ||
    leavesOf(last.e).some((l) => keyOfLeaf(l, ctx.rec) !== null) ||
    !setsAfresh(op, ctx)
  )
    return null;
  const tests = xs.flatMap(([o, v], j) => (o === test ? [{ j, v }] : []));
  const passed = tests.findLast((t) => t.v === true)?.j ?? Infinity;
  const next = tests.find((t) => t.j > passed)?.j ?? xs.length;
  return at > passed && at < next
    ? ""
    : `o valor de ${callRef(scope)} não é o passo da volta do último teste que passou, pelo lugar: não é a forma do tier (T229)`;
}

/** A declared tier on a ladder (T229): its refusal at its place; whether it was one, so its tests are no children. */
export function tierLeaf(
  node: BlueprintNode,
  at: RecNode,
  ctx: LevelContext,
  out: LevelOut,
): boolean {
  const why = node.leaf === "tier" ? tierOf(at, ctx) : null;
  if (why)
    out.errors.push({ kind: "openingRefused", where: ctx.where, got: why });
  return why !== null;
}
