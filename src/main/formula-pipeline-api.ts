// The contract of the formula pipeline (formula-pipeline.ts): what it needs from the main process and what it gives
// back. No electron import, so tests can load it.
import type { FormulaTree, LiveValues, Mark, Status } from "../shared/index.ts";
import type { FormulaLog } from "./formula-answer.ts";
import type { FormulaRequest } from "./payloads.ts";
import type { patchRadar } from "./radar.ts";
import type { savedFiles } from "./saved-files.ts";
import type { StatsPair } from "./stats-pipeline.ts";
import type { createTreeHost } from "./tree-host.ts";

export type TreeHost = Pick<
  ReturnType<typeof createTreeHost>,
  "request" | "values" | "dropCurrent" | "setFiles" | "stop" | "shape"
>;

export interface FormulaPipelineDeps {
  send: (tree: FormulaTree) => void;
  sendValues: (v: LiveValues) => void;
  treeHost: (on: {
    onTree(id: number, tree: unknown, log?: "chainOpen"): void;
    onUnavailable(id: number): void;
    onValues(id: number, values: unknown): void;
    onShape(id: number, shape: unknown): void;
  }) => TreeHost;
  statsPair: () => StatsPair | null;
  /** Whether the game's code is the one the name and type rules were checked on (the version band, FR-018). */
  checkedOnThisGame: () => boolean;
  log: (entry: FormulaLog) => void;
  /** The tree shapes saved on this computer, which the index of Where this goes is built from (FR-027). */
  shapes: ReturnType<typeof savedFiles>["shapes"];
  /** The patch radar, which the shapes of a new game version are compared for (FR-029, FR-035). */
  radar?: ReturnType<typeof patchRadar>;
}

export interface FormulaPipeline {
  /** A request the main already checked (`formulaRequestPayload`). */
  request(r: FormulaRequest): void;
  /** `formula:close`: no tree open. */
  close(): void;
  /** `formula:values`: what the window has in view, already checked (`formulaValuesPayload`). */
  values(ids: string[]): void;
  /** The pinned numbers: in view whatever the window shows (FR-026). */
  pinned(ids: string[]): void;
  /** The Stats sent something: maybe a new pair, maybe none (a character change). */
  statsChanged(): void;
  status(s: Status): void;
  gameFiles(resources: string): void;
  replay(): void;
  /** What a mark of `character` takes: the open tree's values by piece, and the names the file must never get. */
  markOf(character: number): { values: Mark["values"]; names: string[] } | null;
  /** The tree host read the game's code: its sha256, the version the shapes are saved for. */
  gameRead(sha: string): void;
  /** `feeds:list`: the catalog numbers that use a piece, each one a tree to open (FR-027). */
  feeds(pieceKey: string): string[];
}
