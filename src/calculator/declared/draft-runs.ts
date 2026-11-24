// The draft over each character run (spec 010, T207, T208): not written yet, the active run's draft as it is.
import type { DraftBlueprint } from "./draft.ts";

export interface DraftRun {
  draft: DraftBlueprint;
  characterClass: number | null;
}

export const joinDrafts = (
  active: DraftRun,
  _others: readonly DraftRun[],
): DraftBlueprint => active.draft;
