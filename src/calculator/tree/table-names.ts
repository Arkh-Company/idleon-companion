// The names a rule reads from a game table at the row the tree asks (spec 008, T023; spec Open Questions): the turn
// recipes of pieces.cjs `entryRows` `turnName` and the table texts of `rename` NAMES, derived from the recipes of the
// names table. Each reads a table the recipes read, over the installed game: the table the worker's reader gave at the
// boot with the bench's sha256 (game-names.ts), the same check as the recipes'. A table that changed, or a cell that is
// no text, names nothing; the rule then says what the bench says of a row with no text, or nothing.
import { isNameText, transformText } from "./name-text.ts";
import { partTable } from "./names-table.ts";
import type { NamePart } from "./names-table.ts";

type At = (i: string | number) => readonly (string | number)[];
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

/** The text that names row `i` of a table text, or null. */
export function tableText(
  kind: keyof typeof TABLE_TEXTS,
  i: string | number,
): string | null {
  const t = TABLE_TEXTS[kind];
  return partText({
    table: t.table,
    index: t.at(i),
    field: t.field,
    transform: t.transform,
  });
}
