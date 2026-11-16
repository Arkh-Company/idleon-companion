// pieces.cjs `opus1Sailing` from the bench at BASELINE-4 (spec 008, T023), its rule on a row and the level under it: the
// artifact's call whose entry is picked by max(0, t). It runs when the row gets its place, after structurePass and
// stampBonus (tree/parent-passes.ts), as the bench runs it after them; its leaf rules are tree/leaf-passes.ts's. The
// bench's name of the branch ("max(0, 32)", its own sum with numbers) is one the app never gives (tree/shapes.ts): the
// branch is told by its parts, an unlinked earlier value and the minimum 0, with no code nor name of its own.
import type { Level } from "./places.ts";
import { row, unlinked } from "./rows.ts";
import type { Row } from "./rows.ts";

/** The rule, with what it tests and the why of the 0 it shows. */
export const ARTIFACT_PICK = {
  test: 'Sailing("ArtifactBonus", ',
  /** The artifact's ⓘ when the bonus it starts is still 0: the list is being rebuilt. */
  rebuilt: "1 + ((0 + ",
  // the bench's why names the game's list; here only what it holds, with no ";" (the host refuses one)
  why: "the game fills the artifact list with 0 and then each artifact in order, and this read comes before its own entry (N.js Sailing)",
  proof: "bench pieces.cjs opus1Sailing; N.js Sailing ArtifactBonus",
};

/** max(0, t): t only picks the artifact's entry, no part of its bonus. */
function isPick(x: Row): boolean {
  const g = x.group ?? [];
  return (
    x.node.code === null &&
    !!x.node.flags.unnamed &&
    g.some(unlinked) &&
    g.every((y) => unlinked(y) || y.node.name === "Minimum 0")
  );
}

/**
 * Row `n` and its level with the artifact's pick gone; with nothing else, the 0 of a list being rebuilt (the artifact
 * read before its entry is filled), or a raw bonus with no rows.
 */
export function artifactPick(
  n: Row,
  lv: Level,
): { row: Row; level: Level | null } {
  if (!(n.node.code ?? "").startsWith(ARTIFACT_PICK.test) || !lv.rows.length)
    return { row: n, level: lv };
  const rows = lv.rows.filter((x) => !isPick(x));
  if (rows.length) return { row: n, level: { ...lv, rows } };
  const xf = n.xf ?? n.f;
  if (xf?.[1].startsWith(ARTIFACT_PICK.rebuilt)) {
    const zero: Row = {
      node: row({
        pieceKey: null,
        value: 0,
        code: n.node.code,
        // a generic name names nothing (R14): the bench's own word then
        name: `${n.node.flags.unnamed ? "Artifact" : n.node.name} (not filled yet while the artifact list is rebuilt)`,
        leaf: "rawBonus",
        why: ARTIFACT_PICK.why,
        flags: {},
      }),
      open: null,
    };
    return { row: n, level: { ...lv, rows: [zero] } };
  }
  const leaf: Row = {
    ...n,
    open: null,
    node: { ...n.node, kids: [], leaf: "rawBonus" },
  };
  return { row: leaf, level: null };
}
