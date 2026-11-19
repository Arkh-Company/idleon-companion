// pieces.cjs `oneOfEach` from the bench at BASELINE-4, narrow (spec 008, T023; spec Open Questions, 15/11): the leaves
// of a level with the same code and the same value are one leaf (the game calls Dungon() many times per tree). A source
// a game-bug rule marks stays repeated, as FR-016 of the 008 asks (tree/game-bugs.ts). It runs when a level gets its
// place (tree/places.ts), after the passes over it. With no group "At 0" nor "At ×1" (spec 009, FR-016), no group
// counts its rows.
import { bare } from "./rows.ts";
import type { Row } from "./rows.ts";

/** The rows with one leaf of each code and value, but those `marked` (a game bug). */
export function oneOfEach(
  rows: readonly Row[],
  marked: (code: string) => boolean,
): Row[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const { code } = r.node;
    if (!bare(r) || code === null || marked(code)) return true;
    const key = `${code}|${String(r.node.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
