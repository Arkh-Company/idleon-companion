// The full build-up of a talent (spec 009, FR-018; tree/build-up.ts), in our words:
// - a talent (N.js GetTalentNumber): 0 with no points invested, else bonus = curve(L), with the level L = points invested
//   + all-talent levels (L = 50 in a dungeon): Talent level = Points invested + All-talent levels, and the curve's two
//   constants;
// - a Legend Talent (N.js Thingies "LegendPTS_bonus"): bonus = round(points × bonus per point): Points and Bonus per
//   point, the Points opening into the talent's max level.
import type { RecNode } from "../recording.ts";
import { curveFormula, curveOf, fx3, maxReachedOf } from "./curves.ts";
import { near, vOf } from "./formulas.ts";
import type { Level } from "./places.ts";
import { callText, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { termOf } from "./share.ts";
import {
  built,
  codeOf,
  constRows,
  curveIn,
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
  if (!level || !f) return null;
  // FR-015a: how much of the curve's max the talent reached
  const reached = maxReachedOf(c, v);
  return {
    ...built(lv, [level, ...constRows(c, roles)], f),
    ...(reached ? { maxReached: reached } : {}),
  };
}

/**
 * An account's talent (N.js getbonus2(1, talent, -1), audit families 1 and 8): the best of the characters' curves. Its
 * Talent level is the best character's points plus the All-talent levels, each character a row by its number; the curve
 * of each character is no row, the best one's in the ⓘ. Null when the rows do not give the value.
 */
export function accountTalent(lv: Level): BuiltUp | null {
  const call = lv.call;
  const v = vOf(lv.row);
  if (call?.b !== "getbonus2" || call.a[2] !== -1 || !v) return null;
  const own = new RegExp(
    `^PlayerDATABASE\\[\\d+\\]\\.SkillLevels\\[${String(call.a[1])}\\]$`,
  );
  const curves = lv.rows.filter((r) => curveIn(r) !== null);
  const chars = lv.rows.filter((r) => own.test(codeOf(r)));
  const all = lv.rows.find((r) => ALL_TALENT.test(codeOf(r)));
  const best = curves.find((r) => near(vOf(r), v));
  const c = best && curveIn(best);
  const roles = c && rolesOf(c);
  const top = Math.max(...chars.map(vOf));
  const rest = parts(lv.rows).filter(
    (r) => r !== all && !curves.includes(r) && !chars.includes(r),
  );
  if (!c || !roles || !chars.length || rest.length) return null;
  const add = all ? vOf(all) : 0;
  if (!near(top + add, c[3])) return null;
  const names = `max(${chars.map((r) => termOf(r.node)).join(", ")})`;
  const nums = `max(${chars.map((r) => fx3(vOf(r))).join(", ")})`;
  const level = groupRow(
    "Talent level",
    c[3],
    [...chars, ...(all ? [all] : [])],
    all
      ? [
          `${names} + ${termOf(all.node)}`,
          `${nums} + ${fx3(add)} = ${fx3(c[3])}`,
        ]
      : [names, `${nums} = ${fx3(c[3])}`],
  );
  const f = curveFormula(c, v, "Talent level", roles);
  if (!f) return null;
  const reached = maxReachedOf(c, v);
  return {
    ...built(lv, [level, ...constRows(c, roles)], f),
    ...(reached ? { maxReached: reached } : {}),
  };
}

const MAX_CALL = "LegendTalent_MaxLV";

/** The Points with the game's max, that opens into what makes it: the max caps the points the player spends. */
function withMax(pts: Row, max: RecNode, key: string): Row {
  const named = renamed(pts, `Points (max ${fx3(Number(max.v))})`);
  return {
    ...named,
    group: [
      {
        node: row({
          pieceKey: key,
          value: Number(max.v),
          code: callText(max),
          name: "Max points",
          kids: "lazy",
        }),
        open: max.id,
        ceiling: true,
      },
    ],
  };
}

/**
 * A Legend Talent: its Points, with the game's max of the talent (N.js Thingies "LegendTalent_MaxLV", recorded beside the
 * root: tree-recipe.ts `legendMaxRoots`) that opens into what makes it, and its Bonus per point.
 */
export function legendTalent(lv: Level, ctx: BuildUpContext): BuiltUp | null {
  const call = lv.call;
  if (call?.b !== "Thingies" || call.a[0] !== "LegendPTS_bonus") return null;
  const t = Number(call.a[1]);
  const table = `CustomLists.LegendTalents[${String(t)}]`;
  const per = Number((call.r ?? []).find(([q]) => q === `${table}[2]`)?.[1]);
  const [pts, ...more] = parts(lv.rows);
  const v = vOf(lv.row);
  if (!pts || more.length || !Number.isFinite(per)) return null;
  const p = vOf(pts);
  // the game rounds the product (N.js Thingies "LegendPTS_bonus")
  const round = near(Math.round(p * per), v);
  if (!round && !near(p * per, v)) return null;
  const nums = `${fx3(p)} × ${fx3(per)}`;
  const maxCall = ctx.nodes.find(
    (n) =>
      n.b === "Thingies" &&
      n.a[0] === MAX_CALL &&
      Number(n.a[1]) === t &&
      typeof n.v === "number",
  );
  const points =
    maxCall && ctx.keyOf
      ? withMax(pts, maxCall, ctx.keyOf(maxCall))
      : renamed(pts, "Points");
  return built(
    lv,
    [points, fixedRow("Bonus per point", per, `${table}[2]`)],
    round
      ? ["round(Points × Bonus per point)", `round(${nums}) = ${fx3(v)}`]
      : ["Points × Bonus per point", `${nums} = ${fx3(v)}`],
  );
}

/**
 * A Legend Talent's max level (N.js Thingies "LegendTalent_MaxLV"): the table's max, the Research grid bonus rounded
 * down, and 3 more with the Menagerie's unlock, for the systems the game called for this talent; each one a row. Null
 * when they do not give the max: the rows stay as they are.
 */
export function legendMax(lv: Level): BuiltUp | null {
  const call = lv.call;
  if (call?.b !== "Thingies" || call.a[0] !== MAX_CALL) return null;
  const path = `CustomLists.LegendTalents[${String(call.a[1])}][1]`;
  const base = Number((call.r ?? []).find(([q]) => q === path)?.[1]);
  const grid = lv.rows.find((r) =>
    codeOf(r).startsWith('ResearchStuff("Grid_Bonus"'),
  );
  const unlock = lv.rows.find((r) =>
    codeOf(r).startsWith('MenagerieStuff("UnlockOwned"'),
  );
  const v = vOf(lv.row);
  const sum =
    base + (grid ? Math.floor(vOf(grid)) : 0) + (unlock ? 3 * vOf(unlock) : 0);
  if (!Number.isFinite(sum) || !near(sum, v)) return null;
  const terms = [
    ["Max points of the table", fx3(base)],
    ...(grid
      ? [[`floor(${termOf(grid.node)})`, `floor(${fx3(vOf(grid))})`]]
      : []),
    ...(unlock
      ? [[`3 × ${termOf(unlock.node)}`, `3 × ${fx3(vOf(unlock))}`]]
      : []),
  ];
  return built(
    lv,
    [
      fixedRow("Max points of the table", base, path),
      ...(grid ? [grid] : []),
      ...(unlock ? [unlock] : []),
    ],
    [
      terms.map((x) => x[0]).join(" + "),
      `${terms.map((x) => x[1]).join(" + ")} = ${fx3(v)}`,
    ],
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
