// The game's characters as the mosaic has them (spec 008 FR-020): each one's place in the game's list, which is its
// number everywhere outside the screen (FR-010a), and the active one's place. No electron import, so tests can load it.
import type { Characters } from "../shared/index.ts";
import { players } from "./saved-files.ts";

/**
 * The game's list of characters, by place, and the active one's place; null when the mosaic has no active character in
 * the list. The names are for the screen only (FR-010, FR-010a).
 */
export function characterList(mosaicJson: string): Characters {
  const p = players(mosaicJson);
  const first = p?.info[0];
  const active = p && typeof first === "string" ? p.names.indexOf(first) : -1;
  if (!p || active < 0) return null;
  return {
    names: p.names.map((n) => (typeof n === "string" ? n : "")),
    active,
  };
}

/** The active character's place in the game's list of characters, read from the mosaic; null when it is not there. */
export const characterNumber = (mosaicJson: string): number | null =>
  characterList(mosaicJson)?.active ?? null;

/**
 * The picker's list of each new mosaic, sent only when it changed; the mosaic seen last is not read again. `replay`
 * sends the last list again, for a new page.
 */
export function characterSender(
  send: (c: Characters) => void,
  read: (mosaicJson: string) => Characters = characterList,
): { tell: (mosaicJson: string | null) => void; replay: () => void } {
  let seen: string | null = null;
  let last: Characters = null;
  return {
    tell(mosaicJson) {
      if (mosaicJson === seen) return;
      seen = mosaicJson;
      const list = mosaicJson === null ? null : read(mosaicJson);
      const changed = JSON.stringify(list) !== JSON.stringify(last);
      last = list;
      if (changed) send(list);
    },
    replay() {
      send(last);
    },
  };
}
