// The parts of a cache filled in a loop (spec 008, T022): the rules of pieces.cjs `cacheRows` and `entryRows` for the
// game's own caches, and the part each loop turn adds (`entryRows`, its loop over the entries), from the bench at
// BASELINE-4. A write that adds to what was there is a part; one that multiplies it is a factor; any other write
// replaces the value, and the parts start again from it.
import type { Entry } from "./entries.ts";
import { flat } from "./expr.ts";
import { near } from "./math.ts";
import type { Expr, Step } from "./steps.ts";

interface Rule {
  test: RegExp;
  proof: string;
}
/** OPUS4-4: a loop whose entries another entry of the same loop reads; that read opens into the entry's own turns. */
export const LOOP_ENTRY_CACHES: readonly Rule[] = [
  {
    test: /^DNSM\.(AlchBubbles\.\w+|SpelunkyUpgTOT\[\d+\]|SpelunkyUpgDN|ExoticFarmBon\[\d+\])$/,
    proof:
      "bench pieces.cjs cacheRows OPUS4-4; N.js CauldronStats; N.js Spelunk; N.js FarmingStuffs",
  },
];
/** A total the block sets to 0 and sums again in each of its loops: the run of writes that ends with the value read. */
export const RUN_TOTALS: readonly Rule[] = [
  {
    test: /^DNSM\.SpelunkyUpgDN$/,
    proof: "bench pieces.cjs cacheRows OPUS4-4; N.js Spelunk",
  },
];
/** deep-2: a skill's rank, the count of limits the account's total level of the skill reaches, opens into the levels. */
export const SKILL_RANKS = {
  test: /^DNSM\.skillLvRanks\[(\d+)\]$/,
  block: "RiftStuff",
  mode: "skillLvRanks",
  total: "DNSM.skillLvRanksDN",
  proof: "bench pieces.cjs cacheRows deep-2; N.js RiftStuff",
};
/** The kind of a loop turn's part, from what the turn read (pieces.cjs entryRows, OPUS3-F3b and the item turn). */
export const TURN_KINDS: readonly (Rule & {
  found?: true;
  leaf: "condition" | "rawBonus";
})[] = [
  {
    test: /^Cards\[1\] contains /,
    found: true,
    leaf: "condition",
    proof: "bench pieces.cjs entryRows OPUS3-F3b; N.js RunCodeOfTypeXforThingY",
  },
  {
    test: /^ItemDefinitionsGET/,
    leaf: "rawBonus",
    proof: "bench pieces.cjs entryRows turnName, item",
  },
];

export interface Part {
  kind: "+" | "x";
  d: number;
  q: Entry;
  st?: Step;
}

/** The part each turn of entry list `L` adds to the cache, in order (a factor for a turn that multiplied it). */
export function partsOf(L: readonly Entry[]): Part[] {
  const parts: Part[] = [];
  let prev = 0;
  for (const q of L) {
    const v = Number(q.v);
    const st = q.s.find((y) => near(y.v, v));
    const holds = (t: Expr) =>
      (t.t === "val" || t.t === "read") && near(t.v, prev);
    const e = st?.e;
    // a write that multiplies what was there (17 × 10 = 170) is a factor, not a part
    const mult =
      prev !== 0 && e?.t === "op" && e.o === "*" && flat(e, "*").some(holds);
    // [D9-2] the compound write (cache += amount) keeps the amount as its step and no step with the new total
    const addsAmount =
      !st && q.s.some((y) => near(y.v, v - prev) && Math.abs(v - prev) > 1e-12);
    // OPUS4-9: round(earlier total + amount) is an add
    const a0 = e?.t === "fn" ? e.args[0] : undefined;
    const roundAdds =
      e?.t === "fn" &&
      e.name === "round" &&
      a0?.t === "op" &&
      a0.o === "+" &&
      flat(a0, "+").some(holds);
    const adds =
      prev === 0 ||
      addsAmount ||
      roundAdds ||
      (e?.t === "op" && e.o === "+" && flat(e, "+").some(holds));
    // a write that adds is a part; any other write replaces the value, and the parts start again from it
    if (mult && st) parts.push({ kind: "x", d: v / prev, q, st });
    else if (!adds) parts.splice(0, parts.length, { kind: "+", d: v, q });
    else if (Math.abs(v - prev) > 1e-12)
      parts.push({ kind: "+", d: v - prev, q });
    prev = v;
  }
  return parts;
}
