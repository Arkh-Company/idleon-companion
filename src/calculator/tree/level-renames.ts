// pieces.cjs `rename` from the bench at BASELINE-4 (spec 008, T023), the rules that look only at a row and the rows of
// its level, run in the level's `finish` before its types (tree/rows.ts): a read that is only context is no row
// (DROP_CODE, DROP_NAME, rule 52, B2-1), and a leaf that is a loop's progress is named for it, with the why of its "?"
// (rule 53, rule 67), or the card's per-star value the Arena's list had named by coincidence. Left out: rule 67 renames
// the pet's own row too ("…, with the earlier pets"), a row above this level, already placed with its name.
import { isLeaf } from "./row-checks.ts";
import type { Row } from "./rows.ts";

/** The reads that are only context, never a source, by their code or the name their code gives them; a leaf only. */
export const CONTEXT_READS: readonly {
  test: RegExp;
  by: "code" | "name";
  leafOnly: boolean;
  proof: string;
}[] = [
  // B2-1 (rule 68): the shiny pets' level counter is the loop the pet-level rows explain, with rows under it or not
  {
    test: /^DNSM\.PetszzBrDN1$/,
    by: "code",
    leafOnly: false,
    proof: "bench pieces.cjs rename B2-1 rule 68; N.js Breeding",
  },
  {
    test: /^(DNSM\.(GalleryDN1|SavePlDN|PetszzBrDNq|AllTalWhichPlayer)|ItemDefinitionsGET\.[^.]+\.UQ\dtxt|(DNSM|DummyNumbersStatManager)\.Stamp_bonuses_DRI)$/,
    by: "code",
    leafOnly: true,
    proof: "bench pieces.cjs rename DROP_CODE, rule 52; N.js StampBonusOfTypeX",
  },
  {
    test: /^(Working value of the game \((GalleryDN1|SavePlDN|PetszzBrDNq|AllTalWhichPlayer)\)|Current map$)/,
    by: "name",
    leafOnly: true,
    proof: "bench pieces.cjs rename DROP_NAME",
  },
];

interface LevelRule {
  test: RegExp;
  /** Whether the level beside the row proves the rule (rule 67: a pet's passive). */
  beside?: RegExp;
  name: string;
  why: string;
  proof: string;
}
/** The leaves a level's rows prove to be something else than their code says. */
export const LEVEL_RENAMES: readonly LevelRule[] = [
  {
    test: /^(DNSM|DummyNumbersStatManager)\.Stamp_TOTAL_bonus_of_type_X$/,
    name: "Total of the earlier stamps",
    why: "progress of the loop in StampBonusOfTypeX: the total of the earlier stamps of this type, before this stamp adds to it (N.js)",
    proof: "bench pieces.cjs rename rule 53; N.js StampBonusOfTypeX",
  },
  {
    test: /^(CustomLists\.)?RANDOlist\[90\]\[\d+\]$/,
    beside: /^Breeding\("SpecialPassives"/,
    name: "Earlier pets with the same shiny bonus",
    why: "progress of the loop in Breeding(ShinyBonusS): the total of the earlier pets with this bonus type, before this pet adds to it (N.js)",
    proof: "bench pieces.cjs rename rule 67; N.js Breeding",
  },
];
/** The card's per-star value, any row whose code holds this table: the Arena's wave list had named it by coincidence. */
export const CARD_STAR = {
  test: "RANDOlist[53]",
  name: "Bonus per star (card)",
  proof: "bench pieces.cjs rename RANDOlist 53; N.js RunCodeOfTypeXforThingY",
};

/** The level's rows with its context reads gone and its proven leaves named. */
export function levelRenames(rows: readonly Row[]): Row[] {
  const kept = rows.filter(
    (r) =>
      !CONTEXT_READS.some(
        (c) =>
          (!c.leafOnly || isLeaf(r)) &&
          c.test.test(c.by === "code" ? (r.node.code ?? "") : r.node.name),
      ),
  );
  return kept.map((r) => {
    const code = r.node.code ?? "";
    const flags = { ...r.node.flags };
    delete flags.unnamed;
    if (code.includes(CARD_STAR.test))
      return {
        ...r,
        node: {
          ...r.node,
          name: CARD_STAR.name,
          code: null,
          flags,
          ...(isLeaf(r) ? { leaf: "fixedValue" as const } : {}),
        },
      };
    const rule =
      isLeaf(r) &&
      LEVEL_RENAMES.find(
        (x) =>
          x.test.test(code) &&
          (!x.beside ||
            kept.some((k) => x.beside?.test(k.node.code ?? "") ?? false)),
      );
    if (!rule) return r;
    return {
      ...r,
      node: {
        ...r.node,
        name: rule.name,
        // its "?" comes from classify, which keeps the why of a loop's progress
        why: rule.why,
        flags,
      },
    };
  });
}
