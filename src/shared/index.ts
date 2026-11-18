// Public API of src/shared: other folders import from here, and the keeper and the app the screen catalog from screens/index.ts.
export { createLineDecoder, encodeLine, isObject, LINK_PIPE } from "./link.ts";
export type { LinkMessage } from "./link.ts";
export {
  CAP_KINDS,
  COMBINE_KINDS,
  CONDITION_KINDS,
  LEAF_FAMILY,
  LEAF_KINDS,
  NODE_ROLES,
  POOL_KINDS,
  SHARE_MODES,
  VALUE_FORMATS,
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
export {
  changes,
  compareTrees,
  compareValues,
  pieceValues,
} from "./formula-tree-compare.ts";
export { modulesFor } from "./modules.ts";
export { MINUS, plain, valueText } from "./row-text.ts";
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
export {
  ACTORS_PIECE,
  NUMBER_IDS,
  STATE_EXCLUDED,
  STATE_SPLIT,
  VARS_KEYS,
} from "./state.ts";
export type {
  CalcNumbers,
  StateClass,
  StatePath,
  StateSlice,
} from "./state.ts";
export {
  formatNumber,
  rootText,
  STATS_NUMBERS,
  statsNumber,
} from "./stats-text.ts";
export {
  catalogName,
  isCatalogId,
  isLiveNumber,
  LIVE_MAP_TEXT,
  PANEL_SCREENS,
  panelSystems,
  TREE_CATALOG,
} from "./tree-catalog.ts";
export type { CatalogNumber } from "./tree-catalog.ts";
export {
  DEFAULT_SETTINGS,
  DEFAULT_VIEW,
  GAME_UPDATED,
  IPC,
  MARKS_FULL,
  MAX_MARK_NAME,
  MAX_MARKS,
  MAX_PINS,
  moduleChannel,
  NO_TABLES,
  PINS_FULL,
} from "./types.ts";
export type {
  Characters,
  CompanionApi,
  CompanionModule,
  FarmUpdate,
  FormulaRequestBody,
  GameContext,
  GameTables,
  LiveValues,
  Mark,
  Pin,
  RadarChange,
  RadarUpdate,
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
  ViewPrefs,
} from "./types.ts";
