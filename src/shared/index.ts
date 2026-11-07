// Public API of src/shared: other folders import from here only.
export { createLineDecoder, encodeLine, LINK_PIPE } from "./link.ts";
export type { LinkMessage } from "./link.ts";
export { DEFAULT_SETTINGS, IPC, moduleChannel } from "./types.ts";
export type {
  Catalog,
  CatalogTable,
  CompanionApi,
  CompanionModule,
  Entry,
  GameContext,
  Reading,
  Settings,
  Status,
} from "./types.ts";
