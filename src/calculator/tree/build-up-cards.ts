// The build-up of a card's bonus (spec 009, FR-018; T023, decision of 18/11), in the shape of Domeo Magmus: the card's
// level is the row "Card level", the bonus of the card's table is "Bonus per level", and the checks of the card's stars
// go to the ⓘ.
// - a passive card (N.js TotalStats): bonus = min(bonus per level × card level, cap); two cards in one capped sum are
//   each such a card, the cap in the ⓘ of the sum;
// - an equipped card (N.js TalentCalc, the card slots): bonus = bonus per level × card level × each multiplier, the
//   bonus per level read from the card's own row of the card table, which the scratch box holds while the game adds
//   that card;
// - a card's level (N.js CardLv): the card lists of the account raise it to 7 or 6 when it is lower; each check is in
//   the ⓘ, never a row.
import { FORCED } from "./code-formulas.ts";
import { fx3 } from "./curves.ts";
import { isCond, isConstant, near, vOf } from "./formulas.ts";
import type { Level } from "./places.ts";
import type { Row } from "./rows.ts";
import { termOf } from "./share.ts";
import { GEN_INFO } from "../names/state-words.ts";
import {
  built,
  codeOf,
  groupRow,
  parts,
  product,
  renamed,
} from "./build-up-rows.ts";
import type { BuiltUp } from "./build-up-rows.ts";

const CARD_LV = 'RunCodeOfTypeXforThingY("CardLv"';
const isCard = (r: Row) => codeOf(r).startsWith(CARD_LV);
const isTimes = (r: Row) => isConstant(r.node) && r.node.name.startsWith("× ");
const isCap = (r: Row) => isConstant(r.node) && r.node.name.startsWith("Cap ");

/** A passive card's bonus: its Card level and its Bonus per level (the code's "× N"); two cards or more, each its own
 * row of that shape; the cap ("Cap N") only in the ⓘ. */
export function cardBonus(lv: Level): BuiltUp | null {
  const cards = lv.rows.filter(isCard);
  const ks = lv.rows.filter(isTimes);
  const cap = lv.rows.find(isCap);
  if (
    !cards.length ||
    ks.length !== cards.length ||
    lv.rows.length !== 2 * cards.length + (cap ? 1 : 0)
  )
    return null;
  const each = cards.map((card, i) => {
    const k = ks[i] ?? card;
    return {
      card,
      rows: [renamed(card, "Card level"), renamed(k, "Bonus per level")],
      f: [
        "Bonus per level × Card level",
        `${fx3(vOf(k))} × ${fx3(vOf(card))}`,
      ] as const,
      v: vOf(k) * vOf(card),
    };
  });
  const sum = each.reduce((s, c) => s + c.v, 0);
  const v = vOf(lv.row);
  const C = cap ? vOf(cap) : Infinity;
  if (!near(Math.min(sum, C), v)) return null;
  const capped = sum > C && !near(sum, C);
  const [one] = each;
  if (one && each.length === 1) {
    const [names, numbers] = cap
      ? [`min(${one.f[0]}, Cap)`, `min(${one.f[1]}, ${fx3(C)})`]
      : one.f;
    return built(
      lv,
      one.rows,
      [names, `${numbers} = ${fx3(v)}${capped ? " (capped)" : ""}`],
      capped,
    );
  }
  const rows = each.map((c) =>
    groupRow(c.card.node.name, c.v, c.rows, [
      c.f[0],
      `${c.f[1]} = ${fx3(c.v)}`,
    ]),
  );
  const names = rows.map((r) => termOf(r.node)).join(" + ");
  const numbers = each.map((c) => fx3(c.v)).join(" + ");
  return built(
    lv,
    rows,
    cap
      ? [
          `min(${names}, Cap)`,
          `min(${numbers}, ${fx3(C)}) = ${fx3(v)}${capped ? " (capped)" : ""}`,
        ]
      : [names, `${numbers} = ${fx3(v)}`],
    capped,
  );
}

const SCRATCH_BONUS = "DNSM.CardBonusSdl[4]";
/** An equipped card's bonus: its Card level, its Bonus per level from the card's row of the table, each multiplier. */
export function equippedCard(lv: Level): BuiltUp | null {
  const rows = parts(lv.rows);
  const card = rows.find(isCard);
  const bonus = rows.find((r) => codeOf(r) === SCRATCH_BONUS);
  const id = /^RunCodeOfTypeXforThingY\("CardLv", "([^"]+)"\)$/.exec(
    card ? codeOf(card) : "",
  )?.[1];
  const v = vOf(lv.row);
  if (!card || !bonus || !id || rows.length !== lv.rows.length) return null;
  const others = rows.filter((r) => r !== card && r !== bonus);
  if (!near(vOf(card) * vOf(bonus) * product(others), v)) return null;
  // the box holds the card's row of the table while the game adds that card: the row's cell is the piece
  const table = `${GEN_INFO(6, 312)}[45].${id}[4]`;
  const key = bonus.node.pieceKey
    ? (JSON.parse(bonus.node.pieceKey) as unknown[])
    : [];
  const perLevel = renamed(bonus, "Bonus per level", "fixedValue");
  // in the game's order of the factors
  const out = rows.map((r) =>
    r === card
      ? renamed(card, "Card level")
      : r === bonus
        ? {
            ...perLevel,
            node: {
              ...perLevel.node,
              code: table,
              pieceKey: JSON.stringify([key[0] ?? 0, table]),
            },
          }
        : r,
  );
  return built(lv, out, [
    out.map((r) => termOf(r.node)).join(" × "),
    `${out.map((r) => fx3(vOf(r))).join(" × ")} = ${fx3(v)}`,
  ]);
}

const STARS = /^Card stars < (\d+)$/;
/** A card's level: the checks of its stars, which the card lists of the account make, in its ⓘ only. */
export function cardStars(lv: Level): BuiltUp | null {
  const checks = lv.rows.filter((r) => isCond(r) && STARS.test(r.node.name));
  const base = lv.row.xf ?? lv.row.f;
  if (!(lv.row.node.code ?? "").startsWith(CARD_LV) || !checks.length || !base)
    return null;
  const at = checks.map((r) => STARS.exec(r.node.name)?.[1] ?? "");
  const lists = checks.length > 1 ? "card lists" : "card list";
  return built(
    lv,
    lv.rows.filter((r) => !checks.includes(r)),
    // the checks in words: the numbers line stays the level's math
    [
      // a level the list forced says its list already
      `${base[0]}${base[0].startsWith(FORCED) ? "" : `, at least ${at.join(" and ")} by the ${lists} of the account`} (${checks.map((r) => `${r.node.name}: ${vOf(r) ? "yes" : "no"}`).join("; ")})`,
      base[1],
    ],
    true,
  );
}
