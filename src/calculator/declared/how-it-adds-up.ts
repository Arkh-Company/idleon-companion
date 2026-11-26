// The ⓘ, "How it adds up" (spec 010, FR-016, research R11): made at the assembly from a level's recorded expression,
// each part by the name of the child that stands for it, never kept. A pure sum, product or function of named parts is
// the names and the numbers; a branch's check, or a part with no number, makes it a rule of two lines, as in the 008.
// A part with no name gives no ⓘ: the text never has a block's name nor a game's path (FR-012a of the 008). A curve
// shows by its role, its two constants named; the root's ⓘ joins the pools.
import type { Expr } from "../recorded/steps.ts";
import type { CalcTreeNode } from "../tree-contract.ts";

type Formula = CalcTreeNode["formula"];

/** 3 decimals, or 3 significant digits below 0.01 (the 008's rule 160), so the line of numbers recomputes. */
export const fx3 = (v: number): string =>
  v !== 0 && Math.abs(v) < 0.01
    ? String(+v.toPrecision(3))
    : String(+v.toFixed(3));

const SYMBOL: Readonly<Record<string, string>> = {
  "+": "+",
  "-": "−",
  "*": "×",
  "/": "÷",
  "**": "^",
};
const RANK: Readonly<Record<string, number>> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  "**": 3,
};
const CHECK: Readonly<Record<string, string>> = {
  "==": "=",
  "===": "=",
  "!=": "≠",
  "!==": "≠",
  ">": ">",
  "<": "<",
  ">=": "≥",
  "<=": "≤",
};
const FNS = new Set([
  "min",
  "max",
  "pow",
  "floor",
  "ceil",
  "round",
  "abs",
  "sqrt",
  "log",
]);
/** The renderer's operators (renderer/tree-text.ts): every other term takes a number. */
const OPERATOR =
  /^([×÷+−\-*/^:(),]|min|max|pow|floor|ceil|round|abs|sqrt|log)$/;

interface Part {
  terms: string[];
  nums: (number | null)[];
  rank: number;
}
const numOf = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v)
    ? v
    : typeof v === "boolean"
      ? Number(v)
      : null;
const wrap = (p: Part, below: boolean): Part =>
  below ? { ...p, terms: ["(", ...p.terms, ")"], rank: 9 } : p;

/** A part's names and numbers; null for a part with no name or an operation the ⓘ does not write. */
function partOf(
  e: Expr,
  names: (e: Expr) => string | null,
  checks: string[],
): Part | null {
  const go = (x: Expr) => partOf(x, names, checks);
  switch (e.t) {
    case "def":
      return go(e.e);
    case "num": {
      const v = numOf(e.v);
      return v === null ? null : { terms: [fx3(v)], nums: [v], rank: 9 };
    }
    case "fn": {
      if (e.name === null || !FNS.has(e.name)) return null;
      const args = e.args.map(go);
      if (args.some((a) => a === null)) return null;
      const ps = args as Part[];
      return {
        terms: [
          e.name,
          "(",
          ...ps.flatMap((p, i) => (i === 0 ? p.terms : [",", ...p.terms])),
          ")",
        ],
        nums: ps.flatMap((p) => p.nums),
        rank: 9,
      };
    }
    case "op": {
      // `check && (…)`: the check goes to the ⓘ's words, the count is its right side
      if (e.o === "&&" && checkOf(e.l, names) !== null) {
        checks.push(
          `${checkOf(e.l, names) ?? ""}: ${numOf(e.l.v) ? "yes" : "no"}`,
        );
        return go(e.r);
      }
      const sym = SYMBOL[e.o];
      const rank = RANK[e.o];
      if (sym === undefined || rank === undefined) return null;
      const l = go(e.l);
      const r = go(e.r);
      if (!l || !r) return null;
      const L = wrap(l, l.rank < rank);
      const R = wrap(
        r,
        r.rank < rank || (r.rank === rank && "-/".includes(e.o)),
      );
      return {
        terms: [...L.terms, sym, ...R.terms],
        nums: [...L.nums, ...R.nums],
        rank,
      };
    }
    default: {
      const name = names(e);
      return name === null
        ? null
        : { terms: [name], nums: [numOf(e.v)], rank: 9 };
    }
  }
}

/** A check's words ("Invented Flag = 1"), or null when it is no check or a side has no name. */
function checkOf(e: Expr, names: (e: Expr) => string | null): string | null {
  if (e.t === "def") return checkOf(e.e, names);
  if (e.t !== "op" || CHECK[e.o] === undefined) return null;
  const l = partOf(e.l, names, []);
  const r = partOf(e.r, names, []);
  return l && r ? joined([...l.terms, CHECK[e.o] ?? "", ...r.terms]) : null;
}

