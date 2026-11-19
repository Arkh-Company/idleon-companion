// A scratch box the game writes in more than one block is named by the write a read comes from (spec 009 T023, decision
// of 18/11): a read never takes the name of another write of the same box. Each rule is a box, the block and mode of its
// writer, and the name of each of that writer's writes; a box with no rule keeps the name of its path (tree/names.ts).
import type { CalcTreeNode } from "../tree-contract.ts";
import type { RecNode } from "../recording.ts";
import { LOOP_ENTRY_CACHES } from "./loop-parts.ts";
import { GENERIC_NAME, openingOf } from "./rows.ts";
import { any } from "./val-path.ts";

export interface ScratchName {
  /** null: the write has no name of its own (the generic name, FR-012a). */
  name: string | null;
  leaf?: NonNullable<CalcTreeNode["leaf"]>;
}
interface Rule {
  path: string;
  block: string;
  mode: string | number;
  /**
   * The name of the writer's write number `at` of the box, by what that write read (`reads`) or by the writer's own
   * arguments; undefined for a write the rule does not know (the name of the path).
   */
  name: (
    at: number,
    reads: () => readonly string[],
    call: RecNode,
  ) => ScratchName | undefined;
  proof: string;
}

/** The 9th bonus of each monument, in the game's text (HolesInfo, bonus 10 × monument + 9), by monument. */
const MONUMENT_MULTI = [
  "x Bravery Bonuses Multi",
  "x Justice Bonuses Multi",
  "x Wisdom Bonuses Multi",
];

const RULES: readonly Rule[] = [
  {
    path: "DNSM.HoleozDN",
    block: "Holes",
    mode: "VillagersOwned",
    name: () => ({ name: "Cavern villagers owned" }),
    proof:
      "N.js Holes VillagersOwned: the box counts the caverns with a villager",
  },
  {
    path: "DNSM.HoleozDN",
    block: "Holes",
    mode: "MonumentROGbonuses",
    // m = 1, then, for any bonus but the 9th, m = 1 + b ÷ 100 with b the monument's 9th bonus ("x Wisdom Bonuses
    // Multi"), m = m + v ÷ 100 with v the Monumental Vibes bonus; and m = m × (1 + f ÷ 100) with f the fountain's: the
    // start and the 9th bonus's multiplier are values of their own, the steps after them have no name in the game
    name: (at, _reads, call) =>
      at === 0
        ? { name: "Start value", leaf: "fixedValue" }
        : at === 1 && call.a[2] !== 9
          ? { name: MONUMENT_MULTI[Number(call.a[1])] ?? null }
          : { name: null },
    proof:
      "N.js Holes MonumentROGbonuses: the multiplier of the monument starts at 1 and changes in the next writes; HolesInfo names the 9th bonus of each monument",
  },
  {
    path: "DNSM.CalcTalentDN2",
    block: "TalentCalc",
    mode: -2,
    // the bubbles' part counts many things in the box; two of its writes are a bubble's own number: c = ⌊cards found ÷
    // 100⌋ for The Slab's bubbles, c = ⌊max(0, Tome points − 5000) ÷ 2000⌋ for the Tome's
    name: (_at, reads) =>
      reads().includes("Cards[1].length")
        ? { name: "Base AGI and LUK per 100 items found, shown on The Slab" }
        : reads().some((p) => p.endsWith("._GenInfo[84]"))
          ? { name: "% AGI for every 2000 Tome Completion Points over 5000" }
          : undefined,
    proof:
      "N.js TalentCalc -2 (the bubbles): the box is the cards found ÷ 100, then the Tome points over 5000 ÷ 2000; the names are AlchemyDescription SLABO_AGILITY and TOME_AGILITY",
  },
  {
    path: "DNSM.TKnS_DN",
    block: "RoyalG",
    mode: "TotalStatz",
    // t = 0, then t = t + the stat of each kingdom entry: the start, then the total on its way to the last one
    name: (at) =>
      at === 0
        ? { name: "Start value", leaf: "fixedValue" }
        : { name: "Royal total stats (cached)" },
    proof:
      "N.js RoyalG TotalStatz: the total starts at 0 and adds each kingdom stat",
  },
  {
    path: "DNSM.GalleryDN2",
    block: "Gallery",
    mode: "InitializeNametagBonuses",
    // g = the grade factor of the nametag's grade, then g = g × the gallery bonus multi: the same pair as a trophy's
    // podium level and slot multiplier, under the nametag's names (tree/parent-renames.ts nametagGrade)
    name: () => ({ name: "Nametag grade multiplier (grade factor)" }),
    proof:
      "N.js Gallery InitializeNametagBonuses: the box holds the grade factor of the nametag, then its multiplier",
  },
];

/**
 * A read of the write being opened above it, in a turn of the loop that makes that write: the box before the turn, the
 * total of the earlier turns, with no piece of its own (a row is never a child of itself).
 */
export const EARLIER_TURNS = {
  name: "Total of the earlier turns",
  leaf: "unknown",
  why: "the box before this turn of its loop",
  flags: {},
} as const;
/**
 * Whether the read of `path` at `value` by writer `w` is the read being opened above it (`opening`); a bubble's box
 * keeps its own rule, its turn opened once more and then cut (tree/caches.ts OPUS4-4).
 */
export const readAgain = (
  opening: readonly string[],
  w: RecNode | null,
  path: string,
  value: number | boolean | null,
): boolean =>
  !!w &&
  !any(LOOP_ENTRY_CACHES, path) &&
  opening.includes(openingOf({ writer: w.id, path, value }));

/** A read row's fields for its write's name: none for a box no rule knows; the generic name for a write with none. */
export const scratchFields = (
  own: ScratchName | undefined | null,
): Partial<Pick<CalcTreeNode, "name" | "leaf" | "flags">> =>
  !own
    ? {}
    : own.name === null
      ? { name: GENERIC_NAME, flags: { unnamed: true } }
      : { name: own.name, ...(own.leaf ? { leaf: own.leaf } : {}) };

/**
 * The name of the write `at` of `path` by `call`, which read `reads`; undefined when no rule knows the box (the path's
 * own name).
 */
export function scratchName(
  path: string,
  call: RecNode | undefined,
  at: number,
  reads: () => readonly string[] = () => [],
): ScratchName | undefined {
  const rules = RULES.filter((r) => r.path === path);
  if (!rules.length || !call) return undefined;
  return rules
    .find((r) => r.block === call.b && r.mode === call.a[0])
    ?.name(at, reads, call);
}
