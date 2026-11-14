// The farm measure (spec 008 FR-028, data-model "Medição de farm"): XP, gold and items per hour of the active
// character, only from the differences between the keeper's slices, never by a formula. It counts on a map that is not
// a town, pauses in a town, goes on back on the same map and starts over on another; a character change or a closed
// game is idle again. Only in memory: nothing here is ever written or logged.
import type { FarmUpdate, GameTables, StateSlice } from "../shared/index.ts";

/** With the reader attached, slices come many times a second: a longer gap is time with no reading, not counted. */
const GAP_MS = 5_000;
/** Between changes of state, the strip gets the numbers at most this often. */
const SEND_EVERY_MS = 10_000;
const EMPTY_SLOT = "Blank";

/** The game's own test of a town: its scene's name (the map's `MapName`) has "Town" (farm.test.ts proves it). */
export const isTown = (scene: string): boolean => scene.includes("Town");

const isNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const numbers = (v: unknown): number[] | null =>
  Array.isArray(v) && v.every(isNumber) ? v : null;
const texts = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every((x) => typeof x === "string") ? v : null;

/** The top pieces the measure reads, as the slice carries them; anything of another shape is left out. */
function piecesOf(s: StateSlice) {
  const top = new Map<string, unknown>();
  for (const { path, value } of s.pieces)
    if (path.length === 1) top.set(path[0], value);
  const money = top.get("Money");
  return {
    xp: numbers(top.get("Exp0")),
    req: numbers(top.get("ExpReq0")),
    gold: isNumber(money) ? money : null,
    order: texts(top.get("InventoryOrder")),
    qty: numbers(top.get("ItemQuantity")),
  };
}

function totals(order: string[], qty: number[]): Map<string, number> {
  const by = new Map<string, number>();
  order.forEach((id, i) => {
    const n = qty[i];
    if (id !== EMPTY_SLOT && n !== undefined) by.set(id, (by.get(id) ?? 0) + n);
  });
  return by;
}

const add = <K>(m: Map<K, number>, k: K, n: number) => {
  if (n > 0) m.set(k, (m.get(k) ?? 0) + n);
};

export function farmTracker(deps: {
  send: (f: FarmUpdate) => void;
  now?: () => number;
}): {
  onState(s: StateSlice): void;
  onMap(map: number, isTown: boolean): void;
  /** The game's item names, for the list. */
  tables(t: GameTables): void;
  /** The game closed: idle, and every value forgotten. */
  reset(): void;
  /** The last numbers again, to a new page of the window. */
  replay(): void;
  snapshot(): FarmUpdate;
} {
  const now = deps.now ?? Date.now;
  let state: FarmUpdate["state"] = "idle";
  let map: number | null = null;
  /** Undefined until the first slice: the first character seen is no change. */
  let char: string | null | undefined;
  let counted = 0;
  let tick: number | null = null;
  let sentAt = -Infinity;
  let names: Record<string, string> | null = null;
  /** What was read last, also while idle or paused: the next difference starts from it. */
  let last: {
    xp: number[] | null;
    req: number[] | null;
    gold: number | null;
    order: string[] | null;
    qty: number[] | null;
    items: Map<string, number> | null;
  } = blank();
  /** What was gained while counting, by skill and by item. */
  let xp = new Map<number, number>();
  let gold = 0;
  let items = new Map<string, number>();

  function blank(): typeof last {
    return {
      xp: null,
      req: null,
      gold: null,
      order: null,
      qty: null,
      items: null,
    };
  }

  function snapshot(): FarmUpdate {
    const hours = counted / 3_600_000;
    const rate = (n: number) => (hours > 0 ? n / hours : 0);
    const name = (id: string) =>
      names && Object.hasOwn(names, id) ? (names[id] ?? id) : id;
    return {
      state,
      minutes: Math.floor(counted / 60_000),
      xpPerHour: rate(Math.max(0, ...xp.values())),
      goldPerHour: rate(gold),
      items: [...items]
        .map(([id, n]) => ({ name: name(id), perHour: rate(n) }))
        .toSorted((a, b) => b.perHour - a.perHour),
    };
  }

  function send(force: boolean): void {
    const t = now();
    if (!force && t - sentAt < SEND_EVERY_MS) return;
    sentAt = t;
    deps.send(snapshot());
  }

  /** Counts the time since the last event, while counting; a gap counts nothing. */
  function clock(): void {
    const t = now();
    if (state === "counting" && tick !== null && t - tick <= GAP_MS)
      counted += t - tick;
    tick = t;
  }

  function start(m: number): void {
    state = "counting";
    map = m;
    counted = 0;
    xp = new Map();
    gold = 0;
    items = new Map();
  }

  function reset(): void {
    const was = state;
    state = "idle";
    map = null;
    char = undefined;
    counted = 0;
    tick = null;
    last = blank();
    xp = new Map();
    gold = 0;
    items = new Map();
    if (was !== "idle") send(true);
  }

  /** Reads a slice into `last`; the differences are gains only when `counting`. */
  function measure(s: StateSlice, counting: boolean): void {
    const p = piecesOf(s);
    if (p.xp) {
      const before = last.xp;
      if (counting && before)
        p.xp.forEach((n, i) => {
          const was = before[i];
          if (was === undefined) return;
          // Lower is a level up: what was left to the level, by the requirement read before it, and the new XP.
          const gained =
            n >= was ? n - was : Math.max(0, (last.req?.[i] ?? was) - was) + n;
          add(xp, i, gained);
        });
      last.xp = p.xp;
    }
    if (p.req) last.req = p.req;
    if (p.gold !== null) {
      if (counting && last.gold !== null)
        gold += Math.max(0, p.gold - last.gold);
      last.gold = p.gold;
    }
    if (p.order) last.order = p.order;
    if (p.qty) last.qty = p.qty;
    if ((p.order || p.qty) && last.order && last.qty) {
      // ponytail: the slot list and the quantities are paired as last read; a move between two reads of them can count
      // a little, and an item taken out of storage counts as found. Pair them by the slice's cycle if that shows.
      const held = totals(last.order, last.qty);
      const before = last.items;
      if (counting && before)
        for (const [id, n] of held) add(items, id, n - (before.get(id) ?? 0));
      last.items = held;
    }
  }

  return {
    onState(s) {
      if (char !== undefined && s.sentinel.char !== char) reset();
      char = s.sentinel.char;
      if (char === null) return;
      // After a gap with no reading the time is not counted, so neither is what changed in it: this slice starts again.
      const gap = tick !== null && now() - tick > GAP_MS;
      clock();
      measure(s, state === "counting" && !gap);
      if (state === "counting") send(false);
    },
    onMap(m, town) {
      clock();
      const was = state;
      const wasMap = map;
      if (town) {
        if (state === "counting") state = "paused";
      } else if (state === "idle" || m !== map) start(m);
      else state = "counting";
      if (state !== was || map !== wasMap) send(true);
    },
    tables(t) {
      names = t.items;
    },
    reset,
    replay() {
      deps.send(snapshot());
    },
    snapshot,
  };
}
