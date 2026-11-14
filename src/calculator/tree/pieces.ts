// A piece is built once (spec 008, FR-009, FR-015): the port of pieces.cjs `explain`, `explainOnce0` (its first step)
// and `cacheHitTwin`, with BUILT, PIECE_CONFLICTS and UNDER_ROOT, from the bench at BASELINE-4. The bench builds the
// whole tree in one pass; the app builds one level when the player opens a branch (research R4), so the piece's rows
// are those of its first call under the root in the order the game ran them, whichever place is opened first.
import type { RecNode, Recording } from "../recording.ts";
import type { Link } from "./links.ts";
import { near } from "./math.ts";

/** pieces.cjs MAX_DEPTH [NR-P]: the depth limit of `explain`. */
export const MAX_DEPTH = 16;

export interface Pieces<R> {
  /** The rows of call `id`, or null when the depth limit or a cycle cuts it (`seen`: the calls above it). */
  explain(id: number, depth: number, seen: ReadonlySet<number>): R[] | null;
  /** The keys of the pieces with a place that would come out different (pieces.cjs PIECE_CONFLICTS). */
  readonly conflicts: readonly string[];
}

/**
 * `raw` builds one call's own rows (the bench's explainRaw and what follows it), `keyOf` is the piece's key (block and
 * arguments) and `text` what two builds compare by.
 */
export function makePieces<R>(
  rec: Recording,
  links: ReadonlyMap<number, readonly Link[]>,
  raw: (id: number) => R[],
  keyOf: (n: RecNode) => string,
  text: (rows: R[]) => string,
): Pieces<R> {
  const { nodes } = rec;
  // [INV-1, fix 2] a piece exists only for what descends from the root: a call of the setup passes is another call.
  const underRoot = new Set<number>();
  const stack = rec.root === null ? [] : [rec.root];
  for (let id = stack.pop(); id !== undefined; id = stack.pop())
    if (!underRoot.has(id)) {
      underRoot.add(id);
      stack.push(...(nodes[id]?.c ?? []));
    }
  // The first call of each piece under the root, in the order the game ran them (node ids count up as calls start).
  const firstOf = new Map<string, number>();
  for (const id of [...underRoot].sort((a, b) => a - b)) {
    const n = nodes[id];
    if (n && !firstOf.has(keyOf(n))) firstOf.set(keyOf(n), id);
  }
  const built = new Map<string, R[]>();
  const conflicts: string[] = [];
  const checked = new Set<number>();

  // [INV-1, fix 1] and [DEEP-1, fix B]: a call that returned the cache its twin filled (same block, arguments and value,
  // no children, a read of that cache) is the twin's piece, when both descend from the root.
  function cacheHitTwin(n: RecNode): RecNode | null {
    if (n.c.length > 0 || !underRoot.has(n.id)) return null;
    for (const [path, writer] of links.get(n.id) ?? []) {
      const w = writer !== null && writer !== n.id ? nodes[writer] : undefined;
      if (
        w?.b === n.b &&
        JSON.stringify(w.a) === JSON.stringify(n.a) &&
        underRoot.has(w.id) &&
        near(w.v, n.v) &&
        (n.r ?? []).some(([p]) => p === path)
      )
        return w;
    }
    return null;
  }

  function explain(
    id: number,
    depth: number,
    seen: ReadonlySet<number>,
  ): R[] | null {
    const n = nodes[id];
    if (!n || seen.has(id) || depth > MAX_DEPTH) return null;
    const twin = cacheHitTwin(n);
    if (twin && !seen.has(twin.id)) return explain(twin.id, depth, seen);
    if (!underRoot.has(id)) return raw(id);
    const key = keyOf(n);
    let rows = built.get(key);
    if (!rows) {
      rows = raw(firstOf.get(key) ?? id);
      built.set(key, rows);
    }
    if (firstOf.get(key) !== id && !checked.has(id)) {
      checked.add(id);
      if (text(raw(id)) !== text(rows)) conflicts.push(key);
    }
    return rows;
  }

  return { explain, conflicts };
}
