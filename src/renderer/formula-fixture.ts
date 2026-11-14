// Builders of the window's formula tests: a tree node with every field and a ready tree, as the main sends them. Every
// value and name here is invented.
import type { FormulaTree, TreeNode } from "../shared/index.ts";

export const node = (over: Partial<TreeNode> = {}): TreeNode => ({
  id: "root",
  pieceKey: null,
  name: "Total",
  value: 2.5,
  fmt: null,
  leaf: null,
  condition: null,
  why: null,
  formula: null,
  code: null,
  role: "piece",
  share: null,
  shareMode: null,
  flags: {},
  kids: [],
  ...over,
});

export type ReadyTree = Extract<FormulaTree, { state: "ready" }>;

export const ready = (
  root: TreeNode,
  over: Partial<ReadyTree> = {},
): ReadyTree => ({
  state: "ready",
  request: { type: "number", id: "dropRate", character: 1 },
  title: "Drop Rate",
  rootText: "1,234x",
  statsValue: 1234.5,
  character: 1,
  activeCharacter: 1,
  calculatedAt: 1_000,
  gameChanged: false,
  checkedOnThisGame: true,
  stale: false,
  comparingWith: null,
  counts: { nodes: 1 },
  root: { ...root, id: "root", role: "root" },
  ...over,
});
