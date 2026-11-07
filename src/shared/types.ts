// Contracts shared by the keeper, the main process, the preload and the window (spec §5 and §6).
import type { ComponentType } from "react";

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
}

export interface Entry {
  name: string;
  status: "deduced" | "confirmed";
}

/** The tables a player can name from the window. */
export type CatalogTable = "menu" | "menu2" | "codex";

/** names.json (spec §5.3). */
export interface Catalog {
  version: 1;
  /** MenuType; a key can be "0.1" */
  menu: Record<string, Entry>;
  /** MenuType2 */
  menu2: Record<string, Entry>;
  /** OptionsList[12] */
  codex: Record<string, Entry>;
  /** Quik Ref icons (reference) */
  quickref: Record<string, Entry>;
  /** CustomLists.MapDispName */
  maps: string[];
  /** MonsterDefinitions Name, by monster id */
  afk: Record<string, string>;
}

/** One reading translated by the catalog (spec §6.2). */
export interface GameContext {
  screen: {
    world: number;
    map: number;
    menu: number;
    window: number;
    tab: number;
    codexTab: number | null;
    codexSel: string | number | null;
  };
  character: string | null;
  afk: string | null;
  names: {
    map?: string;
    menu?: Entry;
    window?: Entry;
    codexTab?: Entry;
    afk?: string;
  };
  unnamed: { table: CatalogTable; key: string }[];
  snapshot?: unknown;
  updatedAt: number;
}

export interface Status {
  game: "running" | "closed" | "not-launched";
  reader: "attached" | "connecting" | "error";
  message?: string;
  lastReadingAt?: number;
}

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
  catalogName: "catalog:name",
  settingsGet: "settings:get",
  settingsSet: "settings:set",
  confirmAttach: "reader:confirm-attach",
} as const;

/** A channel reserved for one module: `module:<id>:<name>`. */
export function moduleChannel(id: string, name: string): string {
  return `module:${id}:${name}`;
}

/** What the preload exposes to the window as `window.companion`. Each `on*` returns its unsubscribe. */
export interface CompanionApi {
  onContext(cb: (ctx: GameContext) => void): () => void;
  onStatus(cb: (status: Status) => void): () => void;
  name(table: CatalogTable, key: string, name: string): Promise<void>;
  getSettings(): Promise<Settings>;
  setSettings(s: Settings): Promise<void>;
  confirmAttach(): Promise<void>;
}
