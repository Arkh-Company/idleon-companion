// The game's own passes of pieces.cjs `rowOfTerm` (spec 008, T022) from the bench at BASELINE-4, each a rule with its
// proof: the running total of a loop's earlier turns ([D9-7], W3), the length of a list the game counts (OPUS4-8,
// OPUS1-P5) and a table the block writes in its own code (FIX-4, Holes).
import type { RecNode, RecValue } from "../recording.ts";
import { near } from "./math.ts";
import { row, valueOf } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr } from "./steps.ts";
import type { Reads } from "./val-path.ts";

interface Rule {
  test: RegExp;
  proof: string;
}
/**
 * W3, pieces.cjs `EARLIER_NAMES`: the caches a loop fills turn by turn, each turn adding to the total of the earlier
 * ones; the row of that total is named for it, with the loop that fills it.
 */
export const EARLIER_TOTALS: readonly (Rule & {
  name: string;
  loop: string;
})[] = [
  {
    test: /^DNSM\.CapeVineBonTOT\./,
    name: "Earlier cape vines with the same stat",
    loop: "Gallery(InitializeCapeBonuses): the total of the earlier cape vines with this stat, before this one adds to it",
    proof: "bench pieces.cjs EARLIER_NAMES; N.js Gallery",
  },
  {
    test: /^DNSM\.PremHatBonTOT\./,
    name: "Earlier hats with the same stat",
    loop: "Gallery(InitializePremHatBonuses): the total of the earlier hats with this stat, before this one adds to it",
    proof: "bench pieces.cjs EARLIER_NAMES; N.js Gallery",
  },
  {
    test: /^DNSM\.GalleryTrophyBonTOT\./,
    name: "Earlier trophies with the same stat",
    loop: "Gallery(InitializeTrophyBonuses): the total of the earlier trophies with this stat, before this one adds to it",
    proof: "bench pieces.cjs EARLIER_NAMES; N.js Gallery",
  },
  {
    test: /^DNSM\.AlchVials\./,
    name: "Earlier vials with the same bonus",
    loop: "TalentCalc(AlchVials): the total of the earlier vials with this bonus, before this one adds to it",
    proof: "bench pieces.cjs EARLIER_NAMES; N.js TalentCalc",
  },
  {
    test: /^DNSM\.BoxRewards\./,
    name: "Earlier post office boxes with the same reward",
    loop: "TalentCalc(BoxRewards): the total of the earlier post office boxes with this reward, before this one adds to it",
    proof: "bench pieces.cjs EARLIER_NAMES; N.js TalentCalc",
  },
  {
    test: /^DNSM\.StarSigns\./,
    name: "Earlier star signs with the same bonus",
    loop: "StarSigns: the total of the earlier star signs (one conditional per sign, in sign order) with this bonus, before this one adds to it",
    proof: "bench pieces.cjs EARLIER_NAMES; N.js StarSigns",
  },
  {
    test: /^DNSM\.CardBonusS\./,
    name: "Earlier equipped cards with the same bonus",
    loop: "TalentCalc(CardBonusS): the total of the earlier equipped cards with this bonus, before this one adds to it",
    proof: "bench pieces.cjs EARLIER_NAMES; N.js TalentCalc",
  },
  {
    test: /^DNSM\.TotalStatsETCmap\./,
    name: "Earlier worn items with the same bonus",
    loop: "TotalStats(calcEtcBonuses): the total of the earlier worn items with this bonus, before this one adds to it",
    proof: "bench pieces.cjs EARLIER_NAMES; N.js TotalStats",
  },
  {
    test: /^DNSM\.ChipBbonusz\./,
    name: "Earlier chips with the same bonus",
    loop: "ActionBlock(RecalcChipBonuses): the total of the earlier chips with this bonus, before this one adds to it",
    proof: "bench pieces.cjs EARLIER_NAMES; N.js ActionBlock",
  },
  {
    test: /^DNSM\.GalleryNametagBonTOT\./,
    name: "Earlier nametags with the same stat",
    loop: "Gallery(InitializeNametagBonuses): the total of the earlier nametags with this stat, before this one adds to it",
    proof: "bench pieces.cjs EARLIER_NAMES; N.js Gallery",
  },
];
/** The row of a loop's earlier turns in `entry`'s cache: its name and why (pieces.cjs EARLIER_NAMES). */
function earlierRow(entry: string, code: string): Row | null {
  const en = EARLIER_TOTALS.find((r) => r.test.test(entry));
  return en
    ? leafRow(code, 0, {
        name: en.name,
        leaf: "unknown",
        why: `progress of the loop in ${en.loop} (N.js; nothing earlier wrote it)`,
      })
    : null;
}
/**
 * [D9-7] the worn items' loop adds each item to its stat's total; the recording binds that first 0 to the running
 * total of another loop (`test`, read in a step that reads the item's definition, `step`): it is the stat's total.
 */
