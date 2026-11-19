// The short names of the Killroy shop's bonuses (family 13 of the audit of 19/11; the Vinicius's names of 19/11), by
// what each raises. N.js RandomEvent KillroyBonuses(t) is the bonus t, whose shop text is SkullShopDesc[r][0] for the
// row r = KILLROY[t].row (bench 007 catalog). No import: the name passes (renames, state-names) and the ⓘ's texts
// (name-descs) read it without a cycle.

export const KILLROY: readonly { row: number; name: string }[] = [
  { row: 11, name: "Killroy: Artifact Find Chance" },
  { row: 13, name: "Killroy: Crop Evolution Chance" },
  { row: 14, name: "Killroy: Jade Gain" },
  { row: 15, name: "Killroy: Gallery Grade chance" },
  { row: 16, name: "Killroy: Masterclass drops" },
  { row: 17, name: "Killroy: World 7 skill EXP" },
  { row: 18, name: "Killroy: Daily coral gain" },
];

/** The short name of the Killroy shop's row r, or null. */
export const killroyName = (r: number): string | null =>
  KILLROY.find((k) => k.row === r)?.name ?? null;
