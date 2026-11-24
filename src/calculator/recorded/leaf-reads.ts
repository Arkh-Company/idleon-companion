// The read a leaf of a step stands for (spec 008, T022, build-tree.cjs step 8d; moved out of steps.ts as it was): the
// read whose path the leaf's own code names, a number read from a text it names (spec 010, T209 form 2), else the one
// read of the call that holds the value, or the one text cell worth it. A path used up is not bound again.
import type { RecValue } from "../recording.ts";
import { matchPattern, textRead } from "./ast.ts";
import type { AstNode } from "./ast.ts";
import { GAME_TABLE } from "./step-types.ts";
import type { Reads } from "./step-types.ts";

export function readOfLeaf(
  node: AstNode,
  v: number,
  pool: Reads,
  rxs: readonly (readonly [string, RecValue, ...unknown[]])[],
  usedR: Set<string>,
  pat: { toks: (string | null)[]; root: boolean } | null,
): string | null {
  // C (inv-2): the read whose path the code's own text names, when only one is; before the match by value.
  if (pat) {
    const cand = pool.filter(
      ([p, val]) =>
        (val === v ||
          (typeof val === "string" &&
            val.trim() !== "" &&
            Number(val) === v)) &&
        matchPattern(p, pat) &&
        !rxs.some((x) => x[0] === p && Number(x[1]) !== v),
    );
    const [only] = cand;
    if (only && cand.length === 1) {
      // AUDIT-D R1: a converted text cell is used up, so a later bare number is not bound to it.
      if (typeof only[1] === "string") usedR.add(only[0]);
      return only[0];
    }
  }
  // a number read from a text the code names, with a mark taken out (T209, form 2): the read of that path, one only
  const tp = pat ? null : textRead(node, pool, v);
  if (tp !== null) return tp;
  const same = pool.filter(
    ([p, val]) =>
      val === v &&
      !GAME_TABLE.some((r) => r.test.test(p)) &&
      !p.endsWith(".length"),
  );
  if (same.length === 1 && same[0] && !usedR.has(same[0][0])) {
    usedR.add(same[0][0]);
    return same[0][0];
  }
  // a number the game read as text and converted (a card's per-star value "6", a table constant)
  const txt = pool.filter(
    ([p, val]) =>
      typeof val === "string" &&
      val.trim() !== "" &&
      Number(val) === v &&
      !/.length$/.test(p),
  );
  if (txt.length === 1 && txt[0] && !usedR.has(txt[0][0])) {
    usedR.add(txt[0][0]);
    return txt[0][0];
  }
  return null;
}