export const WORN_TOTAL = {
  test: /^DummyNumbersStatManager\.TotalStatsDN$/,
  step: '"p":"DNSM.TotalStatsDM.UQ',
  code: "DNSM.TotalStatsETCmap",
  proof: "bench pieces.cjs rowOfTerm D9-7; N.js TotalStats",
};
/** OPUS4-8 and OPUS1-P5: the length of a list the game counts; `single` asks that only one of them has the value. */
export const LIST_COUNTS: readonly (Rule & { single?: true })[] = [
  {
    test: /^(Research\[11\]|Spelunk\[6\]|Spelunk\[46\])\.length$/,
    single: true,
    proof: "bench pieces.cjs rowOfTerm OPUS4-8; N.js Spelunk",
  },
  {
    test: /^Cards\[1\]\.length$/,
    proof: "bench pieces.cjs rowOfTerm OPUS1-P5; N.js RunCodeOfTypeXforThingY",
  },
];
/** FIX-4: a block whose numbers come from a table it writes in its own code, not from a read. */
export const CODE_TABLES: readonly (Rule & { block: string })[] = [
  {
    test: /^LampBonuses$/,
    block: "Holes",
    proof: "bench pieces.cjs rowOfTerm DEEP3-FIX-4; N.js Holes",
  },
];

const leafRow = (
  code: string | null,
  v: RecValue | undefined,
  fields: Partial<Row["node"]>,
): Row => ({
  node: row({ pieceKey: null, value: valueOf(v), code, ...fields }),
  open: null,
});

/** [D9-7] a read of 0 of the other loop's total, in a step of the worn items' loop. */
export function wornTotal(p: string, v: unknown, step: Expr | undefined) {
  return WORN_TOTAL.test.test(p) &&
    Number(v) === 0 &&
    !!step &&
    JSON.stringify(step).includes(WORN_TOTAL.step)
    ? earlierRow(`${WORN_TOTAL.code}.x`, WORN_TOTAL.code)
    : null;
}

/**
 * W3: in a turn of entry `entry`'s loop, a bare 0 bound to a read that is also 0 is the running total of the earlier
 * turns, when the call read other entries of that cache as undefined.
 */
export function earlierTotal(
  entry: string | null,
  v: unknown,
  reads: Reads,
  named: boolean,
) {
  if (!entry || Number(v) !== 0 || !named) return null;
  const fam = entry.slice(0, entry.lastIndexOf(".") + 1);
  return [...reads].some(
    ([rp, rv]) => rv === "(undefined)" && rp.startsWith(fam) && rp !== entry,
  )
    ? earlierRow(entry, entry)
    : null;
}

/** OPUS4-8 and OPUS1-P5: a value with no read of its own that is the length of a list the game counts. */
export function listCount(v: unknown, reads: Reads): Row | null {
  for (const r of LIST_COUNTS) {
    const hits = [...reads].filter(([p, x]) => r.test.test(p) && near(x, v));
    const [hit] = hits;
    if (hit && (!r.single || hits.length === 1))
      return leafRow(hit[0], v as RecValue, { leaf: "quantity" });
  }
  return null;
}

/** FIX-4: a number of a block that writes its table in its own code is a constant of that table. */
export function codeTable(block: RecNode, v: unknown): Row | null {
  const [mode] = block.a;
  return CODE_TABLES.some(
    (r) => r.block === block.b && r.test.test(String(mode)),
  )
    ? leafRow(null, v as RecValue, { leaf: "fixedValue" })
    : null;
}
