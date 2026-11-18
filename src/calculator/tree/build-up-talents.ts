// The full build-up of a talent (spec 009, FR-018; tree/build-up.ts), by the game's code:
// - N.js GetTalentNumber: `0 >= SkillLevels[t] ? 0 : curve(TalentDescriptions[t][1], SkillLevels[t] + AllTalentLV(t))`,
//   50 in a dungeon: Talent level = Points invested + All-talent levels, and the curve's two constants;
// - N.js Thingies "LegendPTS_bonus": `round(Spelunk[18][i] × LegendTalents[i][2])`: Points and Bonus per point.
import { curveFormula, curveOf, fx3 } from "./curves.ts";
import { near, vOf } from "./formulas.ts";
import type { Level } from "./places.ts";
import type { Row } from "./rows.ts";
import { tableNumber } from "./table-names.ts";
import {
  built,
  codeOf,
  constRows,
  fixedRow,
  groupRow,
  parts,
  renamed,
  rolesOf,
} from "./build-up-rows.ts";
import type { BuildUpContext, BuiltUp } from "./build-up-rows.ts";

const ALL_TALENT = /^RunCodeOfTypeXforThingY\("AllTalentLVz?"/;

/** A talent: Talent level (Points invested + All-talent levels, or the dungeon's 50) and the curve's constants. */
export function talent(lv: Level, ctx: BuildUpContext): BuiltUp | null {
  const call = lv.call;
  const v = vOf(lv.row);
  if (call?.b !== "GetTalentNumber" || !v) return null;
  const cv = call.c
    .map((id) => ctx.nodes[id])
    .find((k) => k?.b === "ArbitraryCode5Inputs");
  const c = cv ? curveOf(cv.b, cv.a) : null;
  const roles = c && rolesOf(c);
  if (!c || !roles) return null;
  const pts = lv.rows.find(
    (r) => r.node.code === `SkillLevels[${String(call.a[1])}]`,
  );
  const all = lv.rows.find((r) => ALL_TALENT.test(codeOf(r)));
  const level =
    pts && all && near(vOf(pts) + vOf(all), c[3])
      ? groupRow("Talent level", c[3], [renamed(pts, "Points invested"), all])
      : pts && !all && near(vOf(pts), c[3])
        ? renamed(pts, "Talent level")
        : !all && c[3] === 50
          ? fixedRow("Talent level (in a dungeon)", 50)
          : null;
  const f = level && curveFormula(c, v, level.node.name, roles);
  return level && f ? built(lv, [level, ...constRows(c, roles)], f) : null;
}

/**
 * The Legend Talents whose max level grows past the table's (N.js Thingies "LegendTalent_MaxLV": a Research grid bonus
 * for 20 of them, 3 more with a Menagerie unlock for 9).
 */
const GROWN_MAX = new Set([
  2, 13, 3, 18, 5, 9, 23, 33, 1, 16, 20, 31, 19, 27, 8, 34, 30, 29, 6, 26, 35,
  36, 0, 15, 32,
]);

/** A Legend Talent: its Points (with their max when the game read it) and its Bonus per point. */
export function legendTalent(lv: Level): BuiltUp | null {
  const call = lv.call;
  if (call?.b !== "Thingies" || call.a[0] !== "LegendPTS_bonus") return null;
  const table = `CustomLists.LegendTalents[${String(call.a[1])}]`;
  const read = (p: string) => (call.r ?? []).find(([q]) => q === p)?.[1];
  const per = Number(read(`${table}[2]`));
  // the table's max is the talent's own only when no Research grid bonus nor the Menagerie raises it
  const max = GROWN_MAX.has(Number(call.a[1]))
    ? undefined
    : (read(`${table}[1]`) ??
      tableNumber("legendMax", Number(call.a[1])) ??
      undefined);
  const [pts, ...more] = parts(lv.rows);
  const v = vOf(lv.row);
  if (!pts || more.length || !Number.isFinite(per)) return null;
  const p = vOf(pts);
  // the game rounds the product (N.js Thingies "LegendPTS_bonus")
  const round = near(Math.round(p * per), v);
  if (!round && !near(p * per, v)) return null;
  const nums = `${fx3(p)} × ${fx3(per)}`;
  return built(
    lv,
    [
      renamed(
        pts,
        max === undefined ? "Points" : `Points (max ${String(max)})`,
      ),
      fixedRow("Bonus per point", per, `${table}[2]`),
    ],
    round
      ? ["round(Points × Bonus per point)", `round(${nums}) = ${fx3(v)}`]
      : ["Points × Bonus per point", `${nums} = ${fx3(v)}`],
  );
}

const SUPER_LIST = /^Spelunk\[\d+\]\[\d+\]$/;
const SUPER_GIVEN = 'Thingies("SuperTalentPTS_LVgiven"';

/**
 * What a source adds to the sum of the All-talent levels (N.js RunCodeOfTypeXforThingY "AllTalentLV"): a minor link of
 * Divinity rounded up, the family bonus rounded down, 5 per 100 Sneaking masteries over the first 3, the Universe
 * Talent up to 5, the class levels over 500 by the Super Bit 47; the slot and the class level alone add nothing.
 */
function addsToSum(r: Row, rows: readonly Row[]): number {
  const code = codeOf(r);
  const x = vOf(r);
  if (code.startsWith('Divinity("Bonus_Minor"')) return Math.ceil(x);
  if (code.startsWith("DNSM.FamBonusQTYs[")) return Math.floor(x);
  if (code === "OptionsListAccount[232]") return 5 * Math.floor((97 + x) / 100);
  if (code.startsWith('ArcaneType("ArcaneUpgBonus", 57,'))
    return Math.min(5, x);
  if (code.startsWith('GamingStatType("SuperBitType", 47,')) {
    const lv = rows.find((k) => codeOf(k) === "Lv0[0]");
    return lv ? Math.max(0, Math.floor(((vOf(lv) - 500) / 100) * x)) : NaN;
  }
  if (code === "Lv0[0]" || code === "DNSM.AllTalWhichPlayer") return 0;
  return x;
}

/**
 * The All-talent levels of a talent (N.js RunCodeOfTypeXforThingY "AllTalentLV": the floor of the min of its cap and
 * the sum of its sources, plus the Super Talent levels when the talent is on the preset's list): its sources, the Super
 * Talent levels at what the game counted; the checks (the talent's points > 0.5, banned), the preset in use, its list of
 * Super Talents and the talent's own points (its Points invested, above) are in the ⓘ only. Null when the sum does not
 * give the value: the rows stay as they are.
 */
export function allTalentLevels(lv: Level): BuiltUp | null {
  const call = lv.call;
  const v = vOf(lv.row);
  if (
    call?.b !== "RunCodeOfTypeXforThingY" ||
    !/^AllTalentLVz?$/.test(String(call.a[0])) ||
    !v
  )
    return null;
  const read = (p: string) => Number(call.r?.find(([q]) => q === p)?.[1]);
  const cap = read("DNSM.AllTalMaxCapFR");
  const extra = read("DNSM.AllTalMaxSUPERdn");
  const t = Number(String(call.a[1]).split("|")[0]);
  const aside = (r: Row) =>
    (r.node.leaf === "choice" && SUPER_LIST.test(codeOf(r))) ||
    codeOf(r) === "PlayerStuff[1]" ||
    codeOf(r) === `SkillLevels[${String(t)}]`;
  const sources = parts(lv.rows).filter((r) => !aside(r));
  const given = sources.find((r) => codeOf(r).startsWith(SUPER_GIVEN));
  const sum = sources
    .filter((r) => r !== given)
    .reduce((a, r) => a + addsToSum(r, sources), 0);
  if (
    !Number.isFinite(cap) ||
    !Number.isFinite(extra) ||
    !Number.isFinite(sum) ||
    Math.floor(Math.min(cap, sum) + extra) !== v
  )
    return null;
  // off the list, the Super Talent levels count 0, and the row says what they would give
  const off = (r: Row): Row =>
    groupRow(
      `Super Talent levels (would give ${fx3(vOf(r))})`,
      0,
      [r],
      [
        "Super Talent levels given, while the talent is on the preset's list of Super Talents",
        "not on the list → 0",
      ],
    );
  const rows = sources.map((r) => (r === given && extra === 0 ? off(r) : r));
  return built(lv, rows, [
    "floor(min(Cap, sum of the sources) + Super Talent levels)",
    `floor(min(${fx3(cap)}, ${fx3(sum)}) + ${fx3(extra)}) = ${fx3(v)}`,
  ]);
}
