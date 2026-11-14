// Contracts shared by the keeper, the main process, the preload and the window (spec §5 and §6).
import type { ComponentType } from "react";
import type { FormulaTree } from "./formula-tree.ts";

/** What the reader takes from the game every second (spec §5.1). */
export interface Reading {
  /** epoch ms */
  t: number;
  /** CurrentMap */
  map: number;
  /** MenuType (0 none, 1 Items, 2 Talents, 3 Codex, 4 World map, 5 Menu, 6 Attacks; .1/.2/.78 shortcuts) */
  menu: number;
  /** MenuType2: system window or Menu tab */
  menu2: number;
  /** MenuType2TabSelected */
  menu2tab: number;
  /** SkillTabSelected */
  skillTab: number;
  /** UserInfo[0]; null = no character selected */
  char: string | null;
  /** AFKtarget (monster id) */
  afk: string | null;
  /** OptionsList[12] */
  codexTab: number | null;
  /** Quests: OptionsList[13][2]; Friends: NonCloudsave[0][2] */
  codexSel: string | number | null;
  /** engine.scene.name */
  scene: string | null;
  /** AttackSelected */
  attack: number | null;
  /** InventorySelected */
  bag: number | null;
  /** OptionsList[1] */
  ol1: number | null;
  /** OptionsList[3] */
  ol3: number | null;
  /** OptionsList[18] */
  ol18: number | null;
  /** OptionsList[19] */
  ol19: number | null;
  /** OptionsListAccount[489] */
  ola489: number | null;
  /** NONdummies[37] */
  nd37: number | null;
  /** Holes[0][the character's place in GetPlayersUsernames]; -1 = outside a cave */
  hole: number | null;
  /** H<n>.<field>[<index>] or H<n>.<field>; a behavior not yet in the game has no key */
  behaviors: Record<string, number | string | boolean | null>;
}

/** One line of the screen catalog: `when` holds equalities, all of them needed, on Reading fields or behavior keys. */
export interface ScreenRule {
  when: Record<string, number | string>;
  /** The whole path, separated by " › " */
  name: string;
  /** The screen has tabs or subscreens: when this rule wins, the tab is unknown. */
  tabs?: true;
  /** foto:<id> or sprite:<name> */
  proof: string;
}

export interface ScreenCatalog {
  overlays: ScreenRule[];
  screens: ScreenRule[];
  /** MenuType2 numbers that exist in the game and have no proof yet */
  unprovenWindows: number[];
}

/** The names in the installed game's code; null = could not read that table. */
export interface GameTables {
  /** Name by map number */
  maps: string[] | null;
  /** Name by monster id */
  monsters: Record<string, string> | null;
  /** Name by item id, for the farm's list (spec 008 FR-028) */
  items: Record<string, string> | null;
}

/** One reading translated by the screen catalog and the game's tables. */
export interface GameContext {
  screen: {
    world: number;
    map: number;
    /** identifyScreen's result */
    label: string;
  };
  character: string | null;
  /** The monster id read, for the modules */
  afk: string | null;
  names: {
    /** The map's name or "Unknown map" */
    map: string;
    /** The monster's name, "Unknown monster" or "None" */
    afk: string;
  };
  snapshot?: unknown;
  updatedAt: number;
}

export interface Status {
  game: "running" | "closed" | "not-launched";
  /** "released": the keeper let go of the page ("Let the game close"); the debugging pipe stays open. */
  reader: "attached" | "connecting" | "error" | "released";
  message?: string;
  lastReadingAt?: number;
}

/** `Status.message` when a game update stopped the reader until the game reopens: "Reconnect" would do nothing (spec,
 * Open Questions, 08/11). */
export const GAME_UPDATED = "Game updated: the reader needs an update";

/** settings.json (spec §5.5). */
export interface Settings {
  showWindowOnGameStart: boolean;
  closeWithGame: boolean;
  alwaysOnTop: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  showWindowOnGameStart: true,
  closeWithGame: true,
  alwaysOnTop: false,
};

