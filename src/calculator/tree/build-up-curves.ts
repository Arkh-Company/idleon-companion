// Two more families of the full build-up (spec 009, FR-018; tree/build-up.ts):
// - a row with a name of its own that is a curve (a cache whose writer is one curve, as the family bonus of
//   FamBonusQTYs): its two constants by their role, its level, the curve in the ⓘ;
// - the Prisma multi (N.js ArcaneType "PrismaBonusMult": the min of 5 and 2 + the sum of its sources ÷ 100, the purple
//   sigils counting 0.2 each and the Rift Hivemind companion 50 times): its sources, with their weights in the ⓘ.
import { curveFormula, curvePart, fx3, maxReachedOf } from "./curves.ts";
import type { Curve } from "./curves.ts";
import { near, vOf } from "./formulas.ts";
import type { Level } from "./places.ts";
import type { Row } from "./rows.ts";
import { termOf } from "./share.ts";
import { built, constRows, rolesOf } from "./build-up-rows.ts";
import type { BuildUpContext, BuiltUp } from "./build-up-rows.ts";

const KINDS = [
  "decay",
  "decayMulti",
  "intervalAdd",
  "add",
  "bigBase",
  "reduce",
];

/** A row that is a curve: its constants named by their role in the curve, and the curve in its ⓘ by those names. */
export function curveSelf(lv: Level, ctx: BuildUpContext): BuiltUp | null {
  const input = lv.rows.at(-1);
  const consts = lv.rows.slice(0, -1);
  const v = vOf(lv.row);
  // (the curve block's own row, "Curve: …", keeps the 008's form: its constants by their numbers)
  if (
    !input ||
    !consts.length ||
    consts.length > 2 ||
    (ctx.name ?? lv.row.node.name).startsWith("Curve: ")
  )
    return null;
  for (const k of KINDS) {
    if (
      !consts.every(
        (r, i) =>
          r.node.code === null && r.node.name === curvePart(k, i === 0 ? 1 : 2),
      )
    )
      continue;
    const [first, second] = consts;
    if (!first) return null;
    const c: Curve = [k, vOf(first), second ? vOf(second) : 0, vOf(input)];
    const roles = rolesOf(c);
    const f = roles && curveFormula(c, v, termOf(input.node), roles);
    const reached = maxReachedOf(c, v);
    if (roles && f)
      return {
        ...built(lv, [...constRows(c, roles), input], f),
        ...(reached ? { maxReached: reached } : {}),
      };
  }
  return null;
}

/** The weight of a source of the Prisma multi (N.js ArcaneType "PrismaBonusMult"). */
const prismaWeight = (code: string): number =>
  code.startsWith('Labb("TotalPurpleSigils"')
    ? 0.2
    : code === "Companions(88)"
      ? 50
      : 1;

/** The Prisma multi: its sources, each with its weight, in the min of 5 and 2 + their sum ÷ 100. */
export function prisma(lv: Level): BuiltUp | null {
  if (
    lv.row.node.code !== 'ArcaneType("PrismaBonusMult", 0, 0)' ||
    !lv.rows.length
  )
    return null;
  const w = (r: Row) => prismaWeight(r.node.code ?? "");
  const sum = lv.rows.reduce((a, r) => a + w(r) * vOf(r), 0);
  const v = vOf(lv.row);
  if (!Number.isFinite(sum) || !near(Math.min(5, 2 + sum / 100), v))
    return null;
  const part = (r: Row, x: string) => (w(r) === 1 ? x : `${fx3(w(r))} × ${x}`);
  const names = lv.rows.map((r) => part(r, termOf(r.node))).join(" + ");
  const nums = lv.rows.map((r) => part(r, fx3(vOf(r)))).join(" + ");
  return built(lv, lv.rows, [
    `min(5, 2 + (${names}) ÷ 100)`,
    `min(5, 2 + (${nums}) ÷ 100) = ${fx3(v)}`,
  ]);
}
