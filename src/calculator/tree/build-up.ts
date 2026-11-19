// The full build-up of a bonus (spec 009, FR-018, decision of 18/11; pesquisa-contas.md), when a level gets its place
// (tree/places.ts): the level that enters the math is a row with the ⓘ of its sum, the curve is in the ⓘ with its
// constants named by their role, a constant is a row only when it is the bonus the game's screen shows, branch checks are
// never rows, and each multiplier is its own × row. Each rule is a family of the game's code, with its proof:
// - a talent and a Legend Talent (tree/build-up-talents.ts); a row that is a curve, and the Prisma multi
//   (tree/build-up-curves.ts);
// - a level that is a curve times its multipliers (N.js CauldronStats "BubbleBonus"): bubble bonus = curve(bubble
//   level) × Prisma multi for a Prisma bubble, else curve(bubble level): no "Curve" row, its level and constants;
// - a bubble times its class's bubble (N.js TalentCalc, the bubbles' cache): bonus × the class's multi, at least 1;
// - a sigil (N.js Labb "SigilBonus"): bonus = (bonus at its tier) × (1 + Chilled Yarn) × (1 + vote bonus ÷ 100), the
//   tier picking the table's column; the artifact = its base × its rarity's multiplier (N.js Sailing "ArtifactBonus");
// - a card's bonus, its level and an equipped card (tree/build-up-cards.ts).
import {
  curveFormula,
  curveOf,
  curveText,
  fx3,
  maxReachedOf,
} from "./curves.ts";
import { isCond, isConstant, near, vOf } from "./formulas.ts";
import type { Pair } from "./formulas.ts";
import type { Level } from "./places.ts";
import type { Row } from "./rows.ts";
import { termOf } from "./share.ts";
import { tableNumber } from "./table-names.ts";
import {
  built,
  codeOf,
  constRows,
  groupRow,
  parts,
  product,
  renamed,
  rolesOf,
  unwrap,
} from "./build-up-rows.ts";
import type { BuildUpContext, BuiltUp } from "./build-up-rows.ts";
import {
  accountTalent,
  allTalentLevels,
  legendMax,
  legendTalent,
  talent,
} from "./build-up-talents.ts";
import { curveSelf, prisma } from "./build-up-curves.ts";
import { meritocVote } from "./build-up-vote.ts";
import { cardBonus, cardStars, equippedCard } from "./build-up-cards.ts";

export type { BuiltUp } from "./build-up-rows.ts";

const CURVE_CALL = /^ArbitraryCode5Inputs\((.*)\)$/;

/** A level that is one curve times its multipliers: the curve's level and constants as rows, the curve in the ⓘ. */
function curveLevel(lv: Level): BuiltUp | null {
  const cr = lv.rows.find(
    (r) => r.node.name.startsWith("Curve: ") && (r.group?.length ?? 0) >= 2,
  );
  const args = cr && CURVE_CALL.exec(codeOf(cr))?.[1];
  const c = args
    ? curveOf("ArbitraryCode5Inputs", JSON.parse(`[${args}]`) as unknown[])
    : null;
  const roles = c && rolesOf(c);
  const last = cr?.group?.at(-1);
  if (!cr || !c || !roles || !last) return null;
  // the level the curve reads, once: the curve's own read, else the level's read of the same value
  const same = (r: Row) =>
    r !== cr && !r.group?.length && r.open === null && near(vOf(r), c[3]);
  const input = last.node.code
    ? last
    : (lv.rows.find((r) => same(r) && !isCond(r)) ?? last);
  const others = parts(lv.rows).filter(
    (r) =>
      r !== cr && r !== input && !(same(r) && r.node.code === input.node.code),
  );
  const v = vOf(lv.row);
  if (
    !others.every((r) => Number.isFinite(vOf(r))) ||
    !near(vOf(cr) * product(others), v)
  )
    return null;
  const name = codeOf(input).startsWith("CauldronInfo[")
    ? "Bubble level"
    : input.node.name;
  const base = curveFormula(c, vOf(cr), name, roles);
  if (!base) return null;
  const wrap =
    others.length > 0 && !(c[0] === "decay" || (c[0] === "add" && c[2] === 0));
  const w = (s: string) => (wrap ? `(${s})` : s);
  // a curve times a factor: the ⓘ says how much of its max the curve alone reached (decision of 18/11), so it is a rule
  const share = others.length ? maxReachedOf(c, vOf(cr)) : null;
  const note = share
    ? ` (the curve is at ${(share.share * 100).toFixed(1)}% of its max ${fx3(share.max)})`
    : "";
  const f: Pair = [
    [w(base[0]), ...others.map((r) => termOf(r.node))].join(" × ") + note,
    `${[w(curveText(c)), ...others.map((r) => fx3(vOf(r)))].join(" × ")} = ${fx3(v)}`,
  ];
  const up = built(
    lv,
    [renamed(input, name), ...constRows(c, roles), ...others],
    f,
    share !== null,
  );
  // FR-015a: the share of the max on the row only when the row is the curve alone
  const reached = others.length ? null : maxReachedOf(c, v);
  return reached ? { ...up, maxReached: reached } : up;
}