/** A feature of the companion (spec §6.3). v1 has no `service` (plan, Kit decision 4). */
export interface CompanionModule {
  id: string;
  title: string;
  needs: ("live-screen" | "live-snapshot" | "game-code" | "game-tables")[];
  matches(ctx: GameContext): boolean;
  Panel: ComponentType<{
    ctx: GameContext;
    send: (msg: unknown) => Promise<unknown>;
  }>;
  settings?: Record<string, unknown>;
}

/** The fixed IPC channels between the main process and the window (spec §5.4). */
export const IPC = {
  contextUpdate: "context:update",
  statusUpdate: "status:update",
  settingsGet: "settings:get",
  settingsSet: "settings:set",
  confirmAttach: "reader:confirm-attach",
  steamState: "steam:state",
  steamSetup: "steam:setup",
  steamProgress: "steam:progress",
  readerRelease: "reader:release",
  readerReconnect: "reader:reconnect",
  updateState: "update:state",
  updateInstall: "update:install",
  statsUpdate: "stats:update",
  // Spec 008 (specs/008-formula-trees/contracts/ipc.md).
  formulaRequest: "formula:request",
  formulaUpdate: "formula:update",
  formulaClose: "formula:close",
  formulaValues: "formula:values",
  formulaLiveValues: "formula:liveValues",
  panelUpdate: "panel:update",
  marksList: "marks:list",
  marksSave: "marks:save",
  marksClear: "marks:clear",
  pinsGet: "pins:get",
  pinsSet: "pins:set",
  feedsList: "feeds:list",
  farmUpdate: "farm:update",
  radarUpdate: "radar:update",
  radarDismiss: "radar:dismiss",
  sidePanel: "window:sidePanel",
} as const;

/** `formula:request`: a catalog number (the active character when `character` is absent), or a branch to open. */
export type FormulaRequestBody =
  { id: string; character?: number } | { treeId: string; nodeId: string };

/** `formula:liveValues`: the numbers in view, by catalog id; null = unavailable. */
export interface LiveValues {
  values: Record<string, number | null>;
  calculatedAt: number;
  stale: boolean;
}

/** One saved mark of a character (contracts/saved-files.md): values by piece, never a name of a row. */
export interface Mark {
  name: string;
  takenAt: number;
  values: Record<string, number | boolean>;
}

/** One pinned number, without its value. */
export interface Pin {
  treeId: string;
  nodeId: string | null;
}

/** How many numbers the Pin strip holds, and the sentence of one more (FR-036). */
export const MAX_PINS = 5;
export const PINS_FULL = "Up to 5 pins: unpin one first.";

/** `farm:update`: only measured, for the active character (FR-028). */
export interface FarmUpdate {
  state: "idle" | "counting" | "paused";
  minutes: number;
  xpPerHour: number;
  goldPerHour: number;
  items: { name: string; perHour: number }[];
}

/** What a game update changed in one tree's shape: names of parts new, gone and renamed (FR-029). */
export interface RadarChange {
  catalogId: string;
  added: string[];
  removed: string[];
  renamed: [before: string, after: string][];
}

/**
 * `radar:update`: the trees whose shape changed with a game update (FR-035), `checking` while old trees are still to be
 * compared, and the warning of a shapes file that could not be read (FR-041); null when there is nothing to show.
 */
export type RadarUpdate = {
  changed: RadarChange[];
  checking: boolean;
  warning: string | null;
} | null;

/** What the setup screen shows (data-model.md): read from Steam's files on request, never written. */
export interface SteamState {
  steam: "found" | "not-found";
  /** `name` is PersonaName, read on request and never saved (FR-028). */
  account: { id: string; name: string } | null;
  game: "installed" | "not-installed";
  /** Null when Steam, the account or the file cannot be read. */
  option: {
    /** "" when empty */
    current: string;
    /** the text after adding the companion's part */
    next: string;
    /** "other-companion": `--keeper ` before %command% without this companion's part (a warning, no setup). */
    state: "not-set" | "companion" | "other-companion" | "other";
    /** the user's text runs a .cmd/.bat before %command% (a warning) */
    consoleScript: boolean;
  } | null;
  /** The most recent account has the companion's part. */
  configured: boolean;
  /** FR-014 */
  gameOpen: boolean;
  /** An unreadable file or an unexpected shape (nothing is written). */
  error?: string;
  details: { file: string; backup: string } | null;
  /** The companion's part followed by %command%, to paste by hand (Edge Cases, FR-011). */
  manualOption: string;
}

