// A Meritocracy vote's bonus that is not the week's (spec 009, FR-018, decision of 18/11: every value a system feeds shows
// that system as its child, even at 0). N.js Summoning2 "MeritocBonusz": while the vote t is the week's vote
// (OptionsListAccount[453]), the bonus of the vote in the table (NinjaInfo[41][1 + 3t]) × the Meritocracy bonus
// multiplier (Summoning "MeritocBonuszMulti"), else 0. The game does not call the multiplier then; the recording calls it
// beside the root (tree-recipe.ts `EXTRA_ROOTS`), so its systems open here.
import { fx3 } from "./curves.ts";
import { vOf } from "./formulas.ts";
import type { Level } from "./places.ts";
import { callText, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { tableNumber } from "./table-names.ts";
import { built, fixedRow } from "./build-up-rows.ts";
import type { BuildUpContext, BuiltUp } from "./build-up-rows.ts";

const WEEK = "OptionsListAccount[453]";

/** The vote t that is not the week's: its bonus, the Meritocracy multiplier and the week's vote; its ⓘ why it is 0. */
export function meritocVote(lv: Level, ctx: BuildUpContext): BuiltUp | null {
  const call = lv.call;
  if (
    call?.b !== "Summoning2" ||
    call.a[0] !== "MeritocBonusz" ||
    vOf(lv.row) !== 0
  )
    return null;
  const t = Number(call.a[1]);
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
