// What a cache read needs of the tree being built to open into what its writer computed (tree/caches.ts).
import type { RecNode } from "../recording.ts";
import type { CodeFormulas } from "./code-formulas.ts";
import type { Entries } from "./entries.ts";
import type { Row } from "./rows.ts";
import type { Step } from "../recorded/steps.ts";
import type { Terms } from "./terms.ts";

export interface CacheContext {
  nodes: readonly RecNode[];
  entries: Entries;
  writerByValue(p: string, value: unknown): RecNode | null;
  /** The steps of call `id`. */
  steps(id: number): readonly Step[];
  /** The rows of call `id`, or null when the depth limit or a cycle cuts it. */
  explain(id: number, depth: number, seen: ReadonlySet<number>): Row[] | null;
  /** The writers of a call's cache reads, by path. */
  linksOf(n: RecNode): ReadonlyMap<string, number>;
  /** The terms of writer `w`'s steps, with its own links: the rows they make open under `seen`. */
  terms(w: RecNode, seen: readonly number[]): Terms;
  finish(v: unknown, rows: Row[], ones: boolean): Row[];
  /** The ⓘ the game's code gives (tree/code-formulas.ts). */
  formulas: CodeFormulas;
}
