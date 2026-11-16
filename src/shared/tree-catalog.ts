// The numbers that have a formula tree (data-model.md, "Catálogo de números"): what the window lists and the main
// accepts in a request. The game's call of each id is not here: it lives in the calculator (src/calculator/tree-roots.ts),
// pinned against this list by a test. The list is the bench's curation at BASELINE-4 (CATALOGO-008-app), in the game's
// order (FR-038): identifiers only, never a phrase of the game (FR-032), and each number's name on screen from the names
// table (catalog-names.test.ts in the calculator pins it); tree-catalog.test.ts checks each field.
import numbers from "./number-catalog.json" with { type: "json" };

export interface CatalogNumber {
  /** Unique and stable. */
  id: string;
  /**
   * The name on screen: the root's proven name in the names table, else the bench's P2 rule's (Vinicius, 16/11),
   * pinned by src/calculator/catalog-names.test.ts; null only while a root waits for the bench's name.
   */
  name: string | null;
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

/** The numbers that need a map actor's field (FR-023), in the catalog's order. */
export const LIVE_IDS: readonly string[] = TREE_CATALOG.filter(
  (n) => n.live,
).map((n) => n.id);

const LIVE_SET: ReadonlySet<string> = new Set(LIVE_IDS);

/** The number needs a map actor's field (FR-023). */
export const isLiveNumber = (id: string): boolean => LIVE_SET.has(id);

/** Why a live-game number has no value (FR-023): the map actor it reads is not on the map the player is in. */
export const LIVE_MAP_TEXT =
  "Needs the live map: go to a map in the game where this number applies.";

const CATALOG_IDS: ReadonlySet<string> = new Set(TREE_CATALOG.map((n) => n.id));

/** Each system with a panel (FR-003), in the catalog's order, with the screens that show it. */
export const PANEL_SCREENS: ReadonlyMap<string, readonly string[]> =
  TREE_CATALOG.reduce((all, { system, screen }) => {
    const screens = all.get(system) ?? [];
    if (screen !== null && !screens.includes(screen))
      all.set(system, [...screens, screen]);
    return all;
  }, new Map<string, string[]>());

/**
 * The systems whose panel a screen shows: the catalog's screen that is the label, or the deepest one the label is a
 * tab of ("Stamps › Bribes" is Bribes, "Stamps › Combat" is Stamps). Systems that share that screen are all shown.
 */
export function panelSystems(label: string): string[] {
  let depth = -1;
  let systems: string[] = [];
  for (const [system, screens] of PANEL_SCREENS)
    for (const s of screens) {
      if (label !== s && !label.startsWith(`${s} › `)) continue;
      // Two screens that both open the label are one a tab of the other: the longer is the deeper.
      if (s.length > depth) [depth, systems] = [s.length, []];
      if (s.length === depth && !systems.includes(system)) systems.push(system);
    }
  return systems;
}

const NAMES: ReadonlyMap<string, string | null> = new Map(
  TREE_CATALOG.map((n) => [n.id, n.name]),
);

/** The catalog number's name on screen; null outside the catalog or while it waits for the bench's name. */
export const catalogName = (id: string): string | null => NAMES.get(id) ?? null;

/** The id is a number of the catalog. */
export const isCatalogId = (id: unknown): id is string =>
  typeof id === "string" && CATALOG_IDS.has(id);
