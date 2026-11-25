// The closing of a level (spec 010, FR-010, research R2; moved out of lock-levels.ts as it was): the recorded count
// evaluated again from its parts' recorded values, in memory only, against the level's value within the tolerance; a
// value with no source gives no number and the level does not close, but for the ones T209 ties by their place.
import type { Expr } from "../recorded/steps.ts";
import { relDiff } from "./answer-key-pool.ts";
import { evalExpr } from "./expr-eval.ts";
import type { Level, LevelContext, LevelOut } from "./lock-levels.ts";
import { keyOfLeaf, num, TOLERANCE, transparentValue } from "./lock-parts.ts";
import { notLeafOf } from "./not-leaves.ts";

export function closeLevel(
  level: Level,
  leaves: readonly Expr[],
  ctx: LevelContext,
  out: LevelOut,
  /** The call's own variable and the value its constants give (T209, form 3). */
  own?: { value: number | null; path?: string } | null,
): void {
  const { expr, scope, value } = level;
  const expected = value ?? Number.NaN;
  if (!expr) {
    out.errors.push({ kind: "notClosing", where: ctx.where, expected });
    return;
  }
  const reads = new Map((scope.r ?? []).map(([p, v]) => [p, v]));
  const wrote = (p: string) =>
    [...ctx.rec.writes, ...ctx.rec.spliced].some(
      (w) => w.node === scope.id && w.path === p,
    );
  const by = { recorded: false };
  const { open } = level;
  const got = open
    ? open.reduce<number | null>(
        (s, o) => (s === null || o.value === null ? null : s + o.value),
        0,
      )
    : evalExpr(expr, (e) => {
        if (!leaves.includes(e)) return undefined;
        const k = keyOfLeaf(e, ctx.rec);
        const n = e.t === "call" ? ctx.rec.nodes[e.id] : undefined;
        if (n && k !== null && notLeafOf(k, ctx.character)) {
          const t = transparentValue(n, ctx);
          by.recorded ||= t.byRecorded;
          return t.v ?? undefined;
        }
        if (n) return num(n.v) ?? undefined;
        // the block's own argument is a fixed value (T209, form 1); any other value with no source gives no number (R2)
        if (
          own &&
          ((e.t === "val" && e.own !== undefined) ||
            (e.t === "read" && e.p === own.path))
        )
          return own.value ?? undefined;
        // a loose value of the call's own variable is its read there (form 5)
        if (e.t === "val")
          return e.arg === undefined && e.own === undefined
            ? undefined
            : (num(e.v) ?? undefined);
        if (e.t !== "read") return undefined;
        // the call's own working variable, written again turn by turn (T212): the number its read had at its place
        if (wrote(e.p)) return num(e.v) ?? undefined;
        return num(reads.get(e.p)) ?? num(e.v) ?? undefined;
      });
  if (got !== null && value !== null && relDiff(got, value) <= TOLERANCE) {
    if (by.recorded) out.counts.closedByRecorded++;
    else out.counts.closed++;
    out.closedAt.push(ctx.where);
  } else
    out.errors.push({
      kind: "notClosing",
      where: ctx.where,
      expected,
      ...(got === null ? {} : { got }),
    });
}
