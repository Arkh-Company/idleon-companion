// The passes of pieces.cjs `finish` that look at a row and the level under it (spec 008, T023; spec Open Questions,
// 15/11): when a row gets its place, the level under it is built (tree/places.ts), and these passes decide the row's
// name, its one child and its rows' names over it, in the bench's order: rule 67 of `rename`, fixNames
// (tree/kid-names.ts), nametagGrade (tree/parent-renames.ts), structurePass (tree/one-child.ts), stampBonus and
// opus1Sailing's artifact pick (tree/sailing.ts), opus3More's F7a (tree/leaf-passes.ts) and opus2Arena's rules
// (tree/arena.ts). The
// bench runs the first three over every level before structurePass, so a child merged into its row passes them too.
import type { Above } from "./above-renames.ts";
import { aboveText, collapsed, kidNames, shinyLevel } from "./kid-names.ts";
import { nametagGrade, petsEarlier, stampBonus } from "./parent-renames.ts";
import { near } from "./math.ts";
import { leafOf, MERGES, nameFrom } from "./one-child.ts";
import { artifactPick } from "./sailing.ts";
import { arenaPasses } from "./arena.ts";
import { pommelion } from "./pommelion.ts";
import { leafRules, mapsCount } from "./leaf-passes.ts";
import { mapsByKills } from "./last-renames.ts";
import type { Level } from "./places.ts";
import { bare } from "./rows.ts";
import { ifChecks } from "./build-up.ts";
import { scaledName } from "./scaled-names.ts";
import { withName } from "./row-checks.ts";
import type { Row } from "./rows.ts";

/** The level under row `r` of the level `at` (tree/places.ts), or null when it has none. */
export type Under = (r: Row, at: Level) => Level | null;

/**
 * Row `n` in the place of its child `c`: `c`'s rows and the sources of their ⓘ, `n`'s name (by its role too), value and
 * share, `c`'s code and why when `n` has none (pieces.cjs fixNames' loop).
 */
function absorb(n: Row, c: Row): Row {
  return {
    ...c,
    // a name by its role holds through the merge (tree/rows.ts `role`)
    ...(n.role ? { role: true as const } : {}),
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
 * row and the texts `above` it (tree/kid-names.ts), then nametagGrade over them and pommelionPass (tree/pommelion.ts). `text` is the row's text as the levels
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
    if (!c || !rows || c.ceiling) break;
    n = absorb(n, c);
    lv = rows;
  }
  n = withName(n, shinyLevel(n, lv.rows));
  const tag = nametagGrade(n, kidNames(lv.rows, n.node, above));
  const row = withName(n, tag.name);
  return {
    row,
    // pommelionPass, after nametagGrade as the bench runs it
    level: pommelion(row, { ...lv, rows: tag.kids }),
    text: aboveText(n.node),
  };
}

/**
 * The level with no working value of the game at 0 beside one branch of the row's value, the loop's one turn: that branch
 * alone. A turn that is a call keeps the running total at 0 in its place (FR-016, the 008's loop turns).
 */
function startless(r: Row, at: Level): Level {
  if (at.rows.length !== 2) return at;
  const zero = at.rows.find(
    (k) =>
      k.node.code?.startsWith("DNSM.") === true &&
      k.node.value === 0 &&
      !!k.node.flags.unnamed &&
      !k.group?.length,
  );
  const [turn] = at.rows.filter((k) => k !== zero);
  return zero &&
    turn?.node.code === null &&
    !!turn.group?.length &&
    near(turn.node.value, r.node.value)
    ? { ...at, rows: [turn] }
    : at;
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
  // spec 009 T030 (decision of 18/11): a loop's working value that starts at 0 beside its one turn adds nothing, so the
  // row is the turn, and structurePass below gives it the turn's parts (the bench's Cape Vine: 1.32 and 40)
  let at = startless(n, own.level);
  // the texts of every level above the rows a merge brings: the rows above, the row, then each child merged into it
  const above = [...up.map(aboveText), own.text];
  // structurePass: a row whose one child has its value is that child, a leaf or with the child's rows; a pool or a
  // system's group is the app's, no child to merge into. A sum's one part at 0 (rows.ts `asideAtZero`) stays in its
  // place under the row, as the 008's group "At 0" kept it (spec 009, FR-016)
  for (let i = 0; i < MERGES; i++) {
    const [c] = at.rows;
    if (
      at.rows.length !== 1 ||
      c?.node.role !== "piece" ||
      !near(c.node.value, n.node.value) ||
      c.asideAtZero ||
      // a ceiling is no part of the row: the row keeps its own name, ⓘ and rows (FR-018)
      c.ceiling
    )
      break;
    // a part named by its role over its one check (a companion owned, its bonus the check's value) is that bonus, the
    // check in its ⓘ, never a row (FR-018; fix tree-shape-091, round 1)
    if (bare(c) && n.role && c.node.leaf === "condition") {
      const leaf = leafOf(n, c);
      return {
        row: {
          ...leaf,
          node: {
            ...leaf.node,
            leaf: "rawBonus",
            condition: null,
            formula: ifChecks([c], Number(n.node.value)),
          },
        },
        level: null,
      };
    }
    // the bench's passes after structurePass see the leaf with the row's own code
    if (bare(c)) return { row: leafRules(leafOf(n, c)), level: null };
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
  // OPUS3-F7a, between opus1Sailing and opus2Arena as the bench runs them
  const maps = art.level && mapsCount(art.row, art.level.rows);
  if (maps) return { row: maps, level: null };
  const ar = arenaPasses(art.row, art.level);
  // opus5: the count of maps named by the earlier maps' total among its rows
  const named = withName(ar.row, mapsByKills(ar.row, ar.level?.rows ?? []));
  // spec 009 T026, last: a branch with no proven name of one source and constants takes the source's name
  return { row: scaledName(named, ar.level, under), level: ar.level };
}
