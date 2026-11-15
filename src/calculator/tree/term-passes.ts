// The game's own passes of pieces.cjs `rowOfTerm` (spec 008, T022) from the bench at BASELINE-4, each a rule with its
// proof: the running total of a loop's earlier turns ([D9-7], W3), the length of a list the game counts (OPUS4-8,
// OPUS1-P5), a table the block writes in its own code (FIX-4, Holes), a working value that is the progress of the
// loop of the call that wrote it (DEEP3-FIX-5) and a turn of the worn items' loop (NR-G 2).
import type { RecNode, RecValue } from "../recording.ts";
import { near } from "./math.ts";
import { cacheOf, termName } from "./names.ts";
import { callText, row, valueOf, withName } from "./rows.ts";
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
        why: `progress of the loop in ${en.loop} (N.js, nothing earlier wrote it)`,
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
/**
 * [NR-G 2] a turn of the worn items' loop (N.js TotalStats calcEtcBonuses): the stat's total adds (1 + a grid bonus ÷
 * 100) × (the item's definition + the slot's own value); the call is only that multiplier.
 */
export const WORN_TURN = {
  /** The stat's total, by the start of its path. */
  test: "DNSM.TotalStatsETCmap.",
  step: '"p":"DNSM.TotalStatsDM.',
  item: /"p":"DNSM\.TotalStatsDM\.(UQ\d+)val"/,
  proof: "bench pieces.cjs rowOfTerm NR-G 2; N.js TotalStats",
};
/** [NR-G 2] whether call `k` in expression `e` is the multiplier of a turn of the worn items' loop of `entry`. */
export const wornTurn = (entry: string | null, k: RecNode, e: Expr) =>
  !!entry?.startsWith(WORN_TURN.test) &&
  !near(k.v, e.v) &&
  JSON.stringify(e).includes(WORN_TURN.step);
/**
 * [NR-G 2] the branch of a worn item's turn, named for what it is; the slot's own value, which the recording keeps as
 * a bare 0 with no read, is named for its slot.
 */
export function wornItem(r: Row, k: RecNode, e: Expr): Row {
  const name = termName(callText(k));
  const uq = WORN_TURN.item.exec(JSON.stringify(e))?.[1] ?? "";
  const slot = (x: Row): Row => {
    // a level's parts at 0 may be under its "At 0" group
    if (x.node.role === "atZero")
      return { ...x, group: (x.group ?? []).map(slot) };
    if (!x.earlier || Number(x.node.value) !== 0) return x;
    const n = withName(
      x,
      `Slot value of the item in turn (EquipmentMap ${uq}val)`,
    );
    return { node: { ...n.node, leaf: "rawBonus", why: null }, open: n.open };
  };
  const out = { ...r, group: (r.group ?? []).map(slot) };
  return withName(
    out,
    name === null ? null : `Worn item value × (1 + ${name} ÷ 100)`,
  );
}

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

/**
 * DEEP3-FIX-5, pieces.cjs PROGRESS_BY_LABEL: a working value a block writes and reads in its own loop, by its label; read
 * by the call that wrote it, it is the progress of that loop, never a source: a "?" says why, a fixed value is one.
 */
interface Progress {
  label: string;
  name: string;
  leaf: "unknown" | "fixedValue";
  why: string | null;
  proof: string;
}
export const PROGRESS_BY_LABEL: readonly (Progress & Rule)[] = (
  [
    {
      label: "NghMrTOT",
      name: "Total of the earlier boats",
      leaf: "unknown",
      why: "progress of the loop in MenagerieStuff(NightmarinerTotLV): the boat levels above 600 of the boats before this one, before this boat adds to it (N.js)",
      proof: "bench pieces.cjs PROGRESS_BY_LABEL OPUS1-P4; N.js MenagerieStuff",
    },
    {
      label: "statuearbDN",
      name: "Statue bonus so far (before the next multiplier)",
      leaf: "unknown",
      why: "progress of the statue's multiplications in ArbitraryCode: the block writes the base value (statue level × StatueInfo[3]) and multiplies it by the talent bonuses one after the other (N.js)",
      proof: "bench pieces.cjs PROGRESS_BY_LABEL; N.js ArbitraryCode",
    },
    {
      label: "TrappingDNcm",
      name: "Best value of the earlier characters",
      leaf: "unknown",
      why: "progress of the loop in TrappingStuffs (CollectAllPCT): the block sets it to 0 and keeps the best talent bonus of the characters before this one (N.js)",
      proof: "bench pieces.cjs PROGRESS_BY_LABEL; N.js TrappingStuffs",
    },
    // the item definition the block sets to the food in turn and then reads the amount from (a field of the game's table)
    {
      label: "playHPbasePOT1",
      name: "Amount of the food in turn (item table)",
      leaf: "fixedValue",
      why: null,
      proof: "bench pieces.cjs PROGRESS_BY_LABEL; N.js TotalFoodBonuses",
    },
    {
      label: "GfoodMap",
      name: "Amount of the golden food (item table)",
      leaf: "fixedValue",
      why: null,
      proof: "bench pieces.cjs PROGRESS_BY_LABEL; N.js GoldFoodBonuses",
    },
    {
      label: "playHPbasePOT2",
      name: "Total of the earlier foods",
      leaf: "unknown",
      why: "progress of the loop in TotalFoodBonuses: the running total of the foods before this one adds to it (N.js)",
      proof: "bench pieces.cjs PROGRESS_BY_LABEL; N.js TotalFoodBonuses",
    },
    {
      label: "BminorDivQ",
      name: "Total of the earlier minor-link slots",
      leaf: "unknown",
      why: "progress of the loop in Divinity (Bonus_Minor, -1): the running total of the 12 slots before this one adds to it (N.js)",
      proof: "bench pieces.cjs PROGRESS_BY_LABEL; N.js Divinity",
    },
  ] satisfies Progress[]
).map((p) => ({ ...p, test: cacheOf(p.label) }));

/** DEEP3-FIX-5: the row of a working value read by the call that wrote it, when its label is a loop's progress. */
export function progressRow(p: string, v: unknown): Row | null {
  const pr = PROGRESS_BY_LABEL.find((r) => r.test.test(p));
  return pr
    ? leafRow(p, v as RecValue, { name: pr.name, leaf: pr.leaf, why: pr.why })
    : null;
}

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
