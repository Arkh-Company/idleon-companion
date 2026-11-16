// The passes of pieces.cjs `finish` from the bench at BASELINE-4 that name a row by the level under it (spec 008, T023):
// `nametagGrade`, `stampBonus` and the part of `rename` rule 67 that names the pet's own row. They run when the row gets
// its place, over the level built under it then (tree/parent-passes.ts). Left out, each a deviation (research R14):
// nametagGrade's "Podium level" under the multiplier (no row of the app has that name) and `talentMulti` (no row of the
// app has a talent's call with 1 + its value ÷ 100: that term is the branch of R1-PATCH, whose ⓘ is the expression's,
// with the talent's curve in it, tree/code-formulas.ts).
import { LEVEL_RENAMES } from "./level-renames.ts";
import { near } from "./math.ts";
import { nameOf } from "./names.ts";
import { bare, GENERIC_NAME, named } from "./rows.ts";
import type { Row } from "./rows.ts";
import { tagOf } from "./tags.ts";

const PETS = LEVEL_RENAMES.find((r) => r.beside);

/** Each pass, with what it tests. */
export const PARENT_RENAMES = {
  /** The item beside GalleryDN2's factor that makes it a nametag's grade. */
  nametag: {
    test: /EquipmentNametag\d/,
    proof: "bench pieces.cjs nametagGrade; N.js Gallery",
  },
  /** An item's bonus value, whose product with a multiplier is that item's bonus. */
  stampValue: {
    test: / bonus value$/,
    proof: "bench pieces.cjs stampBonus; N.js Gallery",
  },
  /** The exalted multiplier, whose product with a stamp's curve is that stamp's bonus. */
  stampCurve: {
    test: /StampExalted_double$/,
    proof: "bench pieces.cjs stampBonus; N.js StampBonusOfTypeX",
  },
  /** The running total of the earlier pets, beside a pet's passive (tree/level-renames.ts rule 67). */
  pets: {
    test: PETS?.test ?? /$^/,
    proof: "bench pieces.cjs rename rule 67; N.js Breeding",
  },
};

const MULTIPLIER = "Trophy slot multiplier";
const grade = (s: string) =>
  s
    .replace(
      /Trophy slot multiplier \(podium level\)/g,
      "Nametag grade multiplier (grade factor)",
    )
    .replace(/Trophy slot multiplier/g, "Nametag grade multiplier")
    .replace(/Podium level/g, "Grade factor");
const code = (r: Row) => r.node.code ?? "";

/**
 * nametagGrade: GalleryDN2 is a trophy's podium level, or the grade of the nametag beside it, each × Gallery Bonus Multi.
 * The level's rows with the multiplier renamed, and the parent's new name (null: it keeps its own).
 */
export function nametagGrade(
  n: Row,
  kids: readonly Row[],
): { name: string | null; kids: Row[] } {
  const m = kids.find((k) => k.node.name.startsWith(MULTIPLIER));
  if (
    !m ||
    !kids.some((k) => k !== m && PARENT_RENAMES.nametag.test.test(code(k)))
  )
    return { name: null, kids: [...kids] };
  const name = grade(n.node.name);
  return {
    name: name === n.node.name ? null : name,
    kids: kids.map((k) => (k === m ? named(k, grade(k.node.name)) : k)),
  };
}

/**
 * stampBonus: an item's bonus value × a multiplier is that item's bonus, unless the row is a system's member (it keeps
 * its own name); the exalted multiplier × the curve of a stamp's level is that stamp's bonus. `kidsOf` gives the rows
 * under a row of the level. The parent's new name, or null.
 */
export function stampBonus(
  n: Row,
  kids: readonly Row[],
  kidsOf: (r: Row) => readonly Row[],
): string | null {
  if (kids.length !== 2) return null;
  const val = kids.find((k) =>
    PARENT_RENAMES.stampValue.test.test(k.node.name),
  );
  const other = kids.find((k) => k !== val);
  if (
    val &&
    other &&
    !tagOf(n.node.code) &&
    (bare(other) ||
      /^(Trophy slot|Nametag grade) multiplier/.test(other.node.name)) &&
    near(Number(val.node.value) * Number(other.node.value), n.node.value)
  )
    return val.node.name.replace(/ value$/, "");
  const mult = kids.some((k) => PARENT_RENAMES.stampCurve.test.test(code(k)));
  const cur = kids.find((k) => code(k).startsWith("ArbitraryCode5Inputs("));
  // the curve's level is built only beside the exalted multiplier
  const lvl =
    mult && cur && kidsOf(cur).find((k) => k.node.name.endsWith(" level"));
  return lvl ? lvl.node.name.replace(/ level$/, " bonus") : null;
}

/**
 * Rule 67: the parent named as the earlier pets' total was (by its code, or the generic name) is the pet's, with the
 * earlier pets; the pet is the passive beside it, with a name of its own. Its new name, or null.
 */
export function petsEarlier(n: Row, kids: readonly Row[]): string | null {
  const total = kids.find(
    (k) =>
      PETS &&
      !k.group &&
      k.open === null &&
      k.node.name === PETS.name &&
      PARENT_RENAMES.pets.test.test(code(k)),
  );
  const pet = kids.find((k) => PETS?.beside?.test(code(k)));
  if (!total || !pet || pet.node.flags.unnamed) return null;
  const was = nameOf(code(total)) ?? GENERIC_NAME;
  return n.node.name === was ? `${pet.node.name}, with the earlier pets` : null;
}
