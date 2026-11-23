// A running total kept in a counter of the game (spec 010, T177; the LUK's DummyNumbersStatManager.TotalStatsDN): of
// the paths a call writes in DummyNumbersStatManager, the loop's index is noise, and the total it adds to itself is
// told apart by what the code does with it, never by its value: a write whose own step reads the path back. When a
// sum's term reads that total, the total opens through its writes, each at its place (answer-key-chain.ts), one term per
// turn of its loop, in place of a loose constant; a total that also multiplies opens as the first pools of a sum it
// leads, and anywhere else stays the value it holds (T177 r1, the STR and the Accuracy).
import type { Op } from "../instrument.ts";
import type { RecNode, RecWrite } from "../recording.ts";
import { astPattern, matchPattern } from "../recorded/ast.ts";
import type { AstNode } from "../recorded/ast.ts";
import type { Expr } from "../recorded/steps.ts";
import { near } from "./answer-key-pool.ts";
import type { RawPool } from "./answer-key-pool.ts";

/** A node of the code that reads `path` (its own text names it), at any depth. */
function reads(n: unknown, path: string): boolean {
  if (typeof n !== "object" || n === null) return false;
  if (Array.isArray(n)) return n.some((x) => reads(x, path));
  const node = n as AstNode;
  if (typeof node.type !== "string") return false;
  const pat = astPattern(node);
  if (pat?.root && matchPattern(path, pat)) return true;
  return Object.entries(node).some(
    ([k, v]) => k !== "parent" && reads(v, path),
  );
}

/** The write adds to the path itself: its step (or the variable it carried, `t = path; t += x`) reads the path. */
export function accumulates(
  top: RecNode,
  ops: readonly Op[] | undefined,
  path: string,
  w: RecWrite,
): boolean {
  const op = ops?.[top.x?.[w.xi - 1]?.[0] ?? -1];
  if (!op) return false;
  return reads(op.kind === "assign" ? op.prevDef : op.node, path);
}

/**
 * The pools a running total opens into, for a term that reads it (`e`, a read of the path or a value with no name that
 * only one total's write holds): the chain of its writes up to the one with that value. Null when `e` is no running
 * total's. Inside a sum only a chain that only adds opens (`onlyAdds`); one that also multiplies opens only as the first
 * pools of a sum it leads (answer-key-expression.ts, T177 r1).
 */
export function runningPools(
  e: Expr,
  running: ReadonlyMap<string, readonly number[]>,
  opening: Set<string>,
  chain: (path: string, values: readonly number[]) => RawPool[],
): RawPool[] | null {
  if (typeof e.v !== "number") return null;
  const v = e.v;
  const paths =
    e.t === "read"
      ? running.has(e.p)
        ? [e.p]
        : []
      : e.t === "val"
        ? [...running]
            .filter(([, vs]) => vs.some((x) => near(x, v)))
            .map(([p]) => p)
        : [];
  const [path, ...more] = paths.filter((p) => !opening.has(p));
  if (path === undefined || more.length > 0) return null;
  const vs = running.get(path) ?? [];
  const k = vs.findLastIndex((x) => near(x, v));
  if (k < 0) return null;
  opening.add(path);
  try {
    return chain(path, vs.slice(0, k + 1));
  } finally {
    opening.delete(path);
  }
}

/** A running total's chain that only adds: its terms open inside a sum. */
export const onlyAdds = (raw: readonly RawPool[]): boolean =>
  raw.every((p) => p.kind === "additive" && p.next === undefined);
