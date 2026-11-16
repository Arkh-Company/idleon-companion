// The rules of the catalog, with no import of the table: plain Node runs this file (scripts/reading-inventory.ts).
import { isObject } from "./link.ts";
import { NUMBER_IDS, VARS_KEYS } from "./state.ts";
import type { StateClass, StatePath } from "./state.ts";
import { LIVE_IDS } from "./tree-catalog.ts";

export interface CatalogRow {
  name: string;
  type: string;
  bytes: number;
  nature: string;
  numbers: string[];
  changesOn: string;
  mechanic: string;
  feature: string;
  reading: "rápida" | "lenta";
  group: string;
}

export const ACTIONS_GROUP = "ações";
export const CHARACTER_ROW = "Personagem.";

const COLUMNS = 10;
const NO_NUMBERS = ["nenhum", "não medido", "só quebra"];
const ALL_NUMBERS = "todos";
/** The live-game numbers of the tree catalog (spec 008 US12): the bench proved each one reads a map actor's field. */
const LIVE_CELL = "jogo vivo";
const NATURES = [
  "dado de origem",
  "cache derivado",
  "tabela fixa",
  "rascunho",
  "interface",
];
const OTHER_CHARACTERS = "OutrosPersonagens.";
/** Rows the keeper never reads in the fast reading: the other characters, and the `_vars`, which have a slot of the slow one. */
const NEVER_FAST = [OTHER_CHARACTERS, "_vars."];

function parseNumbers(cell: string): string[] {
  if (NO_NUMBERS.includes(cell)) return [];
  if (cell === ALL_NUMBERS) return [...NUMBER_IDS];
  if (cell === LIVE_CELL) return [...LIVE_IDS];
  return cell.split(",").map((id) => id.trim());
}

function parseRow(line: string): CatalogRow {
  const cells = line
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
  const bytes = Number(cells[2]);
  if (
    cells.length !== COLUMNS ||
    cells.includes("") ||
    !Number.isInteger(bytes) ||
    bytes < 0
  )
    throw new Error(`bad catalog row: ${line}`);
  const at = (i: number) => cells[i] ?? "";
  return {
    name: at(0).replaceAll("`", ""),
    type: at(1),
    bytes,
    nature: at(3),
    numbers: parseNumbers(at(4)),
    changesOn: at(5),
    mechanic: at(6),
    feature: at(7),
    reading: at(8) as CatalogRow["reading"],
    group: at(9),
  };
}

/** The rows of the table in `text`: its first two `|` lines are the header and the separator. */
export function parseCatalog(text: string): CatalogRow[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
    .slice(2)
    .map(parseRow);
}

/** The row a path belongs to; `null` when no row can describe it (FR-014), as a whole character or the `_vars`. */
export function catalogName(
  path: StatePath,
  char: string | null,
): string | null {
  const [top, child, sub] = path;
  if (child === undefined) return top === "_vars" ? null : top;
  if (sub === undefined) return top === "DNSM" ? `DNSM.${child}` : null;
  return top === "PlayerDATABASE" && child === char
    ? `${CHARACTER_ROW}${sub}`
    : null;
}

function rowOf(
  rows: readonly CatalogRow[],
  path: StatePath,
  char: string | null,
): CatalogRow | undefined {
  const name = catalogName(path, char);
  // ponytail: a linear scan of about 700 rows, a few times per read; a Map if a profile ever shows it.
  return name === null ? undefined : rows.find((r) => r.name === name);
}

export function classOf(
  rows: readonly CatalogRow[],
  path: StatePath,
  char: string | null,
): StateClass {
  return rowOf(rows, path, char)?.reading === "rápida" ? "fast" : "slow";
}

/** The content group of a fast piece; `null` for anything read slowly. */
export function groupOf(
  rows: readonly CatalogRow[],
  path: StatePath,
  char: string | null,
): string | null {
  const row = rowOf(rows, path, char);
  return row?.reading === "rápida" ? row.group : null;
}

/** One message per broken row, naming it; empty when the table obeys FR-003 and FR-012 to FR-014. */
export function catalogProblems(
  rows: readonly CatalogRow[],
  shownNumbers: readonly string[],
): string[] {
  const seen = new Set<string>();
  return rows.flatMap(({ name, nature, numbers, reading }) => {
    const problems: string[] = [];
    if (seen.has(name)) problems.push(`${name}: repeated name`);
    seen.add(name);
    if (!NATURES.includes(nature))
      problems.push(`${name}: unknown nature "${nature}"`);
    const expected =
      numbers.some((n) => shownNumbers.includes(n)) &&
      !NEVER_FAST.some((prefix) => name.startsWith(prefix))
        ? "rápida"
        : "lenta";
    if ((reading as string) !== expected)
      problems.push(
        `${name}: reading "${reading}", the rule says "${expected}"`,
      );
    return problems;
  });
}

function mapOf(value: unknown): Record<string, unknown> {
  return isObject(value) && isObject(value.$m) ? value.$m : {};
}

/** The catalog name of each piece of a real state, sorted: a character's name never comes out, and `_vars` only as the closed list. */
export function inventoryNames(
  state: { attrs: Record<string, unknown>; vars?: Record<string, unknown> },
  char: string,
): string[] {
  const { attrs, vars = {} } = state;
  const names = new Set<string>();
  for (const [top, value] of Object.entries(attrs)) {
    if (top === "DNSM")
      for (const child of Object.keys(mapOf(value))) names.add(`DNSM.${child}`);
    else if (top === "PlayerDATABASE")
      for (const [who, character] of Object.entries(mapOf(value)))
        for (const sub of Object.keys(mapOf(character)))
          names.add(
            who === char
              ? `${CHARACTER_ROW}${sub}`
              : `${OTHER_CHARACTERS}${sub}`,
          );
    else names.add(top);
  }
  for (const key of VARS_KEYS)
    if (Object.hasOwn(vars, key)) names.add(`_vars.${key}`);
  return [...names].sort();
}

/** What a patch brought and took away: the names outside the catalog, and the rows no name answered (FR-022). */
export function diffInventory(
  rows: readonly CatalogRow[],
  names: readonly string[],
): { added: string[]; gone: string[] } {
  const known = new Set(rows.map((r) => r.name));
  const seen = new Set(names);
  return {
    added: names.filter((n) => !known.has(n)).sort(),
    gone: [...known].filter((n) => !seen.has(n)).sort(),
  };
}
