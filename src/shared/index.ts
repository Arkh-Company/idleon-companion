// Public API of src/shared: other folders import from here only.
export { createLineDecoder, encodeLine, isObject, LINK_PIPE } from "./link.ts";
export type { LinkMessage } from "./link.ts";
export { modulesFor } from "./modules.ts";
export { toReading } from "./reading.ts";
export { READ_NULLS } from "./reading-fixture.ts";
export {
  KNOWN_WINDOWS,
  parseScreenCatalog,
  SCREEN_CATALOG,
} from "./screens/catalog.ts";
export { identifyScreen } from "./screens/identify.ts";
export { DEFAULT_SETTINGS, GAME_UPDATED, IPC, moduleChannel } from "./types.ts";
export type {
  CompanionApi,
  CompanionModule,
  GameContext,
  GameTables,
  Reading,
  ScreenCatalog,
  ScreenRule,
  Settings,
  SetupFailure,
  SetupProgress,
  Status,
  SteamState,
  UpdateState,
} from "./types.ts";
