// What a lock's run keeps for the assembly (spec 010, research R11, FR-012): at each place it checked, the value the
// game gave, the recorded expression of its level and its children as the level had them (a model child once per
// item). Only in memory, and only when the run asks for it; the lock's result never carries it (FR-010).
import type { Expr } from "../recorded/steps.ts";
import type { BlueprintNode } from "./blueprint.ts";
import type { LevelOut } from "./lock-levels.ts";

export interface Seen {
  value?: number | null;
  expr?: Expr | null;
  kids?: readonly BlueprintNode[];
  /** The recorded key the node's reference matched by its place (a `*` resolved). */
  key?: string;
}

/** Keeps what a place gave, when the run asks for it; the first of each field stays (a pool's term before its call's). */
export function see(out: LevelOut, where: string, s: Seen): void {
  out.seen?.set(where, { ...s, ...out.seen.get(where) });
}
