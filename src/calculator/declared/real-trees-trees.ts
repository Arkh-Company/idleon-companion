// The trees the check mode writes (spec 010, T040, FR-023, contracts/real-trees-run.md): the whole tree, open to the
// leaves, in TREES_OUT/trees/<id>.json, the run before's moved to previous/trees/ first for the changes' report. Apart
// from real-trees-run.ts, which is near the 400 lines.
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { CalcTreeNode } from "../tree-contract.ts";
import type { LockResult } from "./lock.ts";
import { outPath, TARGET } from "./real-trees-run.ts";

/** A number's tree: in TREES_OUT only, `trees/<id>.json`, or the run before's in `previous/trees/`. */
function treePath(out: string, id: string, previous = false): string {
  if (!TARGET.test(id))
    throw new Error("árvore fora da regra: um id do catálogo");
  return outPath(out, ...(previous ? ["previous"] : []), "trees", `${id}.json`);
}

/** The run before's tree goes to `previous/trees/`; nothing when there is none. */
export function moveToPrevious(out: string, id: string): void {
  const from = treePath(out, id);
  if (!existsSync(from)) return;
  const to = treePath(out, id, true);
  mkdirSync(dirname(to), { recursive: true });
  renameSync(from, to);
}

/** The whole tree, open to the leaves, in `trees/<id>.json`. */
export function writeTree(out: string, id: string, tree: CalcTreeNode): void {
  const file = treePath(out, id);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(tree, null, 1)}\n`);
}

/** A number the lock refuses gets no new tree; a draft does when all it lacks is its pending places, marked. */
export const getsTree = (lock: LockResult, complete: boolean): boolean =>
  lock.ok || (!complete && lock.errors.every((e) => e.kind === "pending"));

/** The run before's tree to previous/ always; this run's in trees/ only when it gets one, so a refused number has none. */
export function keepTree(
  out: string,
  id: string,
  tree: CalcTreeNode | undefined,
  lock: LockResult,
  complete: boolean,
): void {
  moveToPrevious(out, id);
  if (tree && getsTree(lock, complete)) writeTree(out, id, tree);
}
