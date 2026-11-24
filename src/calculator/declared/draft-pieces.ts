// A common branch as a piece in the draft (spec 010, T203).
import type { CallRef } from "./blueprint.ts";
import type { DraftNode } from "./draft.ts";

/** A branch several sources or recipes call: its piece's name and its ref, a `{param}` for each arg it takes. */
export interface CommonBranch {
  name: string;
  ref: CallRef;
}
/** A piece the draft writes once (`pieces/<name>.piece.json`). */
export interface DraftPiece {
  id: string;
  params: string[];
  children: DraftNode[];
}
export const COMMON_BRANCHES: readonly CommonBranch[] = [];
