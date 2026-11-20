// The caps of the game (fix tree-shape-091, rule 4; Vinicius: everything has a name, never "Game value"): a step c +
// max((x − c)^e, 0), c + (x − c)^e or c × (x ÷ c)^e softens what goes past c. Caps one after the other on the same
// value are one row, named by what they cap, the part of the game's working value whose sources x sums or multiplies
// (CAP_NAMES); its constant, exponent and floor are in its ⓘ (tree/terms.ts). A cap whose part has no name in the table
// stays as it is.
import { fx3 } from "./curves.ts";
import { token } from "./formulas.ts";
import { inlined } from "./inline.ts";
import { near } from "./math.ts";
import { multipliersIn } from "./multiplier-rows.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { strip } from "./scaled.ts";
import { termOf } from "./share.ts";
import type { Expr, Step } from "./steps.ts";

/** One cap: added (c + max((x − c)^e, 0)) or scaled (c × (x ÷ c)^e), with its floor of 0 or none, around `x`. */
export interface Cap {
  kind: "add" | "scale";
  c: number;
  e: number;
  floor: boolean;
  x: Expr;
}

/**
 * The name of each part of a working value that caps soften, by the read of the part, with its proof. The game has no
 * name for the max damage's second and third parts: their names are the ones Vinicius chose (19/11).
 */
export const CAP_NAMES: ReadonlyMap<string, { name: string; proof: string }> =
  new Map([
    [
      "DummyNumbersStatManager.DamageDealtLIST[0]",
      {
        name: "Base Damage",
        proof:
          "N.js DamageDealed Max, part 1 (capped at 4000 and 15000); the game texts of the stamps (Base Damage), the statue (BASE_DAMAGE) and the cards",
      },
    ],
    [
      "DummyNumbersStatManager.DamageDealtLIST[1]",
      {
        name: "Damage Bonus",
        proof:
          "N.js DamageDealed Max, part 2 (capped at 100, 2e6 and 1e8); no name in the game, chosen by Vinicius (19/11)",
      },
    ],
    [
      "DummyNumbersStatManager.DamageDealtLIST[2]",
      {
        name: "Damage Multi",
        proof:
          "N.js DamageDealed Max, part 3 (capped at 100 up to 6e10); no name in the game, chosen by Vinicius (19/11)",
      },
    ],
  ]);

const numOf = (e: Expr | undefined): number | null => {
  const x = e && strip(e);
  return x?.t === "num" && typeof x.v === "number" ? x.v : null;
};

/** pow(x ∘ c, e) with `o` the operation ∘ and c the cap's constant: x and e; else null. */
function powOf(e: Expr, o: string, c: number): { x: Expr; e: number } | null {
  const p = strip(e);
  if (p.t !== "fn" || p.name !== "pow" || p.args.length !== 2) return null;
  const [base, exp] = p.args;
  const b = base && strip(base);
  const ex = numOf(exp);
  return b?.t === "op" && b.o === o && numOf(b.r) === c && ex !== null
    ? { x: b.l, e: ex }
    : null;
}

/** The cap step `e` is, c + max((x − c)^e, 0), c + (x − c)^e or c × (x ÷ c)^e; else null. */
export function capOf(e: Expr): Cap | null {
  const x = strip(e);
  if (x.t !== "op" || (x.o !== "+" && x.o !== "*")) return null;
  const c = numOf(x.l);
  if (c === null) return null;
  if (x.o === "*") {
    const p = powOf(x.r, "/", c);
    return p ? { kind: "scale", c, e: p.e, floor: false, x: p.x } : null;
  }
  const r = strip(x.r);
  const floored =
    r.t === "fn" &&
    r.name === "max" &&
    r.args.length === 2 &&
    numOf(r.args[1]) === 0 &&
    r.args[0]
      ? r.args[0]
      : null;
  const p = powOf(floored ?? r, "-", c);
  return p ? { kind: "add", c, e: p.e, floor: !!floored, x: p.x } : null;
}

