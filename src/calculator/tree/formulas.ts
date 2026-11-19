// The ⓘ of a branch from its parts (spec 008, T022, "How it adds up"): the port of formulas.cjs `addFormulas` for one
// row, from the bench at BASELINE-4, run when the row's own rows are built (a lazy branch, on expand). In the bench's
// order: deep-2 (RiftSkillBonus), `formulaOf` (the product or the sum of the parts), the game's expression around the
// row (`xformula`, its parts found by their code), `ifFormula` and `checksFormula` (a value picked by a yes/no), the
// weak expression (`xweak`), then `lastFormula` (the forms the game uses most). A part's term is its name, or the game's
// path when it has no name yet (FR-012a); a Condition's is its comparison. Left out: the ⓘ of `formulaOf` (A), a branch
// named by its own sum with numbers (its sum is the row's `xformula` already; its rename by shape is tree/shapes.ts's,
// when the branch is built); `lastFormula` on a curve call (the curve block is a branch of its own with its formula,
// rows.ts); `borrowStep` (it reads a game table the recording does not keep). The R1 source names are rows.ts `finish`'s.
import type { CalcTreeNode } from "../tree-contract.ts";
import { fx3 } from "./curves.ts";
import { formulaOut } from "./math.ts";
import { descText, withText } from "./name-descs.ts";
import { withShares } from "./rows.ts";
import type { Row } from "./rows.ts";
import { termOf } from "./share.ts";

/** A formula pair as the bench writes it: [the line with names, the line with numbers = value]. */
export type Pair = [names: string, numbers: string];

/** formulas.cjs `near`: equal within 1e-6 of the second number, relative. */
export const near = (a: number, c: number) =>
  Math.abs(a - c) <= 1e-6 * Math.max(1, Math.abs(c));
const f = (v: number) => fx3(v);
/** What a part is read by: its node and, for a Condition, its comparison. */
type Part = Pick<Row, "node" | "test">;
export const vOf = (r: Part): number => {
  const v = r.node.value;
  return typeof v === "boolean" ? Number(v) : (v ?? NaN);
};
export const isCond = (r: Part) => r.node.leaf === "condition";
/**
 * The parts at ×1 the ⓘ leaves aside, as the bench's "N more parts at ×1" does: those rows.ts `finish` marked where the
 * 008 grouped them. They stay in their places on screen (spec 009, FR-016).
 */
export const atOneParts = (kids: readonly Row[]): ReadonlySet<Row> =>
  new Set(kids.filter((k) => k.asideAtOne));
