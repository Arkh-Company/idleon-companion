// Two multipliers a source takes from another system, in any level (spec 009, FR-018; audit families 22 and 23):
// - every 1 + vote bonus ÷ 100 (N.js Summoning2 "MeritocBonusz") is the row "Meritocracy multi", with the code's 1 and
//   ÷ 100 in its ⓘ only (spec 009 Open Questions, Vinicius 18/11: the one place they leave the rows), its row the vote's;
// - a card's level (N.js CardLv) read inside the row with the card's name is "Card level", and the one constant that
//   multiplies it is "Bonus per level", as in Domeo Magmus (decision of 18/11); the code's other constants stay rows.
import { codeOf, groupRow, renamed } from "./build-up-rows.ts";
import { fx3 } from "./curves.ts";
import { isConstant, near, vOf } from "./formulas.ts";
import type { Row } from "./rows.ts";
import { termOf } from "./share.ts";

const VOTE = 'Summoning2("MeritocBonusz"';
const CARD_LV = 'RunCodeOfTypeXforThingY("CardLv"';

/** Row `r` as the Meritocracy multi when it is 1 + a vote's bonus ÷ 100; else as it is. */
export function meritocracyMulti(r: Row): Row {
  const g = r.group ?? [];
  const v = vOf(r);
  const one = g.find((k) => isConstant(k.node) && vOf(k) === 1);
  const vote = g.find((k) => codeOf(k).startsWith(VOTE));
  const hundred = g.find((k) => isConstant(k.node) && vOf(k) === 100);
  if (
    r.node.code !== null ||
    !vote ||
    !one ||
    !hundred ||
    g.length !== 3 ||
    !near(1 + vOf(vote) / 100, v)
  )
    return r;
  return {
    ...renamed(r, "Meritocracy multi"),
    group: [vote],
    f: [
      `1 + ${termOf(vote.node)} ÷ 100`,
      `1 + ${fx3(vOf(vote))} ÷ 100 = ${fx3(v)}`,
    ],
  };
}

/**
 * The rows of the source `name` (of value `v`) with its card's level and the constant that multiplies it named by their
 * role; under a row with another name, when the level is their product with its other rows, the two are a branch with
 * the card's name (audit family 23), Card level × Bonus per level.
 */
export function cardFactor(name: string, rows: Row[], v?: number): Row[] {
  const cards = rows.filter((r) => codeOf(r).startsWith(CARD_LV));
  const times = rows.filter(
    (r) => isConstant(r.node) && r.node.name.startsWith("× "),
  );
  const [card] = cards;
  const [k] = times;
  if (!card || !k || cards.length !== 1 || times.length !== 1) return rows;
  const level = renamed(card, "Card level");
  const per = renamed(k, "Bonus per level");
  if (card.node.name === name)
    return rows.map((r) => (r === card ? level : r === k ? per : r));
  const product = rows.reduce((a, r) => a * vOf(r), 1);
  if (v === undefined || !near(product, v)) return rows;
  const cv = vOf(card) * vOf(k);
  const branch = groupRow(
    card.node.name,
    cv,
    [level, per],
    [
      "Card level × Bonus per level",
      `${fx3(vOf(card))} × ${fx3(vOf(k))} = ${fx3(cv)}`,
    ],
  );
  return rows.flatMap((r) => (r === card ? [branch] : r === k ? [] : [r]));
}
