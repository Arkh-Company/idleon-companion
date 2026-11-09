// A reading translated by the screen catalog and the game's tables into the one context every module sees.
import { identifyScreen, SCREEN_CATALOG } from "../shared/index.ts";
import type { GameContext, GameTables, Reading } from "../shared/index.ts";

const orUnknown = (name: string | undefined, unknown: string) =>
  name === undefined || name.trim() === "" ? unknown : name;

export function toContext(r: Reading, tables: GameTables): GameContext {
  const { maps, monsters } = tables;
  // Object.hasOwn: a negative or fractional number is no index of the list, and an id like "constructor" no monster.
  const map = maps && Object.hasOwn(maps, r.map) ? maps[r.map] : undefined;
  const monster =
    monsters && r.afk !== null && Object.hasOwn(monsters, r.afk)
      ? monsters[r.afk]
      : undefined;

  return {
    screen: {
      world: Math.floor(r.map / 50) + 1,
      map: r.map,
      label: identifyScreen(r, SCREEN_CATALOG),
    },
    character: r.char,
    afk: r.afk,
    names: {
      map: orUnknown(map, "Unknown map"),
      afk:
        r.afk === null || r.afk === "Nothing"
          ? "None"
          : orUnknown(monster, "Unknown monster"),
    },
    updatedAt: r.t,
  };
}

/** Keeps the last reading and tables: each new one sends the context again, and a reading must exist to send anything. */
export function contextTracker(send: (c: GameContext) => void): {
  reading(r: Reading): void;
  tables(t: GameTables): void;
  replay(): void;
} {
  let last: Reading | null = null;
  let known: GameTables = { maps: null, monsters: null };
  const replay = () => {
    if (last) send(toContext(last, known));
  };
  return {
    reading(r) {
      last = r;
      replay();
    },
    tables(t) {
      known = t;
      replay();
    },
    replay,
  };
}