/** A bubble times its class's bubble (the cache of the bubbles): Bubble bonus × the class's multi. */
function bubbleClass(lv: Level): BuiltUp | null {
  if (!(lv.row.node.code ?? "").startsWith("DNSM.AlchBubbles.")) return null;
  const rows = parts(lv.rows).map(unwrap);
  const b = rows.find((r) =>
    codeOf(r).startsWith('CauldronStats("BubbleBonus"'),
  );
  const m = rows.find((r) => codeOf(r).startsWith("DNSM.AlchBubbles."));
  const v = vOf(lv.row);
  if (rows.length !== 2 || !b || !m || !near(vOf(b) * vOf(m), v)) return null;
  const multi = `${m.node.name.replace(/ bubble$/i, "")} multi`;
  return built(
    lv,
    [renamed(b, "Bubble bonus"), renamed(m, multi)],
    [`Bubble bonus × ${multi}`, `${fx3(vOf(b))} × ${fx3(vOf(m))} = ${fx3(v)}`],
  );
}

/** An artifact's bonus as its base × its rarity's multiplier (the code's "Fixed ×N"), or null. */
function artifactParts(rows0: readonly Row[], v: number): [Row, Row] | null {
  const rows = rows0.map(unwrap);
  const base = rows.find((r) =>
    codeOf(r).startsWith("CustomLists.ArtifactInfo["),
  );
  const rarity = rows.find(
    (r) => isConstant(r.node) && r.node.name.startsWith("Fixed ×"),
  );
  if (
    rows.length !== 2 ||
    !base ||
    !rarity ||
    !near(vOf(base) * vOf(rarity), v)
  )
    return null;
  return [
    renamed(base, "Artifact base", "fixedValue"),
    renamed(rarity, "Rarity multiplier", "tier"),
  ];
}

/** A sigil's multiplier "1 + …": the artifact's, by its base and rarity; the Meritocracy's, by the vote's bonus. */
function sigilMulti(r: Row, lv: Level, ctx: BuildUpContext): Row {
  const g = r.group ?? [];
  const v = vOf(r);
  const one = g.find((k) => isConstant(k.node) && vOf(k) === 1);
  const art = g.find((k) => codeOf(k).startsWith('Sailing("ArtifactBonus"'));
  if (art && one && g.length === 2 && near(1 + vOf(art), v)) {
    const got = ctx.under(art, { ...lv, row: r, rows: g });
    const ps = got && artifactParts(got.rows, vOf(art));
    const name = `${art.node.name} multi`;
    return ps
      ? groupRow(name, v, ps, [
          "1 + Artifact base × Rarity multiplier",
          `1 + ${fx3(vOf(ps[0]))} × ${fx3(vOf(ps[1]))} = ${fx3(v)}`,
        ])
      : renamed(r, name);
  }
  const vote = g.find((k) =>
    codeOf(k).startsWith('Summoning2("MeritocBonusz"'),
  );
  const hundred = g.find((k) => isConstant(k.node) && vOf(k) === 100);
  if (vote && one && hundred && g.length === 3 && near(1 + vOf(vote) / 100, v))
    // the code's 1 and ÷ 100 are in the ⓘ only
    return {
      ...renamed(r, "Meritocracy multi"),
      group: [vote],
      f: [
        `1 + ${termOf(vote.node)} ÷ 100`,
        `1 + ${fx3(vOf(vote))} ÷ 100 = ${fx3(v)}`,
      ],
    };
  return r;
}

/** The columns of SigilDesc the tier ladder picks, tier 0 to 4 (N.js Labb SigilBonus). */
const TIER_COLUMNS = [3, 4, 8, 10, 12];
/** The sigil's tier with the bonus of each tier in its ⓘ, from the checked table; as it is with no table. */
function tierRow(tier: Row, lv: Level, at: number): Row {
  const sigil = Number(
    lv.call?.a[2] ??
      /^Labb\("SigilBonus", "[^"]*", (\d+)/.exec(lv.row.node.code ?? "")?.[1],
  );
  const tiers = TIER_COLUMNS.map((c) => tableNumber("sigilTier", sigil, c));
  // the ladder is said only when the table gives the bonus at the sigil's tier
  const here = tiers[vOf(tier)];
  if (
    !Number.isInteger(sigil) ||
    tiers.some((x) => x === null) ||
    here == null ||
    !near(here, at)
  )
    return tier;
  return {
    ...tier,
    node: {
      ...tier.node,
      formula: {
        rule: [
          `tiers: ${tiers.map((x) => fx3(Number(x))).join(" / ")}`,
          `tier ${fx3(vOf(tier))} → ${fx3(at)}`,
        ],
      },
    },
  };
}

