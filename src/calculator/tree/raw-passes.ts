// The game's own passes of pieces.cjs `explainRaw` (spec 008, T022) from the bench at BASELINE-4: blocks whose rows the
// recording cannot give from their steps, written from the game's code instead, each a rule with its proof. A
// companion is owned or not, with its bonus; a talent with no points stops before its curve; a shiny pet's level and a
// card's stars are tests the game repeats level by level. Their rows keep the generic name until US1c, which names them;
// left out until their own phase: Golden Food (its ⓘ, US1b-3) and the talent's curve (a table of the 007 index).
import type {
  CALC_CONDITION_KINDS,
  CALC_LEAF_KINDS,
} from "../tree-contract.ts";
import type { RecNode, RecValue } from "../recording.ts";
import { row, valueOf } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Reads } from "./val-path.ts";

/** Each pass, by the block and its mode (its first argument) it rewrites, written "block mode". */
export const RAW_PASSES: readonly { test: RegExp; proof: string }[] = [
  {
    test: /^Companions /,
    proof: "bench pieces.cjs explainRaw Companions; N.js Companions",
  },
  {
    test: /^GetTalentNumber /,
    proof: "bench pieces.cjs explainRaw GetTalentNumber; N.js GetTalentNumber",
  },
  {
    test: /^Breeding SpecialPassives$/,
    proof: "bench pieces.cjs explainRaw Breeding; N.js Breeding",
  },
  {
    test: /^RunCodeOfTypeXforThingY CardLv$/,
    proof: "bench pieces.cjs explainRaw CardLv; N.js RunCodeOfTypeXforThingY",
  },
];

const leaf = (
  value: RecValue | undefined,
  kind: (typeof CALC_LEAF_KINDS)[number],
  code: string | null = null,
  condition: (typeof CALC_CONDITION_KINDS)[number] | null = null,
): Row => ({
  node: row({
    pieceKey: null,
    value: valueOf(value),
    code,
    leaf: kind,
    ...(condition ? { condition } : {}),
  }),
  open: null,
});

/** The rows of a block one of the passes rewrites, or null. */
export function rawPasses(
  n: RecNode,
  nodes: readonly RecNode[],
  reads: Reads,
): Row[] | null {
  const kid = (b: string) =>
    n.c.map((c) => nodes[c]).find((k) => k?.b === b) ?? null;
  const [mode, arg] = n.a;
  if (!RAW_PASSES.some((r) => r.test.test(`${n.b} ${String(mode)}`)))
    return null;
  // a companion is owned when its bonus is in the cache of the owned ones
  if (n.b === "Companions" && !n.c.length) {
    const key = `DNSM.CompanionBon[${String(mode)}]`;
    const owned = reads.has(key);
    return [
      leaf(owned ? 1 : 0, "condition", null, "owned"),
      ...(owned ? [leaf(reads.get(key), "rawBonus", key)] : []),
    ];
  }
  // a talent with no points: the game stops before the curve (0 ≥ points ? 0 : curve)
  if (n.b === "GetTalentNumber" && !n.c.length && Number(n.v) === 0) {
    const path = `SkillLevels[${String(arg)}]`;
    const lv = reads.get(path) ?? 0;
    return [
      leaf(Number(lv) > 0 ? 1 : 0, "condition", null, "limit"),
      leaf(lv, "investedPoints", path),
    ];
  }
  // a shiny pet's level: level by level, whether its EXP passes the requirement, up to 19 levels and 10 more with the
  // Menagerie's unlock
  if (n.b === "Breeding" && mode === "SpecialPassives" && arg === "Lv") {
    const exp = [...reads].find(([p]) => /^Breeding\[\d+\]\[\d+\]$/.test(p));
    return [
      leaf(exp ? exp[1] : 0, "quantity", exp?.[0] ?? null),
      leaf(19, "fixedValue"),
      leaf(kid("MenagerieStuff")?.v ?? 0, "condition", null, "owned"),
      leaf(1.6, "fixedValue"),
    ];
  }
  // a card's stars: star by star, whether the cards collected pass the star's requirement, up to 4 stars, the Rift's
  // 5th and the Spelunking's 6th
  if (n.b === "RunCodeOfTypeXforThingY" && mode === "CardLv") {
    const path = `Cards[0].${String(arg)}`;
    return [
      leaf(reads.get(path) ?? 0, "quantity", path),
      leaf(4, "fixedValue"),
      leaf(kid("RiftStuff")?.v ?? 0, "condition", null, "owned"),
      leaf(kid("Spelunk")?.v ?? 0, "condition", null, "owned"),
    ];
  }
  return null;
}
