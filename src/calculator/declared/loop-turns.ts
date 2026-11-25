// A source that sums a list in a loop (spec 010, T167; spec, Open Questions 23/11): one child per turn, one item a
// line. The level is the step a call returned (`t = t + item`) when that step ran in more than one turn; each turn is
// the stretch of the call's step log up to that step's record, read at its own place (makeSteps turnOf), and its item
// is the step's right side there. The level closes by the sum of the items. A turn whose item is not a call or a read
// of its own place, or two turns with the same item, are refused with the reason: the turns do not part by their place.
// A cache its author summed over its own value (T168, `d.X.v = d.X.v + item`) opens the same way: each write of the
// author on the path a turn, its item the right side of the step that gave that write; a first write of 0 with no step
// is where the sum starts, no line. A write is a turn only when its step adds to a read of the path itself: a last
// write that does not overwrote the cache, and its own count opens it; an overwrite among the turns is refused. The
// first write may add to the 0 of a key not yet set, the author's first read of it empty (T192: the game's Gallery).
import { READ_CAP } from "../recording.ts";
import type { RecNode, RecWrite } from "../recording.ts";
import type { Expr } from "../recorded/steps.ts";
import { atCap, callRef, near } from "./answer-key-pool.ts";
import { writeExpr } from "./cache-author.ts";
import type { Opening } from "./level-openings.ts";
import type { LevelContext } from "./lock-levels.ts";
import { keyOfLeaf, num } from "./lock-parts.ts";
import { writesBy } from "./own-writes.ts";

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

/**
 * Whether the key of the author's first write `first` was not yet set (T192): its first read of the path saw no number
 * before that write, or, with its read list full (READ_CAP: the read fell off it, as in the game's TalentCalc(-6)), no
 * number of the path is in its step log before the write.
 */
function emptyKey(author: RecNode, first: RecWrite): boolean {
  const read = author.r?.find(([p]) => p === first.path);
  if (read) return num(read[1]) === null && (read[2] ?? -1) < first.seq;
  return (
    (author.r?.length ?? 0) >= READ_CAP &&
    !atCap(author) &&
    !(author.rx ?? []).some(
      ([p, v, xi]) => p === first.path && num(v) !== null && xi <= first.xi,
    )
  );
}

/** The other side of a sum onto a loose 0 (`x + 0` or `0 + x`), or undefined. */
const onZero = (e: Expr | null | undefined): Expr | undefined => {
  if (e?.t !== "op" || e.o !== "+") return undefined;
  const zero = (x: Expr) =>
    x.t === "val" && x.v === 0 && x.arg === undefined && x.own === undefined;
  return zero(e.l) ? e.r : zero(e.r) ? e.l : undefined;
};

/**
 * A cache the author wrote once onto a key not yet set (the game's meals, `x + asNumber(the empty key)`): the count of
 * that write without the empty key's 0, where the sum starts; null for any other write.
 */
export function emptyStart(
  author: RecNode,
  write: RecWrite,
  e: Expr | null,
  writes: readonly RecWrite[],
): Expr | null {
  const own = writes.filter(
    (w) => w.node === author.id && w.path === write.path && w.seq <= write.seq,
  );
  const x = onZero(e);
  return own.length === 1 && x && emptyKey(author, write) ? x : null;
}

/**
 * The turns of a cache its author summed over its own value on the path up to `write`; null with one write only or a
 * last write that overwrote it.
 */
export function writeTurns(
  author: RecNode,
  write: RecWrite,
  ctx: LevelContext,
): Opening[] | string | null {
  const ws = writesBy(ctx.rec, author.id, false).filter(
    (w) => w.path === write.path && w.seq <= write.seq,
  );
  if (ws.length < 2) return null;
  const exprs = ws.map((w) =>
    writeExpr(ctx.rec, { node: author, write: w }, ctx.turnOf),
  );
  // the first write may add to the 0 of a key not yet set (T192)
  const empty = ws[0] !== undefined && emptyKey(author, ws[0]);
  const itemOf = (e: Expr | null | undefined, j: number) =>
    e?.t === "op" && e.o === "+" && e.l.t === "read" && e.l.p === write.path
      ? e.r
      : j === 0 && empty
        ? onZero(e)
        : undefined;
  if (itemOf(exprs.at(-1), exprs.length - 1) === undefined) return null;
  // the sum starts at a write of 0 with no step of its own: no line
  const start = ws[0]?.v === 0 && exprs[0] === null ? 1 : 0;
  const items = exprs.map(itemOf).slice(start);
  const name = callRef(author);
  // the first turn that does not add: with no step of its own it has no item (turnsOf), else it overwrote the cache
  const k = items.findIndex((x) => x === undefined);
  if (k >= 0 && exprs[k + start] !== null)
    return `a volta ${String(k + 1)} do laço de ${name} escreve ${write.path} sem somar sobre o próprio valor`;
  return turnsOf(name, items, ctx);
}
