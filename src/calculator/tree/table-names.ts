// The names a rule reads from a game table at the row the tree asks (spec 008, T023; spec Open Questions): the turn
// recipes of pieces.cjs `entryRows` `turnName` and the table texts of `rename` NAMES, derived from the recipes of the
// names table. Each reads a table the recipes read, over the installed game: the table the worker's reader gave at the
// boot with the bench's sha256 (game-names.ts), the same check as the recipes'. A table that changed, or a cell that is
// no text, names nothing; the rule then says what the bench says of a row with no text, or nothing.
import { isNameText, transformText } from "./name-text.ts";
import { partTable } from "./names-table.ts";
import type { NamePart } from "./names-table.ts";

type At = (...i: (string | number)[]) => readonly (string | number)[];
interface TableText {
  /** The table, by the id its hash goes by (an item or a monster by its entry). */
  test: RegExp;
  table: string;
  at: At;
  field: string | null;
  transform: string;
  proof: string;
}
const text = (
  table: string,
  at: At,
  field: string | null,
  transform: string,
  proof: string,
): TableText => ({
  test: new RegExp(`^${table.replace(/\./g, "\\.")}(?:\\.|$)`),
  table,
  at,
  field,
  transform,
  proof,
});

/** Each table text, by what it names; its table is one the names table's recipes read (table-names.test.ts). */
export const TABLE_TEXTS = {
  sign: text(
    "CustomLists.StarSigns",
    (s) => [s, 0],
    null,
    "clean",
    "bench pieces.cjs entryRows turnName, sign; N.js StarSigns",
  ),
  /** The words of a star sign's bonus, and the word after them (spec 009 T031). */
  signBonus: text(
    "CustomLists.StarSigns",
    (s) => [s, 1],
    null,
    "clean",
    "N.js StarSigns (the bonus text of the sign)",
  ),
  signBonusMore: text(
    "CustomLists.StarSigns",
    (s) => [s, 2],
    null,
    "clean",
    "N.js StarSigns (the bonus text of the sign)",
  ),
  /** The bonus of sigil i at the tier of column col (spec 009 T031), a number read by `tableNumber`. */
  sigilTier: text(
    "CustomLists.SigilDesc",
    (s, col) => [s, col],
    null,
    "raw",
    "N.js Labb SigilBonus (the bonus of the sigil at a tier)",
  ),
  /** The max level of Legend Talent i (spec 009 T031), a number read by `tableNumber`. */
  legendMax: text(
    "CustomLists.LegendTalents",
    (l) => [l, 1],
    null,
    "raw",
    "N.js Thingies LegendTalent_MaxLV (the max level of the talent)",
  ),
  /** The bonus of the Meritocracy vote t (spec 009 T031), a number of the table, read by `tableNumber`. */
  vote: text(
    "CustomLists.NinjaInfo",
    (t) => [41, 1 + 3 * Number(t)],
    null,
    "raw",
    "N.js Summoning2 MeritocBonusz (the bonus of the vote t)",
  ),
  /** A class's family bonus (spec 009 T031), as the recipes of FamilyBonsuesREAL read it. */
  family: text(
    "CustomLists.ClassFamilyBonuses",
    (c) => [c, 0],
    null,
    "clean-keep-case",
    "N.js FamilyBonsuesREAL (the family bonus of class c)",
  ),
  artifact: text(
    "CustomLists.ArtifactInfo",
    (a) => [a, 0],
    null,
    "clean",
    "bench pieces.cjs entryRows turnName, artifact; N.js Sailing",
  ),
  colour: text(
    "CustomLists.GamingPalette",
    (c) => [c, 3],
    null,
    "clean",
    "bench pieces.cjs entryRows turnName, colour; N.js Spelunk",
  ),
  /** The monster a Summoning battle is against, by its id. */
  battle: text(
    "CustomLists.SummonEnemies",
    (b) => [0, b],
    null,
    "raw",
    "bench pieces.cjs entryRows turnName, battle; N.js Summoning",
  ),
  monster: text(
    "MonsterDefinitionsGET",
    (id) => [id],
    "Name",
    "clean",
    "bench pieces.cjs entryRows turnName monName",
  ),
  item: text(
    "ItemDefinitionsGET",
    (id) => [id],
    "displayName",
    "clean",
    "bench pieces.cjs itemName",
  ),
  cosmo: text(
    "CustomLists.CosmoUpgrades",
    (t, i) => [t, i, 2],
    null,
    "clean",
    "N.js Holes CosmoBonusQTY, the level of the Cosmo upgrade t, i",
  ),
  god: text(
    "CustomLists.GodsInfo",
    (g) => [g, 0],
    null,
    "clean",
    "bench pieces.cjs rename NAMES AUDIT-E N; N.js Divinity",
  ),
  shinyType: text(
    "CustomLists.RANDOlist",
    (t) => [91, t],
    null,
    "clean",
    "bench pieces.cjs rename NAMES AUDIT-E N; N.js Breeding",
  ),
  meal: text(
    "CustomLists.MealINFO",
    (r) => [r, 0],
    null,
    "clean",
    "bench pieces.cjs rename NAMES OPUS4-3; N.js TalentCalc",
  ),
  eventShop: text(
    "CustomLists.NinjaInfo",
    (i) => [39, 2 * Number(i)],
    null,
    "raw(split '_@_' [0])",
    "bench pieces.cjs rename NAMES B2-5 rule 72; N.js Summoning2",
  ),
  summonUpgrade: text(
    "CustomLists.SummonUPG",
    (i) => [i, 3],
    null,
    "raw",
    "bench pieces.cjs rename NAMES B2-4 rule 71; N.js Summoning",
  ),
  /** A collectible's per-unit number, the second field of its text (pieces.cjs opus2Arena E: a number, not a name). */
  jar: text(
    "CustomLists.HolesInfo",
    (t) => [67, t],
    null,
    "raw(split '|' [1])",
    "bench pieces.cjs opus2Arena E; N.js Holes2",
  ),
  skill: text(
    "CustomLists.SkillNames",
    (s) => [s],
    null,
    "raw",
    "bench pieces.cjs rename NAMES deep-2 skillNameOf; N.js RiftStuff",
  ),
  // the game state paths' rules (tree/state-names.ts)
  compass: text(
    "CustomLists.CompassUpg",
    (n) => [n, 0],
    null,
    "clean",
    "N.js Windwalker CompassBonus",
  ),
  jelly: text(
    "CustomLists.JellyUPG",
    (n) => [n, 0],
    null,
    "clean",
    "N.js JellyOperation UpgradeQTY",
  ),
  talent: text(
    "CustomLists.TalentIconNames",
    (n) => [n],
    null,
    "clean",
    "N.js TalentCalc",
  ),
  tome: text(
    "CustomLists.Tome",
    (k) => [k, 0],
    null,
    "clean",
    "N.js _customEvent_TomeQTY",
  ),
  lab: text(
    "CustomLists.LabMainBonus",
    (k) => [k, 6],
    null,
    "clean",
    "N.js MainframeBonus",
  ),
  dream: text(
    "CustomLists.DreamUpg",
    (u) => [u, 0],
    null,
    "clean",
    "N.js Dreamstuff",
  ),
  /** The kind of a Summoning win's bonus, a number: the bonus's text is the kind's, one row up (`summonWinText`). */
  summonWin: text(
    "CustomLists.SummonEnemies",
    (r) => [9, r],
    null,
    "raw",
    "N.js Summoning WinBonus",
  ),
  summonWinText: text(
    "CustomLists.SummonEnemies",
    (t) => [6, t],
    null,
    "clean",
    "N.js Summoning WinBonus",
  ),
  landRankUpgrade: text(
    "CustomLists.NinjaInfo",
    (k) => [34, k],
    null,
    "clean",
    "N.js FarmingStuffs LankRankUpgBonus",
  ),
  bubba: text(
    "CustomLists.BubbaUpg",
    (t) => [t, 0],
    null,
    "clean",
    "N.js Bubbastuff TotUpgBonus",
  ),
  atom: text(
    "CustomLists.AtomInfo",
    (n) => [n, 0],
    null,
    "clean",
    "N.js AtomCollider",
  ),
  research: text(
    "CustomLists.Research",
    (list, i) => [list, i],
    null,
    "clean",
    "N.js MenagerieStuff BoostQTY; N.js FarmingStuffs StickerBonus",
  ),
  killroyShop: text(
    "CustomLists.SkullShopDesc",
    (q) => [q, 0],
    null,
    "clean",
    "N.js RandomEvent KillroyBonuses",
  ),
  fishToolkit: text(
    "CustomLists.FishToolkitInfo",
    (k, j) => [k, j, 0],
    null,
    "clean",
    "N.js FishingToolkit",
  ),
  ninjaItem: text(
    "CustomMaps.NjEQ",
    (id) => [id, 2],
    null,
    "clean",
    "N.js Ninja GemstoneBonus",
  ),
  summonUpgradeName: text(
    "CustomLists.SummonUPG",
    (n) => [n, 3],
    null,
    "clean",
    "N.js Summoning SummUpgBonus",
  ),
} as const;

