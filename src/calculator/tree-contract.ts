// The calculator's copy of the tree contract (src/shared/formula-tree.ts): the calculator imports only its own files
// (`calculator-alone`). tree-contract.test.ts pins it both ways; change both files together.

export const CALC_LEAF_KINDS = [
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
type CalcLeafKind = (typeof CALC_LEAF_KINDS)[number];

export const CALC_CONDITION_KINDS = [
  "owned",
  "done",
  "active",
  "equalsValue",
  "max",
  "limit",
] as const;

export const CALC_NODE_ROLES = [
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

export const CALC_LEAF_FAMILY = {
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
} as const satisfies Record<CalcLeafKind, "grows" | "pick" | "set" | null>;

export interface CalcTreeFlags {
  unknown?: boolean;
  unnamed?: boolean;
  unavailable?: boolean;
  fromCache?: boolean;
  fromGame?: boolean;
  runtime?: boolean;
  truncated?: boolean;
  closed?: boolean;
  progress?: boolean;
  gameBug?: string;
}

export interface CalcTreeNode {
  id: string;
  pieceKey: string | null;
  name: string;
  value: number | boolean | null;
  was?: number | boolean | null;
  fmt: "x" | "%" | "+" | null;
  leaf: CalcLeafKind | null;
  condition: (typeof CALC_CONDITION_KINDS)[number] | null;
  why: string | null;
  formula:
    | [names: string[], numbers: number[]]
    | { rule: [names: string, numbers: string] }
    | null;
  code: string | null;
  role: (typeof CALC_NODE_ROLES)[number];
  combine?: "sum" | "product" | "onePlusPercent" | "max" | "min" | null;
  poolKind?: "additive" | "multi" | null;
  share: number | null;
  shareMode:
    | "sum"
    | "product"
    | "productZero"
    | "cap"
    | "capZero"
    | "mixed"
    | "condition"
    | "unknown"
    | null;
  cap?: "overTheCap" | "notReached";
  maxReached?: { share: number; max: number };
  feeds?: number;
  flags: CalcTreeFlags;
  kids: CalcTreeNode[] | "lazy";
}

export type CalcTreeRequest =
  | { type: "number"; id: string; character: number }
  | { type: "expand"; treeId: string; nodeId: string };
