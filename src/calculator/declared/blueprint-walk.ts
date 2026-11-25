// The walk of a blueprint's check on load (spec 010, contracts/blueprint.md; moved out of blueprint.ts as it was): the
// level of a node, what the walk carries down, and the check of a piece's count and list.
import type { Trees } from "./blueprint-links.ts";
import { checkCallModel, checkEach, isObj, no } from "./blueprint-root.ts";
import type { BlueprintPending } from "./blueprint-types.ts";

/** `piece`: a child of a node with `combine`, inside a recipe piece. */
export type Level = "source" | "child" | "condition" | "piece";
export interface Walk {
  systems: ReadonlySet<string>;
  pending: (kind: BlueprintPending["kind"], where: string) => boolean;
  places: Set<string>;
  pieces: ReadonlyMap<string, unknown>;
  trees: Trees;
  /** The pieces whose body is being checked, the outermost first: a call of one of them again is a cycle. */
  stack: readonly string[];
  /** The node is a part of a count (a child of a combine), the piece it calls included. */
  combined?: boolean;
  /** The node is the model child of a pool's source with `each` (T174, T176). */
  eachModel?: boolean;
  /** The node is below a pool's source, out of any combine: a piece's pools have a root's children (T172). */
  recipe?: boolean;
  /** The node is a child of a cache's read (`DNSM.*`): its author, the one place `any` may be (T208). */
  author?: boolean;
}

/**
 * A piece's count and list (T170, T171): `combine` and `each` only inside a piece, the list a path with one `[*]`; a
 * pool's source with `each` and no `combine` (`poolEach`, T174) takes its items from the answer key, in any recipe, and
 * a node below it (`free`, T202), from its level's parts.
 */
export function checkPieceLevel(
  n: Record<string, unknown>,
  where: string,
  w: Walk,
  poolEach: boolean,
  free = poolEach,
): void {
  if (!free && (n.combine !== undefined || n.each !== undefined)) {
    if (w.stack.length === 0) no(where, "combine e each só em pedaço");
    if (n.combine !== "sum" && n.combine !== "product")
      no(where, "combine é sum ou product");
  }
  // a call's level closes by its own recorded count (the Seraph); a read's has none of its own
  const call = isObj(n.ref) && "call" in n.ref;
  if (
    !poolEach &&
    !w.recipe &&
    w.stack.length > 0 &&
    n.children !== undefined &&
    n.combine === undefined &&
    !call
  )
    no(
      where,
      "nó com children num pedaço pede combine, menos o de uma chamada",
    );
  if (n.each === undefined) return;
  checkEach(n.each, where, poolEach);
  const calls = isObj(n.each) && "calls" in n.each;
  if (!Array.isArray(n.children) || (!calls && n.children.length !== 1))
    no(where, "each tem um filho-modelo só");
  if (calls) checkCallModel(n.each, n.children, where);
}
