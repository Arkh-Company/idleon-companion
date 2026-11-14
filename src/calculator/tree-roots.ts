// Catalog id → the exact call of the game under the tree's root, with the game's arity (handoff, trap 12). Only the
// calculator knows the calls (`nothing-imports-the-calculator`); tree-roots.test.ts pins this table to the catalog.
import { TARGETS } from "./targets.ts";

export type TreeRoot = readonly [
  block: string,
  args: readonly (string | number)[],
];

/** The Stats numbers keep the Stats' call, `(sub, 0, 0)`, so the root equals the Stats (FR-019). */
export const TREE_ROOTS: Readonly<Record<string, TreeRoot>> =
  Object.fromEntries(
    TARGETS.map(([id, block, arg]) => [id, [block, [arg, 0, 0]]] as const),
  );
