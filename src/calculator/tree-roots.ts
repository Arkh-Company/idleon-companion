// Catalog id → the exact call of the game under the tree's root, with the game's arity and the kind of each argument
// ("0" text is not 0; handoff, traps 12 and 14), as the bench recorded it (BASELINE-4). Only the calculator knows the
// calls (`nothing-imports-the-calculator`); tree-roots.test.ts pins this table to the catalog. The Stats numbers keep the
// Stats' call, `(sub, 0, 0)`, so the root equals the Stats (FR-019).
import calls from "./root-calls.json" with { type: "json" };

export type TreeRoot = readonly [
  block: string,
  args: readonly (string | number)[],
];

/** JSON reads a pair as an array of any length: the shape of each entry is checked by tree-roots.test.ts. */
export const TREE_ROOTS = calls as unknown as Readonly<
  Record<string, TreeRoot>
>;
