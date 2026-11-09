// The mosaic: the newest value of each piece of the state, only in memory and never logged (FR-007, FR-022).
import {
  classOf,
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

/**
 * Only what the reader sends. A path comes from the link: `__proto__` is dropped so it can never reach a prototype, and
 * a key is either split or whole, so `attrs[top]` is always what the code below expects.
 */
function belongs(path: StatePath): boolean {
  const [top, child] = path;
  if (path.includes("__proto__")) return false;
  return child === undefined
    ? !STATE_EXCLUDED.includes(top) && !STATE_SPLIT.includes(top)
    : STATE_SPLIT.includes(top);
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
  let calculated = false;
  let formula = 0;
  /** Where this mosaic started: `cycles` counts the keeper's rotations, not the ones it received whole. */
  let start: { all: number; fresh: boolean } | null = null;

  function wipe(): void {
    pieces.clear();
    changed = false;
    calculated = false;
    formula = 0;
    start = null;
  }

  function mosaicJson(): string {
    const attrs: Record<string, unknown> = {};
    let vars: unknown = {};
    for (const { path, value } of pieces.values()) {
      const [top, child] = path;
      if (top === "_vars") vars = value;
      else if (child === undefined) attrs[top] = value;
      else {
        // Both split maps are `haxe.ds.StringMap`, the calculator's default: no `$c`.
        const split = (attrs[top] ??= { $m: {} }) as {
          $m: Record<string, unknown>;
        };
        split.$m[child] = value;
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
        fresh: s.cycles.all === 0 && s.cycles.formula === 0,
      };
      for (const { path, value } of s.pieces) {
        if (!belongs(path)) continue;
        const kept = path[0] === "_vars" ? closedList(value) : value;
        const key = JSON.stringify(path);
        const text = JSON.stringify(kept);
        if (pieces.get(key)?.text !== text && classOf(path, char) === "formula")
          changed = true;
        pieces.set(key, { path, value: kept, text });
      }
      // A map change zeroes `formula` in the keeper, so a rise always means a whole rotation on the new map.
      const rose = s.cycles.formula > formula;
      formula = s.cycles.formula;
      // Joined midway, the next rise of `all` only closes the rotation already begun: it takes one more.
      const due = calculated
        ? rose && changed
        : s.cycles.formula >= 1 &&
          s.cycles.all >= start.all + (start.fresh ? 1 : 2);
      if (!due) return;
      calculated = true;
      changed = false;
      cb.onDue(mosaicJson());
    },
    clear() {
      char = null;
      wipe();
    },
  };
}
