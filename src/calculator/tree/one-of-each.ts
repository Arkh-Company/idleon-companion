// pieces.cjs `oneOfEach` from the bench at BASELINE-4, narrow (spec 008, T023; spec Open Questions, 15/11): the leaves
// of a level with the same code and the same value are one leaf (the game calls Dungon() many times per tree). A source
// a game-bug rule marks stays repeated, as FR-016 of the 008 asks (tree/game-bugs.ts). It runs when a level gets its
// place (tree/places.ts), after the passes over it. With no group "At 0" nor "At ×1" (spec 009, FR-016), no group
// counts its rows. Audit family 8: identical checks with no code (the game's loop checks the same thing once per item)
// are one too, and identical calls with the same value are one unless they are separate parts of the level's sum
// (FR-008). A row the level's ⓘ cites more than once among its atoms is a part of its math each time: it stays as many
// times as the ⓘ cites it, a leaf or a call (FR-008, the review of the phase); a rule ⓘ and a check keep the rule above.
import type { CalcTreeNode } from "../tree-contract.ts";
import { vOf } from "./formulas.ts";
import { near } from "../recorded/math.ts";
import { bare } from "./rows.ts";
import type { Row } from "./rows.ts";
import { termOf } from "./share.ts";

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
 * How many times the ⓘ `f` names the term `t`: its atoms equal to it. A rule's text counts none (its If joins every
 * check, the repeated ones too, and a check said after the math names its read again), nor any check (a `check|` key).
 */
function citesOf(
  f: CalcTreeNode["formula"] | undefined,
  t: string,
  key: string,
): number {
  if (!Array.isArray(f) || !t || key.startsWith("check|")) return 0;
  return f[0].filter((a) => a === t).length;
}

/** The level of a placed row: its value, its ⓘ, and its rows that are no parts of its math (the reads beside it). */
export interface LevelOf {
  total?: number;
  formula?: CalcTreeNode["formula"];
  aside?: readonly Row[];
}

/**
 * The rows with one leaf of each code and value, but those `marked` (a game bug); one check with no code of each name
 * and answer; one call of each code and value, unless the rows are the parts of the level's sum or product `total`; and
 * any row as many times as the level's ⓘ cites it.
 */
export function oneOfEach(
  rows: readonly Row[],
  marked: (code: string) => boolean,
  { total, formula, aside = [] }: LevelOf = {},
): Row[] {
  // a level of no known value keeps its calls, as do the parts of its sum or its product (FR-008); its checks and the
  // reads beside it are no parts
  const vals = rows
    .filter((r) => r.node.leaf !== "condition" && !aside.includes(r))
    .map(vOf);
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
  const seen = new Map<string, number>();
  return rows.filter((r) => {
    const key = keyOf(r, marked);
    if (key === null) return true;
    const cites = citesOf(formula, termOf(r.node), key);
    const n = seen.get(key) ?? 0;
    const keep =
      cites > 1 ? n < cites : n === 0 || (apart && key.startsWith("call|"));
    if (keep) seen.set(key, n + 1);
    return keep;
  });
}
