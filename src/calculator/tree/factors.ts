// Two multipliers a source takes from another system, in any level (spec 009, FR-018; audit families 22 and 23):
// - every 1 + vote bonus ÷ 100 (N.js Summoning2 "MeritocBonusz") is the row "Meritocracy multi", with the code's 1 and
//   ÷ 100 in its ⓘ only (spec 009 Open Questions, Vinicius 18/11: the one place they leave the rows), its row the vote's;
// - a card's level (N.js CardLv) read inside the row with the card's name is "Card level", and the one constant that
//   multiplies it is "Bonus per level", as in Domeo Magmus (decision of 18/11); the code's other constants stay rows.
import { codeOf, renamed } from "./build-up-rows.ts";
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

/** The rows of the source `name` with its card's level and the constant that multiplies it named by their role. */
export function cardFactor(name: string, rows: Row[]): Row[] {
  const cards = rows.filter(
    (r) => codeOf(r).startsWith(CARD_LV) && r.node.name === name,
  );
  const times = rows.filter(
    (r) => isConstant(r.node) && r.node.name.startsWith("× "),
  );
  const [card] = cards;
  const [k] = times;
  if (!card || !k || cards.length !== 1 || times.length !== 1) return rows;
  return rows.map((r) =>
    r === card
      ? renamed(r, "Card level")
      : r === k
        ? renamed(r, "Bonus per level")
        : r,
  );
}
