// The passes of pieces.cjs `finish` that look at a row and the level under it (spec 008, T023; spec Open Questions,
// 15/11): when a row gets its place, the level under it is built (tree/places.ts), and these passes decide the row's
// name, its one child and its rows' names over it, in the bench's order: fixNames (tree/kid-names.ts).
import type { Above } from "./above-renames.ts";
import { aboveText, collapsed, kidNames, shinyLevel } from "./kid-names.ts";
import type { Level } from "./places.ts";
import { withName } from "./rows.ts";
import type { Row } from "./rows.ts";

/** The level under row `r` of the level `at` (tree/places.ts), or null when it has none. */
export type Under = (r: Row, at: Level) => Level | null;

/**
 * Row `n` in the place of its child `c`: `c`'s rows and the sources of their ⓘ, `n`'s name, value and share, `c`'s code
 * and why when `n` has none (pieces.cjs fixNames' loop).
 */
function absorb(n: Row, c: Row): Row {
  return {
    ...c,
    node: {
      ...n.node,
      code: n.node.code ?? c.node.code,
      why: n.node.why ?? c.node.why,
      kids: c.node.kids,
    },
  };
}

/** Row `r` and its level, once the passes over them ran; `up` the rows above `r`. */
export function parentPasses(
  r: Row,
  level: Level | null,
  under: Under,
  up: readonly Above[],
): { row: Row; level: Level | null } {
  let n = r;
  let lv = level;
  // fixNames' loop: a parent whose one child says it again is that child, with the child's rows
  while (lv) {
    const at = lv;
    let rows = null as Level | null;
    const c = collapsed(n, at.rows, (k) => {
      rows = under(k, at);
      return (rows?.rows.length ?? 0) > 0;
    });
    if (!c || !rows) break;
    n = absorb(n, c);
    lv = rows;
  }
  if (!lv) return { row: n, level: lv };
  n = withName(n, shinyLevel(n, lv.rows));
  return {
    row: n,
    level: { ...lv, rows: kidNames(lv.rows, n.node, up.map(aboveText)) },
  };
}
