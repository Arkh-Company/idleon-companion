// The read a leaf of a step stands for (spec 008, T022, build-tree.cjs step 8d; moved out of steps.ts as it was): the
// read whose path the leaf's own code names, a number read from a text it names (spec 010, T209 form 2), the read at
// the leaf's own place (T231), else, for a leaf with no place, the one read of the call that holds the
// value, or the one text cell worth it. A path used up is not bound again.
import { EMPTY_READ } from "../recording.ts";
import type { RecValue } from "../recording.ts";
import {
  astPattern,
  at,
  matchPattern,
  methodOf,
  textRead,
  unwrap,
} from "./ast.ts";
import type { AstNode } from "./ast.ts";
import { GAME_TABLE } from "./step-types.ts";
import type { Expr, Reads } from "./step-types.ts";

export function readOfLeaf(
  node: AstNode,
  v: number,
  pool: Reads,
  rxs: readonly (readonly [string, RecValue, ...unknown[]])[],
  usedR: Set<string>,
  pat: { toks: (string | null)[]; root: boolean } | null,
  /** The step count the leaf's own record holds: the reads it made there. */
  here?: number,
  /** The step count of the leaf's first own step (a text's `"" + string(…)` inside it, T209 form 2); `here` with none. */
  from = here,
): string | null | { why: string } {
  const worth = (val: RecValue) =>
    val === v ||
    (typeof val === "string" && val.trim() !== "" && Number(val) === v);
  // with a place, a path counts only when read there, from the leaf's first own step to its own, with a value `ok`
  // takes (T231 r1; r2 of part X)
  const atHere = (p: string, ok: (val: RecValue) => boolean) =>
    here === undefined ||
    rxs.some(
      ([q, val, xi]) =>
        q === p &&
        typeof xi === "number" &&
        xi >= (from ?? here) &&
        xi <= here &&
        ok(val),
    );
  // C (inv-2): the read whose path the code's own text names, when only one is; before the match by value. With a
  // place, only one read there (T231 r1)
  if (pat) {
    const cand = pool.filter(
      ([p, val]) =>
        worth(val) &&
        matchPattern(p, pat) &&
        !rxs.some((x) => x[0] === p && Number(x[1]) !== v) &&
        atHere(p, worth),
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
        !/^(DNSM|DummyNumbersStatManager)\./.test(p) &&
        atHere(p, (x) => x === EMPTY_READ),
    );
    if (empty.length === 1 && empty[0]) return empty[0][0];
  }
  // how many entries a map of the save holds (T209, form 4: the game's D.mapCount(FarmCrop)): the map's path, a quantity
  const count = countOf(node);
  if (count !== null) return count;
  // a number read from a text the code names, with a mark taken out (T209, form 2): the read of that path, one only
  const tp = pat
    ? null
    : textRead(
        node,
        pool.filter(([p, val]) => atHere(p, (x) => x === val)),
        v,
      );
  if (tp !== null) return tp;
  // the read at the leaf's own place (T231): the place decides, never the value among the call's reads; two there the
  // place does not part are refused with the reason. A leaf with a place is never tied by value elsewhere (T231 r1); a
  // variable with one never comes here: it is its write before it (T232, steps.ts)
  const at = new Set(
    rxs.flatMap(([p, val, xi]) =>
      xi === here && worth(val) && (!pat || matchPattern(p, pat)) && !table(p)
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
  if (here !== undefined) return null;
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

/**
 * What a variable no recorded step set before its place holds (T232): the number of the code it was set to (a loop's
 * `best = 0`), or the one read its setting code names among the reads up to its place, its value only confirming it
 * (T232 r1: never picked by value); null with neither, or with a computed key the code does not name.
 */
export function setBy(
  def: AstNode | null | undefined,
  pool: Reads,
  v: number,
): Expr | null {
  if (def?.type === "Literal")
    return def.value === v ? { t: "def", e: { t: "num", v }, v } : null;
  // a member of one name (`s.TreeLevel`) names that path whole, since a variable reads nothing by itself
  const name = def?.type === "MemberExpression" && !def.computed;
  const pat = def
    ? (astPattern(def) ??
      (name ? { toks: [String(at(def, "property").name)], root: true } : null))
    : null;
  // a working map's value is the call's own (T209 form 3), never a read here
  const hits =
    pat && !pat.toks.includes(null)
      ? pool.filter(
          ([p]) =>
            matchPattern(p, pat) &&
            !/^(DNSM|DummyNumbersStatManager)\./.test(p),
        )
      : [];
  const [one] = hits;
  // a number read as text counts
  const x = one?.[1];
  const worth =
    x === v || (typeof x === "string" && x.trim() !== "" && Number(x) === v);
  return one && hits.length === 1 && worth ? { t: "read", p: one[0], v } : null;
}

/** The reads made up to each place `pos` of a call's log, from `from` on (a turn's), each path at its last value. */
export function readsUpTo(
  rxs: readonly (readonly [string, RecValue, number, ...unknown[]])[],
  from: number | undefined,
): (pos: number) => Reads {
  const memo = new Map<number, Reads>();
  return (pos) => {
    const hit = memo.get(pos);
    if (hit) return hit;
    const m = new Map<string, RecValue>();
    for (const x of rxs) {
      if (x[2] > pos) break;
      if (from === undefined || x[2] >= from) m.set(x[0], x[1]);
    }
    const out = [...m];
    memo.set(pos, out);
    return out;
  };
}

/** The first place of a leaf at `here`: the steps logged inside it right before its own (a text's `"" + string(…)`). */
export function placeFrom(
  node: AstNode,
  here: number | undefined,
  opAt: (pos: number) => { node: AstNode } | undefined,
): number | undefined {
  const within = (j: number) => {
    const o = opAt(j)?.node;
    return !!o && o.range[0] >= node.range[0] && o.range[1] <= node.range[1];
  };
  let from = here;
  while (from !== undefined && within(from - 1)) from--;
  return from;
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
