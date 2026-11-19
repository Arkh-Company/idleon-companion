// A Meritocracy vote's bonus, the week's or not (spec 009, FR-018, decision of 18/11: every value a system feeds shows
// that system as its child, even at 0). N.js Summoning2 "MeritocBonusz", in our words: bonus = (the vote's bonus in the
// Meritocracy table) × (Meritocracy bonus multiplier) while the vote is the week's, else 0. The game does not call the
// multiplier then; the recording calls it beside the root (tree-recipe.ts EXTRA_ROOTS), so its systems open here.
import { fx3 } from "./curves.ts";
import { near, vOf } from "./formulas.ts";
import type { Level } from "./places.ts";
import { callText, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { tableNumber } from "./table-names.ts";
import { built, fixedRow, renamed } from "./build-up-rows.ts";
import type { BuildUpContext, BuiltUp } from "./build-up-rows.ts";

const WEEK = "OptionsListAccount[453]";

const MULTI = 'Summoning("MeritocBonuszMulti"';

/** The week's vote t: its Vote bonus (the table's cell) × the Meritocracy bonus multiplier, and the week's vote. */
function weekVote(lv: Level, t: number): BuiltUp | null {
  const cell = `CustomLists.NinjaInfo[41][${String(1 + 3 * t)}]`;
  const bonus = lv.rows.find((r) => r.node.code === cell);
  const multi = lv.rows.find((r) => (r.node.code ?? "").startsWith(MULTI));
  const week = lv.rows.find((r) => r.node.code === WEEK);
  const v = vOf(lv.row);
  if (!bonus || !multi || !week || !near(vOf(bonus) * vOf(multi), v))
    return null;
  return built(
    lv,
    [
      renamed(bonus, "Vote bonus"),
      renamed(multi, "Meritocracy bonus multiplier"),
      week,
    ],
    [
      `Vote bonus × Meritocracy bonus multiplier, while the vote of the week is ${String(t)}`,
      `${fx3(vOf(bonus))} × ${fx3(vOf(multi))} = ${fx3(v)}`,
    ],
    true,
  );
}

/**
 * A vote t: the week's opens in its Vote bonus and the Meritocracy multiplier; one that is not the week's in its bonus,
 * the Meritocracy multiplier and the week's vote, its ⓘ why it is 0 (FR-018: the same whether or not it is the week's).
 */
export function meritocVote(lv: Level, ctx: BuildUpContext): BuiltUp | null {
  const call = lv.call;
  if (call?.b !== "Summoning2" || call.a[0] !== "MeritocBonusz") return null;
  const t = Number(call.a[1]);
  if (vOf(lv.row) !== 0) return weekVote(lv, t);
  const week = lv.rows.find((r) => r.node.code === WEEK);
  const multi = ctx.nodes.find(
    (n) =>
      n.b === "Summoning" &&
      n.a[0] === "MeritocBonuszMulti" &&
      typeof n.v === "number",
  );
  const bonus = tableNumber("vote", t);
  if (!week || vOf(week) === t || !multi || bonus === null || !ctx.keyOf)
    return null;
  const m: Row = {
    node: row({
      pieceKey: ctx.keyOf(multi),
      value: Number(multi.v),
      code: callText(multi),
      name: "Meritocracy bonus multiplier",
      kids: "lazy",
    }),
    open: multi.id,
  };
  return built(
    lv,
    [
      fixedRow(
        "Vote bonus",
        bonus,
        `CustomLists.NinjaInfo[41][${String(1 + 3 * t)}]`,
      ),
      m,
      week,
    ],
    [
      `Vote bonus × Meritocracy bonus multiplier while the vote of the week is ${String(t)}, else 0`,
      `the vote of the week is ${fx3(vOf(week))} → 0`,
    ],
    true,
  );
}
