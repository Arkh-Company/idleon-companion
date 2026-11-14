// Public API of src/shared: other folders import from here, and the keeper and the app the screen catalog from screens/index.ts.
export { createLineDecoder, encodeLine, isObject, LINK_PIPE } from "./link.ts";
export type { LinkMessage } from "./link.ts";
export {
  CONDITION_KINDS,
  LEAF_FAMILY,
  LEAF_KINDS,
  NODE_ROLES,
} from "./formula-tree.ts";
export type {
  ConditionKind,
  FormulaTree,
  LeafKind,
  NodeRole,
  ShareMode,
  TreeFlags,
  TreeNode,
  TreeRequest,
} from "./formula-tree.ts";
export { modulesFor } from "./modules.ts";
export { toReading } from "./reading.ts";
export { READ_NULLS } from "./reading-fixture.ts";
export { identifyScreen } from "./screens/identify.ts";
export { CATALOG } from "./reading-catalog.ts";
export {
  ACTIONS_GROUP,
  CHARACTER_ROW,
  groupOf,
} from "./reading-catalog-rules.ts";
export type { CatalogRow } from "./reading-catalog-rules.ts";
export { NUMBER_IDS, STATE_EXCLUDED, STATE_SPLIT, VARS_KEYS } from "./state.ts";
export type {
  CalcNumbers,
  StateClass,
  StatePath,
  StateSlice,
} from "./state.ts";
export { isCatalogId, TREE_CATALOG } from "./tree-catalog.ts";
export type { CatalogNumber } from "./tree-catalog.ts";
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
  Stats,
  Status,
  SteamState,
  UpdateState,
} from "./types.ts";
