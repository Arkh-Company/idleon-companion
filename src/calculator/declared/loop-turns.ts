// A source that sums a list in a loop (spec 010, T167; spec, Open Questions 23/11): one child per turn, one item a
// line. The level is the step a call returned (`t = t + item`) when that step ran in more than one turn; each turn is
// the stretch of the call's step log up to that step's record, read at its own place (makeSteps turnOf), and its item
// is the step's right side there. The level closes by the sum of the items. A turn whose item is not a call or a read
// of its own place, or two turns with the same item, are refused with the reason: the turns do not part by their place.
// A cache its author summed over its own value (T168, `d.X.v = d.X.v + item`) opens the same way: each write of the
// author on the path a turn, its item the right side of the step that gave that write; a first write of 0 with no step
// is where the sum starts, no line.
import type { RecNode, RecWrite } from "../recording.ts";
import type { Expr } from "../recorded/steps.ts";
import { callRef, near } from "./answer-key-pool.ts";
import { writeExpr } from "./cache-author.ts";
import type { Opening } from "./level-openings.ts";
import type { LevelContext } from "./lock-levels.ts";
import { keyOfLeaf, num } from "./lock-parts.ts";

/** One line a turn, by its item, or the refusal's reason when the turns do not part by their place. */
function turnsOf(
  name: string,
  items: readonly (Expr | null | undefined)[],
  ctx: LevelContext,
): Opening[] | string {
  const below: Opening[] = [];
  for (const [k, item] of items.entries()) {
    const part = item ? keyOfLeaf(item, ctx.rec) : null;
    if (!item || item.t === "val")
      return `a volta ${String(k + 1)} do laço de ${name} não tem o item no seu lugar`;
    if (part === null)
      return `o item da volta ${String(k + 1)} do laço de ${name} não é uma chamada nem uma leitura`;
    if (below.some((b) => b.part === part))
      return `duas voltas do laço de ${name} têm o mesmo item (${part})`;
    const call = item.t === "call" ? (ctx.rec.nodes[item.id] ?? null) : null;
    below.push({ part, call, value: num(item.v) });
  }
  return below;
}

/** The turns of the loop whose sum the call returned, their refusal's reason, or null when it returned no such sum. */
export function loopOpening(
  expr: Expr | null,
  scope: RecNode,
  ctx: LevelContext,
): Opening[] | string | null {
  if (expr?.t !== "op" || expr.o !== "+") return null;
  const { steps, stepAt } = ctx.stepsOf(scope.id);
  const last = steps.at(-1);
  const at = stepAt?.at(-1);
  // only what the call returned: its last step, with its value (a two-source term's place can be the root's last step)
  if (last?.e !== expr || !near(last.v, scope.v) || at === undefined)
    return null;
  const op = scope.x?.[at]?.[0];
  const places = (scope.x ?? []).flatMap(([o], j) => (o === op ? [j] : []));
  if (op === undefined || places.length < 2) return null;
  const items = places.map((to, k) => {
    const from = k === 0 ? 0 : (places[k - 1] ?? 0) + 1;
    const e = ctx.turnOf(scope, { from, to }).exprOf?.(op);
    return e?.t === "op" ? e.r : null;
  });
  return turnsOf(callRef(scope), items, ctx);
}

/** The turns of a cache its author wrote more than once on the path up to `write`; null with one write only. */
export function writeTurns(
  author: RecNode,
  write: RecWrite,
  ctx: LevelContext,
): Opening[] | string | null {
  const ws = ctx.rec.writes.filter(
    (w) => w.node === author.id && w.path === write.path && w.seq <= write.seq,
  );
  if (ws.length < 2) return null;
  const exprs = ws.map((w) =>
    writeExpr(ctx.rec, { node: author, write: w }, ctx.turnOf),
  );
  // the sum starts at a write of 0 with no step of its own: no line
  const start = ws[0]?.v === 0 && exprs[0] === null ? 1 : 0;
  const items = exprs
    .slice(start)
    .map((e) => (e?.t === "op" && e.o === "+" ? e.r : null));
  return turnsOf(callRef(author), items, ctx);
}
