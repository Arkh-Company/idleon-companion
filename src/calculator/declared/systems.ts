// The systems table of the declared trees (spec 010, FR-006, research R8): a blueprint cites a system by its id, and the
// group's emoji and name come from here, so a system always has the same emoji. The V1's systems come first, in its
// order (spec 009), then the systems beyond it; no "Other": a source with no system is a recipe to fix.
import systems from "../blueprints/systems.json" with { type: "json" };

export interface SystemEntry {
  id: string;
  name: string;
  emoji: string;
  /** Where the system is in the game (a block, a screen or a table), by reference. */
  proof: string;
}

export const SYSTEMS: readonly SystemEntry[] = systems;

const BY_ID = new Map(SYSTEMS.map((s) => [s.id, s]));

export const systemById = (id: string): SystemEntry | null =>
  BY_ID.get(id) ?? null;

/** The group's name: its emoji, then its system ("🎯 Talents"). */
export const systemLabel = (e: SystemEntry): string => `${e.emoji} ${e.name}`;
