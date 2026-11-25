// The read a leaf of a step stands for (spec 008, T022, build-tree.cjs step 8d; moved out of steps.ts as it was): the
// read whose path the leaf's own code names, a number read from a text it names (spec 010, T209 form 2), the read at
// the leaf's own place (T231), else the one read of the call that holds the value, or the one text cell worth it. A path
// used up is not bound again.
import { EMPTY_READ } from "../recording.ts";
import type { RecValue } from "../recording.ts";
import { astPattern, matchPattern, methodOf, textRead, unwrap } from "./ast.ts";
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
  /** The step count the leaf's own record holds: the reads it made there. */
  here?: number,
): string | null | { why: string } {
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
  // a key the save does not have (T214): the 0 asNumber gives is the read the code names, noted empty at its place;
  // never a working map's (a cache's key not yet set, T192)
  if (pat && v === 0) {
    const empty = pool.filter(
      ([p, val]) =>
        val === EMPTY_READ &&
        matchPattern(p, pat) &&
        !/^(DNSM|DummyNumbersStatManager)\./.test(p),
    );
    if (empty.length === 1 && empty[0]) return empty[0][0];
  }
  // how many entries a map of the save holds (T209, form 4: the game's D.mapCount(FarmCrop)): the map's path, a quantity
  const count = countOf(node);
  if (count !== null) return count;
  // a number read from a text the code names, with a mark taken out (T209, form 2): the read of that path, one only
  const tp = pat ? null : textRead(node, pool, v);
  if (tp !== null) return tp;
  // the read at the leaf's own place (T231): the place decides, never the value among the call's reads; two there the
  // place does not part are refused with the reason
  const at = new Set(
    rxs.flatMap(([p, val, xi]) =>
      xi === here && val === v && (!pat || matchPattern(p, pat)) && !table(p)
        ? [p]
        : [],
    ),
  );
  const [one, ...more] = at;
  if (more.length > 0)
    return {
      why: `duas leituras de valor ${String(v)} no lugar da folha (${[...at].join("; ")}), e o lugar não as separa`,
    };
  if (one !== undefined) {
    usedR.add(one);
    return one;
  }
  const same = pool.filter(([p, val]) => val === v && !table(p));
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

/** A game table's read, or a length: never a number of the formula by its value. */
const table = (p: string) =>
  GAME_TABLE.some((r) => r.test.test(p)) || p.endsWith(".length");

/**
 * Whether the one read at a leaf's own place `pos` (the step count it was read at) is a working map's key not yet set
 * (T194: the game's shinies sum through a variable of the map): the leaf is the 0 asNumber gives, where the sum starts
 * (T192), never another read worth 0.
 */
export function emptyKeyAt(
  rxs: readonly (readonly [string, RecValue, ...unknown[]])[],
  pos: number | undefined,
): boolean {
  const at = rxs.filter((x) => x[2] === pos);
  const [only] = at;
  return (
    at.length === 1 &&
    only?.[1] === EMPTY_READ &&
    /^(DNSM|DummyNumbersStatManager)\./.test(only[0])
  );
}

/**
 * The path of the map whose entries a leaf counts, `mapCount(getGameAttribute("X"))` (spec 010, T209 form 4); null for any
 * other leaf. shortcut: only a map at the top of the state; follow a deeper path when a count reads one.
 */
function countOf(node: AstNode): string | null {
  const n = unwrap(node);
  const [arg] = (n.arguments as AstNode[] | undefined) ?? [];
  const pat = methodOf(n) === "mapCount" && arg ? astPattern(arg) : null;
  const [top] = pat?.toks ?? [];
  return pat?.root && pat.toks.length === 1 && top ? top : null;
}