// ponytail: one set of the installed game's tables per worker, set once at its boot (tree-engine.ts), as the names'.
let gameTables: ReadonlyMap<string, unknown> = new Map();
/** The tables of the installed game whose sha256 is the bench's, in the bench's canonical form (game-names.ts). */
export function useGameTables(tables: ReadonlyMap<string, unknown>): void {
  gameTables = tables;
}
/** Whether a table the reader gave is one a table text reads (only those are kept from the boot). */
export const isTextTable = (id: string): boolean =>
  Object.values(TABLE_TEXTS).some((t) => t.test.test(id));

// (a parsed JSON has no text on its prototypes: a "length" or a "constructor" is no text either)
const step = (v: unknown, k: string | number): unknown =>
  v !== null && typeof v === "object"
    ? (v as Record<string, unknown>)[String(k)]
    : undefined;

/** The text of a part over the installed game's checked table, transformed; null when it has none that may be a name. */
export function partText(p: NamePart): string | null {
  // a list's index starts inside the list; an item's or a monster's first index is its entry, the id of its table
  const inside = p.table.includes(".") ? p.index : p.index.slice(1);
  let v = inside.reduce<unknown>(step, gameTables.get(partTable(p)));
  if (p.field !== null) v = step(v, p.field);
  if (typeof v !== "string") return null;
  const name = transformText(p.transform, v);
  return name && isNameText(name) ? name : null;
}

/** The number in the cell of row `i` of a table text, over the installed game's checked table; null with none. */
export function tableNumber(
  kind: keyof typeof TABLE_TEXTS,
  ...i: (string | number)[]
): number | null {
  const t = TABLE_TEXTS[kind];
  const index = t.at(...i);
  const p = { table: t.table, index, field: null, transform: t.transform };
  // as in partText: an item's or a monster's first index is its entry, the id of its table
  const inside = t.table.includes(".") ? index : index.slice(1);
  const v = inside.reduce<unknown>(step, gameTables.get(partTable(p)));
  const x = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
  return Number.isFinite(x) ? x : null;
}

/** The text that names row `i` of a table text, or null. */
export function tableText(
  kind: keyof typeof TABLE_TEXTS,
  ...i: (string | number)[]
): string | null {
  const t = TABLE_TEXTS[kind];
  return partText({
    table: t.table,
    index: t.at(...i),
    field: t.field,
    transform: t.transform,
  });
}

/** How many rows the checked table of a table text has; null when the boot did not check it as a list. */
export function tableRows(kind: keyof typeof TABLE_TEXTS): number | null {
  const v = gameTables.get(TABLE_TEXTS[kind].table);
  return Array.isArray(v) ? v.length : null;
}
