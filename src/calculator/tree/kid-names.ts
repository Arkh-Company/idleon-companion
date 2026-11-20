// pieces.cjs `fixNames` from the bench at BASELINE-4 (spec 008, T023): the names a level's rows take from the rows above
// them, and the parent that says its one child again. The bench runs it over a whole piece; here it runs when a row
// gets its place, over the level under it built then (tree/places.ts, tree/parent-passes.ts). Left out, each a
// deviation (research R14): the pet's own name in its shiny level (the pets' table is not one the names table reads,
// and the bench's fallback is the game's code), and the names of the root's first level (the steps, FR-006).
import { near } from "./math.ts";
import { named } from "./rows.ts";
import type { Row } from "./rows.ts";
import { tagOf } from "./tags.ts";

/** Each rule of fixNames, with what it tests. */
export const FIX_NAMES = {
  /** The one child that says its parent again: compared by the name before its parentheses. */
  collapse: { test: /\s*\(.*?\)\s*$/, proof: "bench pieces.cjs fixNames" },
  /** An Endless win's slot the game wins again in a later cycle. */
  cycle: {
    test: /^Endless win, slot \d+/,
    proof: "bench pieces.cjs fixNames; N.js Summoning",
  },
  /** A pet's shiny EXP under a parent named for it: the pet's shiny level. */
  shiny: {
    test: /^Breeding\[\d+\]\[\d+\]$/,
    proof: "bench pieces.cjs fixNames; N.js Breeding",
  },
  /** (4) What a child that starts with its parent's name adds, unless it is only a vague word. */
  prefix: {
    test: /^(bonus|multi|multiplier|value)$/i,
    proof: "bench pieces.cjs fixNames rule 4",
  },
  /** (5) A name that ends with a system a level above shows already. */
  system: {
    test: /^(.*\S)\s+\(([A-Za-z][A-Za-z ]*)\)$/,
    proof: "bench pieces.cjs fixNames rule 5",
  },
};

const SHINY = "Shiny EXP";

/** A name without the parentheses at its end. */
const base = (s: string) => s.replace(FIX_NAMES.collapse.test, "").trim();

/**
 * fixNames' loop: the one child of `n` that says `n` again, with its value and rows of its own (`hasRows`), whose rows
 * are then `n`'s; null when there is none.
 */
export function collapsed(
  n: Row,
  kids: readonly Row[],
  hasRows: (c: Row) => boolean,
): Row | null {
  const [c] = kids;
  if (kids.length !== 1 || !c) return null;
  // a generic name says nothing, so it says no other row again (R14)
  if (n.node.flags.unnamed || c.node.flags.unnamed) return null;
  const same =
    base(c.node.name) === base(n.node.name) &&
    // (pieces.cjs near2: within 1e-9 of the child's value)
    near(n.node.value, c.node.value);
  return same && hasRows(c) ? c : null;
}

/** The new name of a parent named for a pet's shiny EXP, whose EXP is among its rows; null when it is not one. */
export function shinyLevel(n: Row, kids: readonly Row[]): string | null {
  return n.node.name === SHINY &&
    kids.some(
      (c) =>
        c.node.name === SHINY && FIX_NAMES.shiny.test.test(c.node.code ?? ""),
    )
    ? "Shiny level"
    : null;
}

/** An Endless win's slots won again, each with its cycle. */
function cycles(rows: readonly Row[]): Row[] {
  const count = new Map<string, number>();
  const nth = rows.map((r) => {
    if (!FIX_NAMES.cycle.test.test(r.node.name)) return 0;
    const i = (count.get(r.node.name) ?? 0) + 1;
    count.set(r.node.name, i);
    return i;
  });
  return rows.map((r, i) =>
    (count.get(r.node.name) ?? 0) > 1
      ? named(r, `${r.node.name} (cycle ${String(nth[i])})`)
      : r,
  );
}

/** (4) A child that starts with its parent's name `parent` says only what it adds. */
function byParent(r: Row, parent: string): Row {
  const pb = base(parent)
    .replace(/ · .*$/, "")
    .replace(/^[^\p{L}\p{N}]+/u, "");
  const cn = r.node.name;
  if (
    pb.length <= 3 ||
    !cn.toLowerCase().startsWith(pb.toLowerCase()) ||
    cn.length <= pb.length
  )
    return r;
  let rest = cn
    .slice(pb.length)
    .replace(/^[,:\s]+/, "")
    .replace(/^\(([^)]*)\)/, "$1")
    .trim();
  // vague once its parentheses are gone too ("bonus (Drop Rate)" is "bonus")
  if (!rest || FIX_NAMES.prefix.test.test(base(rest))) return r;
  if (/^[=<>≤≥]/.test(rest)) rest = `Value ${rest}`;
  return named(r, rest.charAt(0).toUpperCase() + rest.slice(1));
}

/** (5) A name that ends with its system, when a text of the rows `above` shows it, without it. */
function bySystem(r: Row, above: readonly string[]): Row {
  const m = FIX_NAMES.system.test.exec(r.node.name);
  const sys = m?.[2]?.toLowerCase();
  return m?.[1] && sys && above.some((s) => s.toLowerCase().includes(sys))
    ? named(r, m[1])
    : r;
}

/**
 * A pool or a system's group (spec 009), or a row of caps (fix tree-shape-091, rule 4): its name, ⓘ and rows are the
 * app's, and its rows keep the names they had at the level above it.
 */
export const isMould = (r: Pick<Row, "node" | "capped">): boolean =>
  r.node.role === "pool" || r.node.role === "system" || !!r.capped;

/** A row's text as the levels under it see it: its name and its tag. */
export const aboveText = (a: { name: string; code: string | null }) =>
  `${a.name} ${tagOf(a.code)}`;

/**
 * The rows under the row `parent`, named as fixNames names them: an Endless win's cycles, then (4) by the parent's
 * name (unless it has no proven name), then (5) by the texts of the rows `above` the parent and the parent's own. A
 * pool or a system's group keeps the app's name (spec 009).
 */
export function kidNames(
  rows: readonly Row[],
  parent: {
    name: string;
    code: string | null;
    flags?: { unnamed?: boolean };
  },
  above: readonly string[],
): Row[] {
  const texts = [...above, aboveText(parent)];
  // (4) a parent with no proven name says nothing its children could repeat (R14)
  const own = (r: Row) =>
    parent.flags?.unnamed ? r : byParent(r, parent.name);
  return cycles(rows).map((r) => (isMould(r) ? r : bySystem(own(r), texts)));
}