const SIGIL_CELL = /^CustomLists\.SigilDesc\[\d+\]\[\d+\]$/;
const SIGIL_TIER = /^CauldronP2W\[4\]\[\d+\]$/;

/** A sigil: its tier, the Bonus at tier and each multiplier; the ladder of checks that picks the tier's column goes. */
function sigil(lv: Level, ctx: BuildUpContext): BuiltUp | null {
  if (!(lv.row.node.code ?? "").startsWith('Labb("SigilBonus"')) return null;
  const at = lv.rows.find((r) => SIGIL_CELL.test(codeOf(r)));
  const tier = lv.rows.find((r) => SIGIL_TIER.test(codeOf(r)));
  const multis = parts(lv.rows).filter((r) => r !== at && r !== tier);
  const v = vOf(lv.row);
  if (!at || !tier || !near(vOf(at) * product(multis), v)) return null;
  const ms = multis.map((r) => sigilMulti(r, lv, ctx));
  return built(
    lv,
    [
      tierRow(renamed(tier, "Sigil tier", "tier"), lv, vOf(at)),
      renamed(at, "Bonus at tier"),
      ...ms,
    ],
    [
      ["Bonus at tier", ...ms.map((r) => termOf(r.node))].join(" × "),
      `${[vOf(at), ...ms.map(vOf)].map(fx3).join(" × ")} = ${fx3(v)}`,
    ],
  );
}

/** Level `lv` built up by the first family that knows it, or null. */
export function buildUp(lv: Level, ctx: BuildUpContext): BuiltUp | null {
  return (
    talent(lv, ctx) ??
    accountTalent(lv) ??
    legendTalent(lv, ctx) ??
    legendMax(lv) ??
    allTalentLevels(lv) ??
    prisma(lv) ??
    meritocVote(lv, ctx) ??
    curveSelf(lv, ctx) ??
    curveLevel(lv) ??
    bubbleClass(lv) ??
    sigil(lv, ctx) ??
    cardStars(lv) ??
    equippedCard(lv) ??
    cardBonus(lv)
  );
}

/**
 * A check of a row beside it, a state or a number ("Owned = 1" beside "Owned", "Bonus level > 0" beside "Bonus level"):
 * a branch check, never a row (FR-018; audit family 3).
 */
const COMPARISON = /^(.+?) (?:<|≤|>|≥|=|≠) -?[\d.]+$/;
export function branchCheck(r: Row, rows: readonly Row[]): boolean {
  if (!isCond(r) || r.open !== null || r.group?.length) return false;
  const subject = COMPARISON.exec(r.node.name)?.[1];
  return !!subject && rows.some((k) => k !== r && k.node.name === subject);
}

type Formula = Row["node"]["formula"];
const OPERATOR = /^[×÷+−*/(),^:-]$/;
/** Atoms as words, a space between two terms but inside brackets and before a comma. */
const joined = (ts: readonly string[]) =>
  ts.join(" ").replace(/\( /g, "(").replace(/ \)/g, ")").replace(/ ,/g, ",");
/** The two lines of an ⓘ. */
function linesOf(f: NonNullable<Formula>): [string, string] {
  if (!Array.isArray(f)) return f.rule;
  const [terms, numbers] = f;
  let i = 0;
  const filled = terms.map((t) =>
    OPERATOR.test(t) ? t : fx3(numbers[i++] ?? NaN),
  );
  return [joined(terms), `${joined(filled)} = ${fx3(numbers.at(-1) ?? NaN)}`];
}
const says = (f: Formula, r: Row) => !!f && linesOf(f)[0].includes(r.node.name);

/**
 * The ⓘ `f` that says each of `checks` (A39): those it does not say yet in words after its math ("(Bonus level > 0:
 * yes)"), as the card's stars; a rule then, its numbers line its math's. As it is when it says them all.
 */
export function citing(f: Formula, checks: readonly Row[]): Formula {
  const more = checks.filter((r) => !says(f, r));
  if (!f || !more.length) return f;
  const [names, numbers] = linesOf(f);
  const words = more.map((r) => `${r.node.name}: ${vOf(r) ? "yes" : "no"}`);
  return { rule: [`${names} (${words.join("; ")})`, numbers] };
}

/**
 * A level's rows once its ⓘ `f` is made: a branch check its ⓘ says is in the ⓘ only, never a row (FR-018, A39); with
 * no ⓘ, or one that does not say it, nothing leaves, so no comparison is lost.
 */
export function asideInFormula(rows: Row[], f: Formula): Row[] {
  return f ? rows.filter((r) => !(branchCheck(r, rows) && says(f, r))) : rows;
}
