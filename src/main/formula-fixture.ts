// Builders of the formula tests in src/main: a tree node with every field, as the tree worker sends it. Every value and
// name here is invented.
import type { TreeNode } from "../shared/index.ts";

export const node = (over: Partial<TreeNode> = {}): TreeNode => ({
  id: "root",
  pieceKey: '[0,"InventedBlock","sub",0,0]',
  name: "Total",
  value: 2.5,
  fmt: "x",
  leaf: null,
  condition: null,
  why: null,
  formula: [
    ["Base", "Bonus"],
    [1, 1.5],
  ],
  code: 'InventedBlock("sub", 0, 0)',
  role: "root",
  share: null,
  shareMode: "sum",
  flags: {},
  kids: [],
  ...over,
});
