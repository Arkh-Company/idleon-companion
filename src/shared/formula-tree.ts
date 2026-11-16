// The contract of a formula tree (specs/008-formula-trees/data-model.md): what the tree worker builds, the main checks
// and the window draws. The calculator cannot import this folder, so it keeps a pinned copy (src/calculator/tree-contract.ts).

/** The leaf types, by their role in the math (FR-013). */
export const LEAF_KINDS = [
  "level",
  "quantity",
  "fixedValue",
  "rawBonus",
  "condition",
  "choice",
  "tier",
  "record",
  "investedPoints",
  "unknown",
] as const;
export type LeafKind = (typeof LEAF_KINDS)[number];

/** The subtypes of a `condition` leaf. */
export const CONDITION_KINDS = [
  "owned",
  "done",
  "active",
  "equalsValue",
  "max",
  "limit",
] as const;
export type ConditionKind = (typeof CONDITION_KINDS)[number];

export const NODE_ROLES = [
  "root",
  "step",
  "system",
  "subsystem",
  "pool",
  "bucket",
  "atZero",
  "atOne",
  "small",
  "piece",
  "row",
] as const;
export type NodeRole = (typeof NODE_ROLES)[number];

/** The color family of each leaf type; `unknown` has none (FR-013). */
export const LEAF_FAMILY = {
  level: "grows",
  quantity: "grows",
  investedPoints: "grows",
  tier: "grows",
  record: "grows",
  condition: "pick",
  choice: "pick",
  fixedValue: "set",
  rawBonus: "set",
  unknown: null,
} as const satisfies Record<LeafKind, "grows" | "pick" | "set" | null>;

export const SHARE_MODES = [
  "sum",
  "product",
  "productZero",
  "cap",
  "capZero",
  "mixed",
  "condition",
  "unknown",
] as const;
export type ShareMode = (typeof SHARE_MODES)[number];

/** How a row writes its value: × for a multiplier, % and + for what adds (design.md §3.6). */
export const VALUE_FORMATS = ["x", "%", "+"] as const;
/** A row over its cap, or under it (FR-015). */
export const CAP_KINDS = ["overTheCap", "notReached"] as const;

export interface TreeFlags {
  unknown?: boolean;
  unnamed?: boolean;
  unavailable?: boolean;
  fromCache?: boolean;
  fromGame?: boolean;
  runtime?: boolean;
  truncated?: boolean;
  /** A group that starts closed. */
  closed?: boolean;
  /** A loop step, counted apart. */
  progress?: boolean;
  /** The id of a game-bug rule, never free text. */
  gameBug?: string;
}

/** One row of a tree. */
export interface TreeNode {
  /** Unique in the tree: the path of names, with `#n` on repeats. */
  id: string;
  /** Block + JSON of the arguments (+ character index): the same key is the same piece in any tree (FR-009). */
  pieceKey: string | null;
  name: string;
  /** null = unavailable */
  value: number | boolean | null;
  /** The value of the tree before, or of the mark (FR-024, FR-025). */
  was?: number | boolean | null;
  fmt: (typeof VALUE_FORMATS)[number] | null;
  leaf: LeafKind | null;
  condition: ConditionKind | null;
  /** Why a `?`, in a player's words. */
  why: string | null;
  /** "How it adds up": names and numbers only (FR-012a); a rule ("If …: 35", "yes → 35") as its two lines of text. */
  formula:
    | [names: string[], numbers: number[]]
    | { rule: [names: string, numbers: string] }
    | null;
  /** Block and arguments or path, only in "Game details". */
  code: string | null;
  role: NodeRole;
  /** Weight in the parent, 0..1. */
  share: number | null;
  shareMode: ShareMode | null;
  cap?: (typeof CAP_KINDS)[number];
  maxReached?: { share: number; max: number };
  /** How many catalog numbers use this piece; only when 2 or more (FR-027). */
  feeds?: number;
  flags: TreeFlags;
  /** "lazy": a branch the worker builds when it is opened (research R4). */
  kids: TreeNode[] | "lazy";
}

/** Window → main → worker. The main checks `id` against the catalog before it reaches the worker. */
export type TreeRequest =
  | { type: "number"; id: string; character: number }
  | { type: "expand"; treeId: string; nodeId: string };

/** Main → window, on `formula:update`. */
export type FormulaTree =
  | { state: "none" }
  | { state: "waiting" }
  | { state: "calculating"; request: TreeRequest }
  | {
      state: "unavailable";
      request: TreeRequest;
      /** A live-game number whose map actor is not on the map (FR-023); absent when the calculator failed. */
      liveMap?: true;
    }
  | { state: "diverged"; request: TreeRequest; statsText: string }
  | {
      state: "ready";
      request: TreeRequest;
      title: string;
      /** Written by the main with the Stats row's formatter. */
      rootText: string;
      statsValue: number | null;
      character: number;
      activeCharacter: number;
      calculatedAt: number;
      gameChanged: boolean;
      /** False shows the version band (FR-018). */
      checkedOnThisGame: boolean;
      /** The game is closed: the last reading (FR-022). */
      stale: boolean;
      comparingWith: string | null;
      counts: { nodes: number };
      root: TreeNode;
    };
