// The numbers that have a formula tree (data-model.md, "Catálogo de números"): what the window lists and the main
// accepts in a request. The game's call of each id is not here: it lives in the calculator (src/calculator/tree-roots.ts),
// pinned against this list by a test. The list is the bench's curation at BASELINE-4 (CATALOGO-008-app), in the game's
// order (FR-038): identifiers only, never a phrase of the game (FR-032); tree-catalog.test.ts checks each field.
import numbers from "./number-catalog.json" with { type: "json" };

export interface CatalogNumber {
  /** Unique and stable. */
  id: string;
  /** The group of the Formulas tab, in the order of FR-038: Character, Account, W1…W7, then the skills. */
  group: string;
  /** The system or skill, inside the group (the second level of the Formulas tab). */
  system: string;
  /** The screen's name in the screen catalog (003), or null: only in the Formulas tab. */
  screen: string | null;
  /** The closed group of the panel (FR-004). */
  notShown: null | "cost" | "cap" | "chance" | "rate";
  /** Needs a map actor's field (FR-023). */
  live: boolean;
}

export const TREE_CATALOG = numbers as readonly CatalogNumber[];

const CATALOG_IDS: ReadonlySet<string> = new Set(TREE_CATALOG.map((n) => n.id));

/** The id is a number of the catalog. */
export const isCatalogId = (id: unknown): id is string =>
  typeof id === "string" && CATALOG_IDS.has(id);