const kidsOf = (r: Row) => r.group ?? [];
/** What the bench's `k.name` is here: a Condition's comparison, a row's term (its name, or its path with no name). */
const nameOf = (r: Part) => (isCond(r) && r.test ? r.test : termOf(r.node));
/** formulas.cjs `short`, on a named row only: its tag in parentheses and its " · …" go; a path stays whole. */
function short(r: Part): string {
  const t = nameOf(r).trim();
  if (isCond(r) || r.node.flags.unnamed) return t;
  if (
    /^(min|max|pow|floor|ceil)\(/.test(t) ||
    (/\d/.test(t) &&
      /[×÷+−]/.test(t) &&
      !/[a-z]{3,}/i.test(t.replace(/min|max|pow|floor|ceil/g, "")))
  )
    return /^(min|max|pow|floor|ceil)\(.*\)$/.test(t) ? t : `(${t})`;
  return t
    .replace(/\s*\(.*?\)\s*$/, "")
    .replace(/ · .*$/, "")
    .trim();
}
/** The names the assembly gives a constant of the code by its place (terms.ts), never a bonus name. */
const CONSTANT_NAME =
  /^(?:(?:Base|Minus|Cap|Divided by|Exponent|Minimum|Fixed value|Percent to number)\b|Fixed [+×]|× )/;
/** The names terms.ts `numRole` gives a constant that multiplies or divides what it stands beside (009 r2). */
const SCALING_NAME = /^(?:× |Divided by |Percent to number \(÷ 100\)$|Fixed ×)/;
/** A constant of the code that only multiplies or divides: "× 2", "Divided by 3", "Percent to number (÷ 100)", "Fixed ×2". */
export const isScaling = (n: Pick<Row["node"], "leaf" | "code" | "name">) =>
  isConstant(n) && SCALING_NAME.test(n.name);
/** A constant of the code named by its place: a fixed value with no code of its own, never a bonus's proven name. */
export const isConstant = (n: Pick<Row["node"], "leaf" | "code" | "name">) =>
  n.leaf === "fixedValue" && n.code === null && CONSTANT_NAME.test(n.name);
/** A constant of the code is written as its number; any other part by its term. */
const asNum = (r: Row) => (isConstant(r.node) ? f(vOf(r)) : short(r));
const isCurve = (r: Row) => r.node.name.startsWith("Curve: ");
/** formulas.cjs `partName`: a curve is "curve of" its input. */
function partName(r: Row): string {
  if (!isCurve(r)) return short(r);
  const input = kidsOf(r).at(-1);
  return input ? `curve of ${short(input)}` : "curve";
}
const unique = (xs: string[]) => new Set(xs).size === xs.length;
/** The row's parts, which a formula may name (those at ×1 too). */
const poolOf = (kids: readonly Row[]) => kids;
const COMPARE = / [=≠<>≤≥] /;
/** A check whose text a reader cannot follow ("0 = 0 and …"). */
const unclean = (c: Row) =>
  /^(\d|Value\b|If )/.test(nameOf(c)) || / \d+ = \d+/.test(nameOf(c));

/** The row an ⓘ is made for: its node, and the game's expressions around it (pieces.cjs `xformula`, `xweak`). */
export type FormulaRow = Pick<Row, "node" | "xf" | "xweak" | "f">;

/** formulas.cjs `formulaOf` (B): the parts' product or sum gives the row's value. */
function formulaOf(n: FormulaRow, all: readonly Row[]): Pair | null {
  const aside = atOneParts(all);
  const kids = all.filter((k) => !aside.has(k));
  const grouped = aside.size > 0;
  if (kids.some(isCond)) return null;
  if (kids.length < 2 || !kids.every((k) => Number.isFinite(vOf(k))))
    return null;
  const v = vOf(n);
  const prod = kids.reduce((a, k) => a * vOf(k), 1);
  const sum = kids.reduce((a, k) => a + vOf(k), 0);
  const op = near(prod, v) ? " × " : near(sum, v) && !grouped ? " + " : null;
  // (OPUS4-T4's test of the 0 a failed check returns is left out: that row always comes beside its check, which stops
  // this form above)
  if (!op) return null;
  // a product that closes only because a part is 0 says nothing
  if (op === " × " && kids.some((k) => vOf(k) === 0)) return null;
  if (!unique(kids.map(short))) return null;
  return [
    kids.map(asNum).join(op),
    `${kids.map((k) => f(vOf(k))).join(op)} = ${f(v)}`,
  ];
}

// A part of the game's expression inside an ⓘ line, until the row's parts are built: three private marks no line has.
const [TL, TM, TR] = ["\u0001", "\u0002", "\u0003"];
const TOKEN = new RegExp(`${TL}([^${TM}]*)${TM}([^${TR}]*)${TR}`, "g");
/** A part of an expression, found among the row's parts by `key` ("c:path@value", "c:call", "v:value"), else `fallback`. */
export const token = (key: string, fallback: string): string =>
  `${TL}${key}${TM}${fallback}${TR}`;
/** formulas.cjs `resolveParts`: each part of the game's expression named as the row that shows it. */
function resolveParts(kids: readonly Row[], text: string): string {
  const pool = poolOf(kids);
  const plain = (x: Row, v: number) =>
    !x.node.code && near(vOf(x), v) && !isCond(x) && !COMPARE.test(nameOf(x));
  return text.replace(TOKEN, (_m, key: string, fallback: string) => {
    if (key.startsWith("c:")) {
      const at = key.lastIndexOf("@");
      const c = at > 0 ? key.slice(2, at) : key.slice(2);
      const k = pool.find((x) => x.node.code === c);
      // [NR-C] a condition is no factor: its read keeps its own term
      if (k && isCond(k)) return fallback;
      if (k) return partName(k);
      const v = Number(key.slice(at + 1));
      // [R1-PATCH] a call that is one row of the branch of its expression: that branch, when it has the value read
      const br = pool.filter(
        (x) =>
          !x.node.code &&
          near(vOf(x), v) &&
          kidsOf(x).some((y) => y.node.code === c),
      );
      if (br.length === 1 && br[0]) return partName(br[0]);
      const same = pool.filter((x) => plain(x, v));
      return same.length === 1 && same[0] ? partName(same[0]) : fallback;
    }
    const v = Number(key.slice(2));
    // a yes/no never names a number of the sum
    const same = pool.filter(
      (x) => near(vOf(x), v) && !isCond(x) && !COMPARE.test(nameOf(x)),
    );
    return same.length === 1 && same[0] ? partName(same[0]) : fallback;
  });
}

/** formulas.cjs `checksFormula`: the parts beside the checks make the sum or the product, or the one check failed. */
function checksFormula(n: FormulaRow, kids: readonly Row[]): Pair | null {
  const conds = kids.filter((k) => isCond(k) && !kidsOf(k).length);
  if (!conds.length) return null;
  const aside = atOneParts(kids);
  const parts = kids.filter((k) => !isCond(k) && !aside.has(k));
  const v = vOf(n);
  if (
    parts.length >= 2 &&
    parts.every((k) => Number.isFinite(vOf(k))) &&
    unique(parts.map(short))
  ) {
    const sum = parts.reduce((a, k) => a + vOf(k), 0);
    const prod = parts.reduce((a, k) => a * vOf(k), 1);
    const op = near(sum, v) ? " + " : near(prod, v) && v !== 0 ? " × " : null;
    if (op)
      return [
        parts.map(asNum).join(op),
        `${parts.map((k) => f(vOf(k))).join(op)} = ${f(v)}`,
      ];
  }
  const [c] = conds;
  const same = parts.filter((k) => near(vOf(k), v));
  // [NR-C] a curve's own ⓘ says more
  if (
    conds.length === 1 &&
    c &&
    vOf(c) === 0 &&
    !unclean(c) &&
    same.length === 1 &&
    same[0] &&
    !isCurve(same[0])
  )
    return [`If not (${short(c)}): ${short(same[0])}`, `no → ${f(v)}`];
  return null;
}

/** formulas.cjs `ifFormula`: the value the game picks with a yes/no. */
function ifFormula(n: FormulaRow, kids: readonly Row[]): Pair | null {
  const pool = poolOf(kids);
  let conds = pool.filter((k) => isCond(k) && !kidsOf(k).length);
  // a check that is only the start of another is left out
  conds = conds.filter(
    (c) => !conds.some((d) => d !== c && nameOf(d).startsWith(`${nameOf(c)} `)),
  );
  conds = conds.filter((c) => !unclean(c));
  if (!conds.length) return null;
  const v = vOf(n);
  const said = (c: Row) => (vOf(c) !== 0 ? short(c) : `not (${short(c)})`);
  // [NR-C] D-R5: the literal the block returns when its checks pass is said with all its checks
  const fixed = pool.filter(
    (k) =>
      k.node.leaf === "fixedValue" &&
      k.node.name === "Fixed value" &&
      near(vOf(k), v),
  );
  if (fixed.length === 1 && fixed[0] && conds.some((c) => vOf(c) !== 0))
    return [
      `If ${conds.map(said).join(" and ")}: ${f(vOf(fixed[0]))}`,
      `yes → ${f(v)}`,
    ];
  // r3-g3: a 1 the block returns when all its checks pass, with no part of that value
  if (
    conds.length > 1 &&
    v === 1 &&
    conds.some((c) => vOf(c) === 1) &&
    !pool.some((k) => !isCond(k) && near(vOf(k), 1))
  )
    return [`If ${conds.map(said).join(" and ")}: 1`, "yes → 1"];
  const [c] = conds;
  // only one check that passed: a failed one is said by checksFormula (OPUS4-T3's failed check beside the 0 it returns,
  // the outcome row of once.ts, comes with no other check, and checksFormula says it the same way)
  if (!c || conds.length !== 1 || vOf(c) === 0) return null;
  if (
    /^(RunCodeOfTypeXforThingY\("CardLv"|GetTalentNumber|getbonus2|RunCodeOfTypeXforThingY\("AllTalentLV)/.test(
      n.node.code ?? "",
    )
  )
    return null;
  const part = pool.filter((k) => !isCond(k) && near(vOf(k), v));
  // a whole number with no part is the code's literal (the bench's own 0/1 of the yes/no is that literal too: a check is
  // 1 when it passes, and a failed one reaches here only beside the row of its 0)
  const literal = !part.length && Number.isInteger(v) && v !== 0;
  if (part.length !== 1 && !literal) return null;
  const value = literal || !part[0] ? f(v) : asNum(part[0]);
  return [`If ${short(c)}: ${value}`, `yes → ${f(v)}`];
}

/** formulas.cjs `sumOfAllKids` (B2-5): the parts, the yes/no ones too, add up to the sum the weak expression starts from. */
function sumOfAllKids(n: FormulaRow, kids: readonly Row[]): boolean {
  const ks = kids.filter((k) => Number.isFinite(vOf(k)));
  const base = /^-?[\d.]+/.exec((n.xweak?.[1] ?? "").replace(/,/g, ""));
  return (
    ks.some(isCond) &&
    ks.filter((k) => !isCond(k)).length >= 2 &&
    !!base &&
    Math.abs(ks.reduce((a, k) => a + vOf(k), 0) - Number(base[0])) <=
      1e-4 * Math.max(1, Math.abs(Number(base[0])))
  );
}

/** formulas.cjs `lastFormula`: a curve part with the row's value, or one of the forms the game uses most. */
function lastFormula(n: FormulaRow, kids: readonly Row[]): Pair | null {
  const v = vOf(n);
  const curves = kids.filter((k) => isCurve(k) && k.f && near(vOf(k), v));
  if (curves.length === 1 && curves[0]?.f) return curves[0].f;
  const aside = atOneParts(kids);
  const parts = kids.filter(
    (k) => !isCond(k) && !aside.has(k) && Number.isFinite(vOf(k)),
  );
  if (!parts.length) return null;
  const shorts = parts.map(short);
  const nm = unique(shorts)
    ? shorts
    : parts.map((k) =>
        nameOf(k)
          .replace(/ · .*$/, "")
          .trim(),
      );
  if (!unique(nm)) return null;
  const nums = parts.map((k) => f(vOf(k)));
  const S = parts.reduce((a, k) => a + vOf(k), 0);
  const P = parts.reduce((a, k) => a * vOf(k), 1);
  const one = parts.length === 1;
  const sumN = one ? nm.join("") : `(${nm.join(" + ")})`;
  const sumV = one ? nums.join("") : `(${nums.join(" + ")})`;
  const prodN = one ? nm.join("") : `(${nm.join(" × ")})`;
  const prodV = one ? nums.join("") : `(${nums.join(" × ")})`;
  const forms: [number | false, string, string][] = [
    [!one && S, nm.join(" + "), nums.join(" + ")],
    // a product that closes only by a 0 says nothing (rule 24)
    [
      !one && !parts.some((k) => vOf(k) === 0) && P,
      nm.join(" × "),
      nums.join(" × "),
    ],
    [1 + S / 100, `1 + ${sumN} ÷ 100`, `1 + ${sumV} ÷ 100`],
    [S / 100, `${sumN} ÷ 100`, `${sumV} ÷ 100`],
    [!one && 1 + P / 100, `1 + ${prodN} ÷ 100`, `1 + ${prodV} ÷ 100`],
    [!one && P / 100, `${prodN} ÷ 100`, `${prodV} ÷ 100`],
  ];
  for (const [val, a, b] of forms)
    if (val !== false && Number.isFinite(val) && near(val, v))
      return [a, `${b} = ${f(v)}`];
  return null;
}

/**
 * deep-2 (N.js RiftStuff): RiftSkillBonus of skill s and limit t is 1 when the Rift level is 15 or more and the skill's
 * rank is above t, else 0; the row may carry a weight its parent gives it.
 */
function riftSkill(n: FormulaRow, kids: readonly Row[]): Pair | null {
  const rs = /^RiftStuff\("RiftSkillBonus,\d+", (\d+)\)$/.exec(
    n.node.code ?? "",
  );
  const lvl = kids.find((k) => k.node.code === "Rift[0]");
  const rank = kids.find((k) =>
    /^DNSM\.skillLvRanks\[\d+\]$/.test(k.node.code ?? ""),
  );
  if (!rs?.[1] || !lvl || !rank) return null;
  const v = vOf(n);
  const res = vOf(lvl) >= 15 && vOf(rank) > Number(rs[1]) ? 1 : 0;
  const weight = res ? v / res : 1;
  const rule = `1 if ${short(lvl)} ≥ 15 and ${short(rank)} > ${rs[1]}, else 0`;
  const numbers =
    vOf(lvl) >= 15
      ? `${String(vOf(lvl))} ≥ 15 and ${String(vOf(rank))}${res ? " > " : " ≤ "}${rs[1]} → ${String(res)}`
      : `${String(vOf(lvl))} < 15 → 0`;
  return weight === 1
    ? [rule, numbers]
    : [`${f(weight)} × (${rule})`, `${f(weight)} × ${String(res)} = ${f(v)}`];
}

/** The ⓘ of row `n` from its built rows `kids`, in the bench's order; null when none closes. */
export function formulaFor(n: FormulaRow, kids: readonly Row[]): Pair | null {
  if (n.f) return n.f;
  if (!kids.length) return null;
  let fm = riftSkill(n, kids) ?? formulaOf(n, kids);
  if (!fm && n.xf) {
    fm = [resolveParts(kids, n.xf[0]), n.xf[1]];
    // a formula that only repeats the row's own term ("6 × the row") gives way to its "If"
    const own = short(n);
    if (own && fm[0].split(own).length === 2 && /^[\d.]+ × /.test(fm[0]))
      fm = ifFormula(n, kids) ?? fm;
  }
  if (!fm) {
    let f0 = ifFormula(n, kids) ?? checksFormula(n, kids);
    // B2-5: a sum that counts its yes/no among its terms is said by its expression
    if (f0 && n.xweak && f0[0].startsWith("If ") && sumOfAllKids(n, kids))
      f0 = null;
    fm = f0;
  }
  if (!fm && n.xweak) fm = [resolveParts(kids, n.xweak[0]), n.xweak[1]];
  // ([NR-C]'s test of an ⓘ that names the group of the parts at ×1 is left out: the app has no such group, spec 009
  // FR-016)
  fm ??= lastFormula(n, kids);
  // a formula that only adds zeros to its own result, over cache paths, says nothing
  if (
    fm &&
    fm[0].includes("DNSM.") &&
    /^(0 \+ )+(-?[\d.]+) = \2$|^(-?[\d.]+)( \+ 0)+ = \3$/.test(fm[1])
  )
    fm = null;
  return fm;
}

/**
 * The terms a formula may name that have a bracket or a comma (a call, a table cell), kept whole when it is split into
 * atoms (math.ts `formulaAtoms`); any other term splits right by itself, and a constant's name ("× 2") is no term.
 */
export function termsOf(
  kids: readonly Row[],
  ...lines: (Pair | null | undefined)[]
): string[] {
  const pool = poolOf(kids);
  const fallbacks = lines.flatMap((l) =>
    [...(l?.[0] ?? "").matchAll(TOKEN)].map((m) => m[2] ?? ""),
  );
  return [
    ...pool.flatMap((k) => [nameOf(k), short(k), partName(k)]),
    ...fallbacks,
  ].filter((t) => /[(),[\]]/.test(t));
}

/**
 * The ⓘ of `row` as the contract writes it (atoms), once its rows are built, with the rows' shares read through it
 * (tree/share.ts); a row that has one already, the root and a group keep theirs.
 */
export function withFormula(
  row: FormulaRow,
  rows: Row[],
): { formula: CalcTreeNode["formula"]; rows: Row[] } {
  // fix/tree-names r2: a row made with the game's text as its ⓘ (tree/name-descs.ts) that has math of its own takes the
  // ⓘ of its math, the text beside it
  const own = row.node.formula;
  const text = descText(row.node.code);
  const made = own !== null && !Array.isArray(own) && own.rule[0] === text;
  if ((own && !made) || row.node.role === "root") return { formula: own, rows };
  const fm = formulaFor(row, rows);
  if (!fm) return { formula: own, rows };
  return {
    formula: withText(formulaOut(fm, termsOf(rows, row.xf, row.xweak)), text),
    rows: withShares(row.node, fm, rows).rows,
  };
}
