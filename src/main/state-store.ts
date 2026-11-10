// The mosaic: the newest value of each piece of the state, only in memory and never logged (FR-007, FR-022).
import {
  ACTIONS_GROUP,
  CATALOG,
  groupOf,
  isObject,
  STATE_EXCLUDED,
  STATE_SPLIT,
  VARS_KEYS,
} from "../shared/index.ts";
import type { StatePath, StateSlice } from "../shared/index.ts";

interface Piece {
  path: StatePath;
  value: unknown;
  text: string;
}

const CHARACTERS = "PlayerDATABASE";
/** Reads in a row that an actions slice may change with no confirmation, about 1 s: after them it is calculated anyway. */
const UNCONFIRMED_READS_LIMIT = 3;

/**
 * Only what the reader sends. A path comes from the link: `__proto__` is dropped so it can never reach a prototype, and
 * a key is either split or whole, so `attrs[top]` is always what the code below expects. Only a character has a third level.
 */
function belongs(path: StatePath): boolean {
  const [top, child, sub] = path;
  if (path.includes("__proto__")) return false;
  if (sub !== undefined) return top === CHARACTERS;
  return child === undefined
    ? !STATE_EXCLUDED.includes(top) && !STATE_SPLIT.includes(top)
    : STATE_SPLIT.includes(top);
}

/** The character with one subkey on top, in a copy: the stored piece stays as it was read. */
function withSubkey(
  whole: unknown,
  sub: string,
  value: unknown,
): Record<string, unknown> {
  // Before the whole character arrives, or when its read failed, there is only the subkey.
  const base = isObject(whole) && isObject(whole.$m) ? whole : { $m: {} };
  return { ...base, $m: { ...(base.$m as object), [sub]: value } };
}

/** A subkey's value inside its whole character, as text; `undefined` when the character does not have it. */
function insideWhole(whole: unknown, sub: string): string | undefined {
  return isObject(whole) && isObject(whole.$m) && Object.hasOwn(whole.$m, sub)
    ? JSON.stringify(whole.$m[sub])
    : undefined;
}

/** The closed list and nothing else, whatever the piece carries. */
function closedList(value: unknown): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  if (isObject(value))
    for (const key of VARS_KEYS)
      if (Object.hasOwn(value, key)) kept[key] = value[key];
  return kept;
}

export function createStateStore(cb: {
  onDue: (mosaicJson: string) => void;
  onCharacter: (char: string | null) => void;
}): { add(s: StateSlice): void; clear(): void } {
  let char: string | null = null;
  const pieces = new Map<string, Piece>();
  let changed = false;
  /** Actions pieces that changed and whose next read has not come equal yet (R7, "Confirmando"). */
  const unsettled = new Set<string>();
  /** Reads in a row that brought a change to the actions and left it unconfirmed. */
  let unconfirmedReads = 0;
  let calculated = false;
  let fast = 0;
  let map: number | null = null;
  /** The map changed: nothing is due until a whole pass of the fast reading on the new one. */
  let held = false;
  /** Where this mosaic started: `cycles` counts the keeper's rotations, not the ones it received whole. */
  let start: { all: number; fresh: boolean } | null = null;

  function wipe(): void {
    pieces.clear();
    changed = false;
    calculated = false;
    fast = 0;
    start = null;
  }

  /** The whole character replaces its subkeys; one it disagrees with is a change no later read of the subkey would see. */
  function dropSubkeys(child: string, whole: unknown): void {
    for (const [key, { path, text }] of pieces) {
      if (path.length !== 3 || path[1] !== child) continue;
      if (insideWhole(whole, path[2]) !== text) note(path, key, true);
      pieces.delete(key);
    }
  }

  /** What is stored for a path, as text; a subkey dropped by its whole character answers with the value inside it. */
  function storedText(path: StatePath, key: string): string | undefined {
    const stored = pieces.get(key)?.text;
    const [top, child, sub] = path;
    if (stored !== undefined || sub === undefined || child === undefined)
      return stored;
    return insideWhole(pieces.get(JSON.stringify([top, child]))?.value, sub);
  }

  /**
   * What a read of a piece means for the next calculation; `isNew` when its value differs from the stored one.
   * Answers whether it is a change of the actions, the only one that counts towards the limit.
   */
  function note(path: StatePath, key: string, isNew: boolean): boolean {
    const group = groupOf(CATALOG, path, char);
    if (group === ACTIONS_GROUP) {
      if (isNew) unsettled.add(key);
      else if (unsettled.delete(key)) changed = true;
      return isNew;
    }
    if (group !== null && isNew) changed = true;
    return false;
  }

  function mosaicJson(): string {
    const attrs: Record<string, unknown> = {};
    let vars: unknown = {};
    for (const { path, value } of pieces.values()) {
      const [top, child, sub] = path;
      if (top === "_vars") vars = value;
      else if (child === undefined) attrs[top] = value;
      else {
        // Both split maps are `haxe.ds.StringMap`, the calculator's default: no `$c`.
        const split = (attrs[top] ??= { $m: {} }) as {
          $m: Record<string, unknown>;
        };
        // A character's subkeys always come after it here: `add` drops them when the whole character arrives.
        split.$m[child] =
          sub === undefined ? value : withSubkey(split.$m[child], sub, value);
      }
    }
    return JSON.stringify({ attrs, vars, skipped: STATE_EXCLUDED });
  }

  return {
    add(s) {
      if (s.sentinel.char !== char) {
        wipe();
        char = s.sentinel.char;
        cb.onCharacter(char);
      }
      if (char === null) return;
      start ??= {
        all: s.cycles.all,
        fresh: s.cycles.all === 0 && s.cycles.fast === 0,
      };
      if (map !== null && s.sentinel.map !== map) held = true;
      map = s.sentinel.map;
      let actionsMoved = false;
      for (const { path, value } of s.pieces) {
        if (!belongs(path)) continue;
        const kept = path[0] === "_vars" ? closedList(value) : value;
        const key = JSON.stringify(path);
        const text = JSON.stringify(kept);
        // A `_vars` read that failed comes empty: it must not erase the good ones. With none yet, `vars` stays `{}`.
        if (path[0] === "_vars" && text === "{}") continue;
        // A subkey read as `null` says nothing: it must not cover the value of the whole character.
        if (path.length === 3 && value === null) continue;
        if (path[0] === CHARACTERS && path.length === 2)
          dropSubkeys(path[1], kept);
        if (note(path, key, storedText(path, key) !== text))
          actionsMoved = true;
        pieces.set(key, { path, value: kept, text });
      }
      if (unsettled.size === 0) unconfirmedReads = 0;
      else if (actionsMoved) unconfirmedReads += 1;
      // A map change zeroes `fast` in the keeper, so a rise always means a whole pass on the new map.
      if (s.cycles.fast > fast) held = false;
      fast = s.cycles.fast;
      // Joined midway, the next rise of `all` only closes the rotation already begun: it takes one more.
      const ready =
        unsettled.size === 0
          ? changed
          : unconfirmedReads >= UNCONFIRMED_READS_LIMIT;
      const due = calculated
        ? ready && !held
        : s.cycles.fast >= 1 &&
          s.cycles.all >= start.all + (start.fresh ? 1 : 2);
      if (!due) return;
      calculated = true;
      changed = false;
      unsettled.clear();
      unconfirmedReads = 0;
      cb.onDue(mosaicJson());
    },
    clear() {
      char = null;
      wipe();
    },
  };
}
