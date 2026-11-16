// pieces.cjs `oneOfEach` from the bench at BASELINE-4, narrow (spec 008, T023; spec Open Questions, 15/11): the leaves
// of a level with the same code and the same value are one leaf (the game calls Dungon() many times per tree), and the
// group of the parts at 0 or at ×1 counts the rows it keeps ([NR-C]). A source a game-bug rule marks stays repeated,
// as FR-016 asks (tree/game-bugs.ts). It runs when a level gets its place (tree/places.ts), after the passes over it.
import { isGroup } from "./kid-names.ts";
import { bare } from "./rows.ts";
import type { Row } from "./rows.ts";

/** The name of a group that counts its rows. */
export const ONE_OF_EACH = {
  test: /^(At ×1|At 0) \((\d+)\)$/,
  proof: "bench pieces.cjs oneOfEach; bench pieces.cjs NR-C",
};

/** The rows with one leaf of each code and value, but those `marked` (a game bug); a group with its count. */
export function oneOfEach(
  rows: readonly Row[],
  marked: (code: string) => boolean,
): Row[] {
  const seen = new Set<string>();
  return rows.flatMap((r) => {
    if (r.group && isGroup(r)) {
      const group = oneOfEach(r.group, marked);
      const name = r.node.name.replace(
        ONE_OF_EACH.test,
        (_all, words: string) => `${words} (${String(group.length)})`,
      );
      return [{ ...r, group, node: { ...r.node, name } }];
    }
    const { code } = r.node;
    if (!bare(r) || code === null || marked(code)) return [r];
    const key = `${code}|${String(r.node.value)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [r];
  });
}
