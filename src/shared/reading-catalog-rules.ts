// The rules of the catalog, with no import of the table: plain Node runs this file (scripts/reading-inventory.ts).
import { NUMBER_IDS } from "./state.ts";
import type { StateClass, StatePath } from "./state.ts";

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

const COLUMNS = 10;
const NO_NUMBERS = ["nenhum", "não medido", "só quebra"];
const ALL_NUMBERS = "todos";
const NATURES = [
  "dado de origem",
  "cache derivado",
  "tabela fixa",
  "rascunho",
  "interface",
];
const OTHER_CHARACTERS = "OutrosPersonagens.";

function parseNumbers(cell: string): string[] {
  if (NO_NUMBERS.includes(cell)) return [];
  if (cell === ALL_NUMBERS) return [...NUMBER_IDS];
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
  const [
    name,
    type,
    ,
    nature,
    numbers,
    changesOn,
    mechanic,
    feature,
    reading,
    group,
  ] = cells as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  return {
    name: name.replaceAll("`", ""),
    type,
    bytes,
    nature,
    numbers: parseNumbers(numbers),
    changesOn,
    mechanic,
    feature,
    reading: reading as CatalogRow["reading"],
    group,
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
    ? `Personagem.${sub}`
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
      !name.startsWith(OTHER_CHARACTERS)
        ? "rápida"
        : "lenta";
    if ((reading as string) !== expected)
      problems.push(
        `${name}: reading "${reading}", the rule says "${expected}"`,
      );
    return problems;
  });
}