export type SetupFailure =
  | "game-open"
  | "steam-did-not-close"
  | "unreadable-config"
  | "steam-did-not-open";

/** One step of setting up or removing (data-model.md). Only "steam-did-not-open" comes after the write. */
export type SetupProgress =
  | "closing-steam"
  | "setting-up"
  | "opening-steam"
  | "done"
  | { step: "failed"; reason: SetupFailure };

/** The app's update, main → window (data-model.md). `canInstall` is false while the game is open. */
export type UpdateState =
  | { state: "none" }
  | { state: "downloading"; version: string }
  | { state: "ready"; version: string; canInstall: boolean }
  | { state: "check-failed" };

/** What the Stats tab shows, main → window (data-model.md). */
export type Stats =
  | { state: "none" }
  | { state: "calculating" }
  | { state: "ready"; rows: { label: string; text: string }[] }
  /** The game closed: the last numbers, calculated at `calculatedAt` (FR-022 of 008). */
  | {
      state: "ready";
      rows: { label: string; text: string }[];
      stale: true;
      calculatedAt: number;
    }
  | { state: "unavailable" };

/** A channel reserved for one module: `module:<id>:<name>`. */
export function moduleChannel(id: string, name: string): string {
  return `module:${id}:${name}`;
}

/** What the preload exposes to the window as `window.companion`. Each `on*` returns its unsubscribe. */
export interface CompanionApi {
  onContext(cb: (ctx: GameContext) => void): () => void;
  onStatus(cb: (status: Status) => void): () => void;
  getSettings(): Promise<Settings>;
  setSettings(s: Settings): Promise<void>;
  confirmAttach(): Promise<void>;
  steamState(): Promise<SteamState>;
  setupSteam(): Promise<SetupProgress>;
  onSetupProgress(cb: (p: SetupProgress) => void): () => void;
  releaseGame(): Promise<void>;
  reconnect(): Promise<void>;
  onUpdate(cb: (u: UpdateState) => void): () => void;
  installUpdate(): Promise<void>;
  onStats(cb: (s: Stats) => void): () => void;
  // Spec 008 (contracts/ipc.md).
  requestFormula(r: FormulaRequestBody): Promise<void>;
  onFormula(cb: (t: FormulaTree) => void): () => void;
  closeFormula(): Promise<void>;
  formulaValues(r: { ids: string[] }): Promise<void>;
  onLiveValues(cb: (v: LiveValues) => void): () => void;
  onPanel(cb: (p: { system: string | null }) => void): () => void;
  /** The character's marks, and once the warning of a file that could not be read (FR-041). */
  listMarks(r: {
    character: number;
  }): Promise<{ marks: Mark[]; warning: string | null }>;
  /** Null when done; else the sentence for the player (FR-037). */
  saveMark(r: { character: number; name: string }): Promise<string | null>;
  clearMark(r: { character: number; name: string }): Promise<string | null>;
  /** The pinned numbers, and once the warning of a file that could not be read (FR-041). */
  getPins(): Promise<{ pins: Pin[]; warning: string | null }>;
  /** Null when saved; else the sentence for the player. */
  setPins(pins: Pin[]): Promise<string | null>;
  /** The catalog numbers that use a piece, in the catalog's order: Where this goes (FR-027). */
  feedsList(r: { pieceKey: string }): Promise<string[]>;
  onFarm(cb: (f: FarmUpdate) => void): () => void;
  onRadar(cb: (r: RadarUpdate) => void): () => void;
  dismissRadar(): Promise<void>;
  setSidePanel(r: { open: boolean }): Promise<void>;
}
