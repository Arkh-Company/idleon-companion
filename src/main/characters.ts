// The game's characters as the mosaic has them (spec 008 FR-020): each one's place in the game's list, which is its
// number everywhere outside the screen (FR-010a), its class, and the active one's place. No electron import, so tests
// can load it.
import { isObject } from "../shared/index.ts";
import type { Characters } from "../shared/index.ts";
import { players } from "./saved-files.ts";

/** An own entry of a Haxe map as the mosaic carries it. */
const entry = (map: unknown, key: string): unknown =>
  isObject(map) && isObject(map.$m) && Object.hasOwn(map.$m, key)
    ? map.$m[key]
    : undefined;

/**
 * The game's list of characters, by place, each one's class by the game's class names (`classNames`, read by the keeper)
 * and the active one's place; null when the mosaic has no active character in the list. The active one's class number
 * is the running game's, another's its copy in PlayerDATABASE. The names are for the screen only (FR-010, FR-010a).
 */
export function characterList(
  mosaicJson: string,
  classNames: readonly string[] | null = null,
): Characters {
  const p = players(mosaicJson);
  const first = p?.info[0];
  const active = p && typeof first === "string" ? p.names.indexOf(first) : -1;
  if (!p || active < 0) return null;
  const names = p.names.map((n) => (typeof n === "string" ? n : ""));
  const classOf = (name: string, i: number) => {
    const n =
      i === active
        ? p.attrs.CharacterClass
        : entry(entry(p.attrs.PlayerDATABASE, name), "CharacterClass");
    return (typeof n === "number" ? classNames?.[n] : undefined) ?? null;
  };
  return { names, classes: names.map(classOf), active };
}

/** The active character's place in the game's list of characters, read from the mosaic; null when it is not there. */
export const characterNumber = (mosaicJson: string): number | null =>
  characterList(mosaicJson)?.active ?? null;

/**
 * The picker's list of each new mosaic, sent only when it changed; the mosaic seen last is not read again until new
 * class names come (`tables`). `replay` sends the last list again, for a new page.
 */
export function characterSender(
  send: (c: Characters) => void,
  read: typeof characterList = characterList,
): {
  tell: (mosaicJson: string | null) => void;
  tables: (classNames: readonly string[] | null) => void;
  replay: () => void;
} {
  let seen: string | null = null;
  let classNames: readonly string[] | null = null;
  let last: Characters = null;
  const update = () => {
    const list = seen === null ? null : read(seen, classNames);
    const changed = JSON.stringify(list) !== JSON.stringify(last);
    last = list;
    if (changed) send(list);
  };
  return {
    tell(mosaicJson) {
      if (mosaicJson === seen) return;
      seen = mosaicJson;
      update();
    },
    tables(c) {
      classNames = c;
      update();
    },
    replay() {
      send(last);
    },
  };
}
