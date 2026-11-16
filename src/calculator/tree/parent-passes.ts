// The passes of pieces.cjs `finish` that look at a row and the level under it (spec 008, T023; spec Open Questions,
// 15/11): when a row gets its place, the level under it is built (tree/places.ts), and these passes decide the row's
// name, its one child and its rows' names over it, in the bench's order: rule 67 of `rename`, fixNames
// (tree/kid-names.ts), nametagGrade (tree/parent-renames.ts), structurePass (tree/one-child.ts), stampBonus and
// opus1Sailing's artifact pick (tree/sailing.ts) and opus2Arena's rules (tree/arena.ts). The
// bench runs the first three over every level before structurePass, so a child merged into its row passes them too.
import type { Above } from "./above-renames.ts";
import { aboveText, collapsed, kidNames, shinyLevel } from "./kid-names.ts";
import { nametagGrade, petsEarlier, stampBonus } from "./parent-renames.ts";
import { near } from "./math.ts";
import { leafOf, MERGES, nameFrom } from "./one-child.ts";
import { artifactPick } from "./sailing.ts";
import { arenaPasses } from "./arena.ts";
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

/**
 * Row `r` and its level named as pieces.cjs names every level before its structurePass: rule 67, fixNames' loop (a
 * parent whose one child says it again is that child, with the child's rows), the shiny level, the rows' names by the
 * row and the texts `above` it (tree/kid-names.ts), then nametagGrade over them. `text` is the row's text as the levels
 * under it see it, before nametagGrade renames it (pieces.cjs fixNames' rule 5 runs before nametagGrade).
 */
function nameLevel(
  r: Row,
  level: Level,
  under: Under,
  above: readonly string[],
): { row: Row; level: Level; text: string } {
  let n = withName(r, petsEarlier(r, level.rows));
  let lv = level;
  for (;;) {
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
  n = withName(n, shinyLevel(n, lv.rows));
  const tag = nametagGrade(n, kidNames(lv.rows, n.node, above));
  return {
    row: withName(n, tag.name),
    level: { ...lv, rows: tag.kids },
    text: aboveText(n.node),
  };
}

/** Row `r` and its level, once the passes over them ran; `up` the rows above `r`. */
export function parentPasses(
  r: Row,
  level: Level | null,
  under: Under,
  up: readonly Above[],
): { row: Row; level: Level | null } {
  if (!level) return { row: r, level };
  const own = nameLevel(r, level, under, up.map(aboveText));
  let n = own.row;
  let at = own.level;
  // the texts of every level above the rows a merge brings: the rows above, the row, then each child merged into it
  const above = [...up.map(aboveText), own.text];
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
    // the child and its rows named as the bench names every level before it merges: the child by its rows, its rows
    // by the child and the rows above it; a vague row takes the child's new name (pieces.cjs nametagGrade's walk)
    const kid = nameLevel(c, next, under, above);
    above.push(kid.text);
    n = absorb(nameFrom(n, kid.row), kid.row);
    at = kid.level;
  }
  n = withName(
    n,
    stampBonus(n, at.rows, (k) => under(k, at)?.rows ?? []),
  );
  const art = artifactPick(n, at);
  return arenaPasses(art.row, art.level);
}
