// pieces.cjs `oneOfEach` from the bench at BASELINE-4, narrow (spec 008, T023; spec Open Questions, 15/11): the leaves
// of a level with the same code and the same value are one leaf (the game calls Dungon() many times per tree). A source
// a game-bug rule marks stays repeated, as FR-016 of the 008 asks (tree/game-bugs.ts). It runs when a level gets its
// place (tree/places.ts), after the passes over it. With no group "At 0" nor "At ×1" (spec 009, FR-016), no group
// counts its rows. Audit family 8: identical checks with no code (the game's loop checks the same thing once per item)
// are one too, and identical calls with the same value are one unless they are separate parts of the level's sum
// (FR-008).
import { vOf } from "./formulas.ts";
import { near } from "./math.ts";
import { bare } from "./rows.ts";
import type { Row } from "./rows.ts";

/** The key a repeat of row `r` shares with it, or null for a row that is never one of a repeat. */
function keyOf(r: Row, marked: (code: string) => boolean): string | null {
  const { code, value, name, leaf } = r.node;
  if (bare(r) && code === null)
    // the same comparison, not only the same name (two checks may both have no name yet)
    return leaf === "condition"
      ? `check|${r.test ?? name}|${name}|${String(value)}`
      : null;
  if (code === null || marked(code) || r.group?.length) return null;
  return `${bare(r) ? "leaf" : "call"}|${code}|${String(value)}`;
}

/**
 * The rows with one leaf of each code and value, but those `marked` (a game bug); one check with no code of each name
 * and answer; one call of each code and value, unless the rows are the parts of the level's sum or product `total`.
 */
export function oneOfEach(
  rows: readonly Row[],
  marked: (code: string) => boolean,
  total?: number,
): Row[] {
  // a level of no known value keeps its calls, as do the parts of its sum or its product (FR-008)
  const vals = rows.map(vOf);
  const apart =
    total === undefined ||
    near(
      vals.reduce((a, x) => a + x, 0),
      total,
    ) ||
    near(
      vals.reduce((a, x) => a * x, 1),
      total,
    );
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = keyOf(r, marked);
    if (key === null || (apart && key.startsWith("call|"))) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
