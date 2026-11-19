// A scratch box the game writes in more than one block is named by the write a read comes from (spec 009 T023, decision
// of 18/11): a read never takes the name of another write of the same box. Each rule is a box, the block and mode of its
// writer, and the name of each of that writer's writes; a box with no rule keeps the name of its path (tree/names.ts).
import type { CalcTreeNode } from "../tree-contract.ts";
import type { RecNode } from "../recording.ts";
import { GENERIC_NAME } from "./rows.ts";

export interface ScratchName {
  /** null: the write has no name of its own (the generic name, FR-012a). */
  name: string | null;
  leaf?: NonNullable<CalcTreeNode["leaf"]>;
}
interface Rule {
  path: string;
  block: string;
  mode: string;
  /** The name of the writer's write number `at` of the box. */
  name: (at: number) => ScratchName;
  proof: string;
}

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
    // m = 1, then m = 1 + w ÷ 100 with w the wisdom monument's bonus, m = m + v ÷ 100 with v the Monumental Vibes
    // bonus, m = m × (1 + f ÷ 100) with f the fountain's: only the start is a value of its own
    name: (at) =>
      at === 0 ? { name: "Start value", leaf: "fixedValue" } : { name: null },
    proof:
      "N.js Holes MonumentROGbonuses: the multiplier of the monument starts at 1 and changes in the next writes",
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

/** A read row's fields for its write's name: none for a box no rule knows; the generic name for a write with none. */
export const scratchFields = (
  own: ScratchName | undefined | null,
): Partial<Pick<CalcTreeNode, "name" | "leaf" | "flags">> =>
  !own
    ? {}
    : own.name === null
      ? { name: GENERIC_NAME, flags: { unnamed: true } }
      : { name: own.name, ...(own.leaf ? { leaf: own.leaf } : {}) };

/** The name of the write `at` of `path` by `call`; undefined when no rule knows the box (the path's own name). */
export function scratchName(
  path: string,
  call: RecNode | undefined,
  at: number,
): ScratchName | undefined {
  const rules = RULES.filter((r) => r.path === path);
  if (!rules.length || !call) return undefined;
  return rules
    .find((r) => r.block === call.b && r.mode === call.a[0])
    ?.name(at);
}
