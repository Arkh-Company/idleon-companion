// The full build-up of a bonus (spec 009, FR-018, decision of 18/11; pesquisa-contas.md), when a level gets its place
// (tree/places.ts): the level that enters the math is a row with the ⓘ of its sum, the curve is in the ⓘ with its
// constants named by their role, a constant is a row only when it is the bonus the game's screen shows, branch checks are
// never rows, and each multiplier is its own × row. Each rule is a family of the game's code, with its proof:
// - a talent and a Legend Talent (tree/build-up-talents.ts); a row that is a curve, and the Prisma multi
//   (tree/build-up-curves.ts);
// - a level that is a curve times its multipliers (N.js CauldronStats "BubbleBonus": `curve(AlchemyDescription[c][i],
//   CauldronInfo[c][i]) × max(1, PrismaBonusMult)` when the bubble is Prisma): no "Curve" row, its level and constants;
// - a bubble times its class's bubble (N.js TalentCalc, the cache DNSM.AlchBubbles: `× max(1, AlchBubbles.Opassz)`);
// - a sigil (N.js Labb "SigilBonus": the table's value at the tier `CauldronP2W[4][1 + 2i]` picks, × (1 + Chilled
//   Yarn) × (1 + MeritocBonusz(21) ÷ 100)); the artifact is its base × its rarity (N.js Sailing "ArtifactBonus");
// - a card's bonus (N.js TotalStats: `min(1.5 × CardLv("mini5a"), 10)`): Card level and Bonus per level, the cap in the ⓘ.
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
import { allTalentLevels, legendTalent, talent } from "./build-up-talents.ts";
import { curveSelf, prisma } from "./build-up-curves.ts";
import { meritocVote } from "./build-up-vote.ts";

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
  const f: Pair = [
    [w(base[0]), ...others.map((r) => termOf(r.node))].join(" × "),
    `${[w(curveText(c)), ...others.map((r) => fx3(vOf(r)))].join(" × ")} = ${fx3(v)}`,
  ];
  const up = built(
    lv,
    [renamed(input, name), ...constRows(c, roles), ...others],
    f,
  );
  // FR-015a: the share of the max only when the row is the curve alone (a curve × Prisma is no curve's value)
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
    [renamed(tier, "Sigil tier", "tier"), renamed(at, "Bonus at tier"), ...ms],
    [
      ["Bonus at tier", ...ms.map((r) => termOf(r.node))].join(" × "),
      `${[vOf(at), ...ms.map(vOf)].map(fx3).join(" × ")} = ${fx3(v)}`,
    ],
  );
}

/** A card's bonus: its Card level and its Bonus per level (the code's "× N"); the cap ("Cap N") only in the ⓘ. */
function cardBonus(lv: Level): BuiltUp | null {
  const k = lv.rows.find(
    (r) => isConstant(r.node) && r.node.name.startsWith("× "),
  );
  const card = lv.rows.find((r) =>
    codeOf(r).startsWith('RunCodeOfTypeXforThingY("CardLv"'),
  );
  const cap = lv.rows.find(
    (r) => isConstant(r.node) && r.node.name.startsWith("Cap "),
  );
  if (!k || !card || lv.rows.length !== (cap ? 3 : 2)) return null;
  const [K, L, v] = [vOf(k), vOf(card), vOf(lv.row)];
  const rows = [renamed(card, "Card level"), renamed(k, "Bonus per level")];
  if (!cap)
    return near(K * L, v)
      ? built(lv, rows, [
          "Bonus per level × Card level",
          `${fx3(K)} × ${fx3(L)} = ${fx3(v)}`,
        ])
      : null;
  const C = vOf(cap);
  if (!near(Math.min(K * L, C), v)) return null;
  const capped = K * L > C && !near(K * L, C);
  return built(
    lv,
    rows,
    [
      "min(Bonus per level × Card level, Cap)",
      `min(${fx3(K)} × ${fx3(L)}, ${fx3(C)}) = ${fx3(v)}${capped ? " (capped)" : ""}`,
    ],
    capped,
  );
}

/** Level `lv` built up by the first family that knows it, or null. */
export function buildUp(lv: Level, ctx: BuildUpContext): BuiltUp | null {
  return (
    talent(lv, ctx) ??
    legendTalent(lv) ??
    allTalentLevels(lv) ??
    prisma(lv) ??
    meritocVote(lv, ctx) ??
    curveSelf(lv, ctx) ??
    curveLevel(lv) ??
    bubbleClass(lv) ??
    sigil(lv, ctx) ??
    cardBonus(lv)
  );
}

/** A check of a row beside it ("Bonus level > 0" beside "Bonus level"): a branch check, never a row (FR-018). */
const COMPARISON = /^(.+?) (?:<|≤|>|≥|=|≠) -?[\d.]+$/;
function branchCheck(r: Row, rows: readonly Row[]): boolean {
  if (!isCond(r) || r.open !== null || r.group?.length) return false;
  const subject = COMPARISON.exec(r.node.name)?.[1];
  return (
    !!subject &&
    rows.some((k) => k !== r && !isCond(k) && k.node.name === subject)
  );
}

/**
 * A level's rows once its ⓘ is made: a branch check is in the ⓘ only, never a row (FR-018); with no ⓘ, nothing leaves,
 * so no comparison is lost.
 */
export function asideInFormula(rows: Row[], hasFormula: boolean): Row[] {
  return hasFormula ? rows.filter((r) => !branchCheck(r, rows)) : rows;
}
