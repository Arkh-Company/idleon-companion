// Public API of src/shared: other folders import from here only.
export { createLineDecoder, encodeLine, isObject, LINK_PIPE } from "./link.ts";
export type { LinkMessage } from "./link.ts";
export { modulesFor } from "./modules.ts";
export { toReading } from "./reading.ts";
export { DEFAULT_SETTINGS, GAME_UPDATED, IPC, moduleChannel } from "./types.ts";
export type {
  Catalog,
  CatalogTable,
  CompanionApi,
  CompanionModule,
  Entry,
  GameContext,
  Reading,
  Settings,
  SetupFailure,
  SetupProgress,
  Status,
  SteamState,
  UpdateState,
} from "./types.ts";