/** Spaces between terms, none inside parentheses, before a comma or after a function's name (renderer/tree-text.ts). */
const joined = (terms: readonly string[]): string =>
  terms
    .join(" ")
    .replace(/\( /g, "(")
    .replace(/ \)/g, ")")
    .replace(/ ,/g, ",")
    .replace(/\b(min|max|pow|floor|ceil|round|abs|sqrt|log) \(/g, "$1(");

/** A level's ⓘ from its recorded expression, each part named by `names`; null when a part has no name. */
export function howItAddsUp(
  e: Expr,
  names: (e: Expr) => string | null,
): Formula {
  const checks: string[] = [];
  const p = partOf(e, names, checks);
  const result = numOf(e.v);
  if (!p || result === null) return null;
  if (checks.length === 0 && p.nums.every((n) => n !== null))
    return [p.terms, [...(p.nums as number[]), result]];
  let i = 0;
  const filled = p.terms.map((t) => {
    if (OPERATOR.test(t)) return t;
    const n = p.nums[i++];
    return n === null || n === undefined ? "?" : fx3(n);
  });
  const said = checks.length > 0 ? ` (${checks.join(", ")})` : "";
  return {
    rule: [`${joined(p.terms)}${said}`, `${joined(filled)} = ${fx3(result)}`],
  };
}

/** [F5-CURVE] the curve's two constants by their role in the game's curve (the 008's rule 159). */
const CONSTANTS: Readonly<Record<string, readonly [string, string]>> = {
  decay: ["Max bonus of the curve", "Level at half of the max"],
  decayMulti: ["Max bonus of the curve", "Level at half of the max"],
  intervalAdd: ["Base of the curve", "Levels for each +1"],
  add: ["Per-level bonus of the curve", "Growth of the per-level bonus"],
};

/**
 * A curve's ⓘ (FR-016, research R6): the curve with its input's name and its constants by their role, then with its
 * numbers; null when its numbers do not give `v` or the curve is not of the game's talent kinds.
 */
export function curveFormula(
  kind: string,
  x1: number,
  x2: number,
  x3: number,
  v: number,
  input: string,
): Formula {
  const names = Object.hasOwn(CONSTANTS, kind) ? CONSTANTS[kind] : undefined;
  if (!names) return null;
  const [A, B] = names;
  const L = input;
  const [a, b, l] = [fx3(x1), fx3(x2), fx3(x3)];
  const forms: Record<string, [number, string, string]> = {
    decay: [
      (x1 * x3) / (x3 + x2),
      `${A} × ${L} ÷ (${L} + ${B})`,
      `${a} × ${l} ÷ (${l} + ${b})`,
    ],
    decayMulti: [
      1 + (x1 * x3) / (x3 + x2),
      `1 + ${A} × ${L} ÷ (${L} + ${B})`,
      `1 + ${a} × ${l} ÷ (${l} + ${b})`,
    ],
    intervalAdd: [
      x1 + Math.floor(x3 / x2),
      `${A} + floor(${L} ÷ ${B})`,
      `${a} + floor(${l} ÷ ${b})`,
    ],
    add:
      x2 === 0
        ? [x1 * x3, `${A} × ${L}`, `${a} × ${l}`]
        : [
            x3 * (x1 + (x2 * (x3 + 1)) / 2),
            `${L} × (${A} + ${B} × (${L} + 1) ÷ 2)`,
            `${l} × (${a} + ${b} × (${l} + 1) ÷ 2)`,
          ],
  };
  const form = forms[kind];
  if (!form || !(Math.abs(form[0] - v) <= 1e-6 * Math.max(1, Math.abs(v))))
    return null;
  return { rule: [form[1], `${form[2]} = ${fx3(v)}`] };
}

/** The root's ⓘ: the pools joined in the game's order, a sum before a product in parentheses; none for one pool. */
export function rootFormula(
  pools: readonly {
    name: string;
    value: number;
    kind: "additive" | "multi";
  }[],
): Formula {
  if (pools.length < 2) return null;
  let terms: string[] = [];
  let sum = false;
  let total = 0;
  pools.forEach((p, i) => {
    if (i === 0) {
      terms = [p.name];
      total = p.value;
    } else if (p.kind === "additive") {
      terms = [...terms, "+", p.name];
      total += p.value;
      sum = true;
    } else {
      terms = [...(sum ? ["(", ...terms, ")"] : terms), "×", p.name];
      total *= p.value;
      sum = false;
    }
  });
  return [terms, [...pools.map((p) => p.value), total]];
}