/** The two lines of a cap around the lines of its `x`, in brackets when `x` is an expression (another cap). */
export function capLines(
  cap: Cap,
  x: [string, string],
  bracket: boolean,
): [string, string] {
  const line = (text: string, c: string, e: string) => {
    const inner = bracket ? `(${text})` : text;
    return cap.kind === "scale"
      ? `${c} × pow(${inner} ÷ ${c}, ${e})`
      : cap.floor
        ? `${c} + max(pow(${inner} − ${c}, ${e}), 0)`
        : `${c} + pow(${inner} − ${c}, ${e})`;
  };
  const c = String(cap.c);
  const e = String(cap.e);
  return [line(x[0], c, e), line(x[1], c, e)];
}

/**
 * The name of the part `x` makes, by the first read of CAP_NAMES in it or in the steps its values come from, before step
 * `at` of `steps`; null with none.
 */
export function capName(
  x: Expr,
  steps: readonly Step[],
  at: number,
  depth = 0,
): string | null {
  const walk = (e: Expr): string | null => {
    if (e.t === "read") return CAP_NAMES.get(e.p)?.name ?? null;
    if (e.t === "val") {
      const j = steps.findLastIndex((s, i) => i < at && near(s.v, e.v));
      const st = steps[j];
      return st && depth < 8 ? capName(st.e, steps, j, depth + 1) : null;
    }
    const subs =
      e.t === "op"
        ? [e.l, e.r]
        : e.t === "fn"
          ? e.args
          : e.t === "def"
            ? [e.e]
            : e.t === "not"
              ? [e.a]
              : [];
    for (const s of subs) {
      const n = walk(s);
      if (n) return n;
    }
    return null;
  };
  return walk(x);
}

/**
 * A step's terms with a cap the chain of steps split in two (its constant c, and max((x − c)^e, 0) or (x ÷ c)^e, each
 * a term of the step's sum or product) one term again, in the place of the first; any other term as it is.
 */
export function joinedCaps(terms: readonly Expr[], op: "+" | "*"): Expr[] {
  const out = [...terms];
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    if (!c || numOf(c) === null) continue;
    const join = (r: Expr): Expr => ({
      t: "op",
      o: op,
      l: c,
      r,
      v: op === "+" ? Number(c.v) + Number(r.v) : Number(c.v) * Number(r.v),
    });
    const j = out.findIndex((r, k) => k !== i && capOf(join(r)) !== null);
    const r = out[j];
    if (!r) continue;
    out[Math.min(i, j)] = join(r);
    out.splice(Math.max(i, j), 1);
  }
  return out;
}

/**
 * The row of the cap step `e`, step `at` of `steps`: the caps one after the other on a part of a working value, one row
 * by the part's name, its rows the sources of the value they cap (`part` builds that value's row, read in the turn of
 * its step), their math around its sum or product in its ⓘ; null when `e` is no cap or its part has no name.
 */
export function capRow(
  e: Expr,
  steps: readonly Step[],
  at: number,
  part: (x: Expr, at: number) => Row | null,
): Row | null {
  const outer = capOf(e);
  if (!outer) return null;
  const caps: Cap[] = [outer];
  let from = at;
  let x = outer.x;
  for (;;) {
    const y = strip(x);
    const j =
      y.t === "val"
        ? steps.findLastIndex((st, i) => i < from && near(st.v, y.v))
        : -1;
    const st = steps[j];
    const inner = st ? capOf(st.e) : null;
    if (!inner) break;
    caps.push(inner);
    from = j;
    x = inner.x;
  }
  const name = capName(x, steps, from);
  const own = name ? part(x, from) : null;
  const v = e.v;
  if (!name || !own || typeof v !== "number" || !Number.isFinite(v))
    return null;
  // the multipliers of a product of sources each their × row, in its steps that only multiply too (rule 2)
  const sources = multipliersIn(own);
  const xv = Number(x.v);
  const [names, numbers] = caps.reduceRight<[string, string]>(
    (lines, cap, i) => capLines(cap, lines, i < caps.length - 1),
    [token(`v:${String(xv)}`, termOf(sources.node)), fx3(xv)],
  );
  const capped: Row = {
    node: row({ pieceKey: null, value: v, code: null, name, flags: {} }),
    open: null,
    group: [sources],
    xf: [names, `${numbers} = ${fx3(v)}`],
  };
  // the part's own sum or product inside the caps, its rows the cap's (tree/inline.ts)
  const w = inlined(capped, [sources]);
  return {
    ...capped,
    node: { ...capped.node, formula: w.formula },
    group: w.rows,
  };
}
