// The catalog of the state's pieces: the table in reading-catalog.md is the single source of the reading lists (R4).
import { parseCatalog } from "./reading-catalog-rules.ts";
import type { CatalogRow } from "./reading-catalog-rules.ts";
import text from "./reading-catalog.md?raw";

// Marked pure so a bundle that never reads the catalog (the preload, the window) leaves the table out.
export const CATALOG: readonly CatalogRow[] =
  /* @__PURE__ */ parseCatalog(text);
