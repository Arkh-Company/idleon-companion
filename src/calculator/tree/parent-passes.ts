// The passes of pieces.cjs `finish` that look at a row and the level under it (spec 008, T023; spec Open Questions,
// 15/11): when a row gets its place, the level under it is built (tree/places.ts), and these passes decide the row's
// name, its one child and its rows' names over it, in the bench's order: rule 67 of `rename`, fixNames
// (tree/kid-names.ts), nametagGrade (tree/parent-renames.ts), structurePass (tree/one-child.ts) and stampBonus.
import type { Above } from "./above-renames.ts";
import { aboveText, collapsed, kidNames, shinyLevel } from "./kid-names.ts";
import { nametagGrade, petsEarlier, stampBonus } from "./parent-renames.ts";
import { near } from "./math.ts";
import { leafOf, MERGES, nameFrom } from "./one-child.ts";
import type { Level } from "./places.ts";
import { bare, withName } from "./rows.ts";
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
  if (lv) n = withName(n, petsEarlier(n, lv.rows));
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
  const tag = nametagGrade(n, kidNames(lv.rows, n.node, up.map(aboveText)));
  n = withName(n, tag.name);
  let at: Level = { ...lv, rows: tag.kids };
  // structurePass: a row whose one child has its value is that child, a leaf or with the child's rows; a group of the
  // parts at 0 or at ×1 is the app's (FR-014), no child to merge into
  for (let i = 0; i < MERGES; i++) {
    const [c] = at.rows;
    if (
      at.rows.length !== 1 ||
      c?.node.role !== "piece" ||
      !near(c.node.value, n.node.value)
    )
      break;
    if (bare(c)) return { row: leafOf(n, c), level: null };
    // a child whose level is cut stays, and says so
    const next = under(c, at);
    if (!next) break;
    // the bench names every level (fixNames, nametagGrade) before it merges: the child's rows, by the child and the rows
    // above it
    const above = [...up.map(aboveText), aboveText(n.node)];
    const named = nametagGrade(c, kidNames(next.rows, c.node, above)).kids;
    n = absorb(nameFrom(n, c), c);
    at = { ...next, rows: named };
  }
  n = withName(
    n,
    stampBonus(n, at.rows, (k) => under(k, at)?.rows ?? []),
  );
  return { row: n, level: at };
}
