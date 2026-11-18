// The full build-up of a talent (spec 009, FR-018; tree/build-up.ts), by the game's code:
// - N.js GetTalentNumber: `0 >= SkillLevels[t] ? 0 : curve(TalentDescriptions[t][1], SkillLevels[t] + AllTalentLV(t))`,
//   50 in a dungeon: Talent level = Points invested + All-talent levels, and the curve's two constants;
// - N.js Thingies "LegendPTS_bonus": `round(Spelunk[18][i] × LegendTalents[i][2])`: Points and Bonus per point.
import { curveFormula, curveOf, fx3 } from "./curves.ts";
import { near, vOf } from "./formulas.ts";
import type { Level } from "./places.ts";
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

/** A Legend Talent: its Points (with their max when the game read it) and its Bonus per point. */
export function legendTalent(lv: Level): BuiltUp | null {
  const call = lv.call;
  if (call?.b !== "Thingies" || call.a[0] !== "LegendPTS_bonus") return null;
  const table = `CustomLists.LegendTalents[${String(call.a[1])}]`;
  const read = (p: string) => (call.r ?? []).find(([q]) => q === p)?.[1];
  const per = Number(read(`${table}[2]`));
  const max = read(`${table}[1]`);
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

/** The All-talent levels of a talent: its sources. */
export function allTalentLevels(lv: Level): BuiltUp | null {
  return lv.call ? null : null;
}
