// The numbers that have a formula tree (data-model.md, "Catálogo de números"): what the window lists and the main
// accepts in a request. The game's call of each id is not here: it lives in the calculator (src/calculator/tree-roots.ts),
// pinned against this list by a test.
import { NUMBER_IDS } from "./state.ts";

export interface CatalogNumber {
  /** Unique and stable. */
  id: string;
  /** The system or skill: the group of the Formulas tab, in the game's order (FR-038). */
  system: string;
  /** The screen's name in the screen catalog (003), or null: only in the Formulas tab. */
  screen: string | null;
  /** The closed group of the panel (FR-004). */
  notShown: null | "cost" | "cap" | "chance" | "rate";
  /** Needs a map actor's field (FR-023). */
  live: boolean;
}

// ponytail: the 11 Stats numbers only; the bench's trees enter when their status and system mapping are decided.
export const TREE_CATALOG: readonly CatalogNumber[] = NUMBER_IDS.map((id) => ({
  id,
  system: "Character",
  screen: null,
  notShown: null,
  live: false,
}));

const CATALOG_IDS: ReadonlySet<string> = new Set(TREE_CATALOG.map((n) => n.id));

/** The id is a number of the catalog. */
export const isCatalogId = (id: unknown): id is string =>
  typeof id === "string" && CATALOG_IDS.has(id);
