// The files the app saves on the player's machine (spec 008 FR-010a, FR-025, FR-036, FR-037, FR-041;
// contracts/saved-files.md): read, checked, written whole, as settings.ts does. A file that cannot be read is set aside
// as `.bad`, the item starts empty and the window is told once; nothing here ever throws to the app. A character is its
// number, never its name. No electron import, so tests can load it.
import { readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import {
  isCatalogId,
  isObject,
  MARKS_FULL,
  MAX_MARK_NAME,
  MAX_MARKS,
  MAX_PINS,
  PINS_FULL,
} from "../shared/index.ts";
import type { Mark, Pin, RadarChange } from "../shared/index.ts";
import { pinsPayload } from "./payloads.ts";
import { replaceFile } from "./replace-file.ts";

export const MARKS_RESET = "Saved marks could not be read and were reset";
export const MARKS_UNSAVED = "The marks could not be saved on this computer.";
export const MARK_TAKEN = "A mark with this name already exists.";
export const PINS_RESET = "Saved pins could not be read and were reset";
export const PINS_UNSAVED = "The pins could not be saved on this computer.";
export const SHAPES_RESET =
  "Saved tree shapes could not be read and were reset";
const SHAPES_UNSAVED = "The tree shapes could not be saved on this computer.";

type Trees = Map<string, [key: string, name: string][]>;

/**
 * A game update still open (FR-029, FR-035): the old version's trees not compared yet, the changes found, and how many
 * of them the player had seen when they closed the band.
 */
export interface ShapesPatch {
  previous: { gameSha: string; trees: Trees };
  changed: RadarChange[];
  dismissed: number;
}

/** The parts of each catalog tree, [pieceKey, name], for one game version (its N.js's sha256); never a value. */
export interface TreeShapes {
  gameSha: string | null;
  trees: Trees;
  /** Only while a game update is open. */
  patch?: ShapesPatch;
}

export type Values = Mark["values"];

const isValue = (v: unknown) =>
  typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v));

/** One mark read from the file, its name cut to 40 characters; null when its shape is wrong. */
function markOf(v: unknown): Mark | null {
  if (!isObject(v)) return null;
  const { name, takenAt, values } = v;
  if (
    typeof name !== "string" ||
    name.length === 0 ||
    typeof takenAt !== "number" ||
    !isObject(values) ||
    !Object.values(values).every(isValue)
  )
    return null;
  return {
    name: name.slice(0, MAX_MARK_NAME),
    takenAt,
    values: values as Values,
  };
}

/** The marks by character, or null when the file's shape is wrong. Over the limits, the excess is dropped. */
function marksOf(v: unknown): Map<string, Mark[]> | null {
  if (!isObject(v) || v.version !== 1 || !isObject(v.characters)) return null;
  const out = new Map<string, Mark[]>();
  for (const [n, list] of Object.entries(v.characters)) {
    if (!/^\d+$/.test(n) || !Array.isArray(list)) return null;
    const marks = list.map(markOf);
    if (!marks.every((m) => m !== null)) return null;
    out.set(n, marks.slice(0, MAX_MARKS));
  }
  return out;
}

/** The pins of `pins.json`, or null when its shape is wrong. Over 5, the excess is dropped. */
function pinsOf(v: unknown): Pin[] | null {
  if (!isObject(v) || v.version !== 1 || !Array.isArray(v.pins)) return null;
  return pinsPayload(v.pins.slice(0, MAX_PINS));
}

const isPart = (p: unknown): p is [string, string] =>
  Array.isArray(p) &&
  p.length === 2 &&
  typeof p[0] === "string" &&
  typeof p[1] === "string";

const isSha = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
const isNames = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((n) => typeof n === "string");

/** The trees of a shapes object, or null when wrong. A number no longer in the catalog is dropped. */
function treesOf(v: unknown): Trees | null {
  if (!isObject(v)) return null;
  const trees: Trees = new Map();
  for (const [id, parts] of Object.entries(v)) {
    if (!Array.isArray(parts) || !parts.every(isPart)) return null;
    if (isCatalogId(id)) trees.set(id, parts);
  }
  return trees;
}

/** Whether the value is one change of the radar. */
const isChange = (v: unknown): v is RadarChange =>
  isObject(v) &&
  typeof v.catalogId === "string" &&
  isNames(v.added) &&
  isNames(v.removed) &&
  Array.isArray(v.renamed) &&
  v.renamed.every(isPart);

/** The open game update of the file, undefined when it has none, null when it is wrong. */
function patchOf(v: Record<string, unknown>): ShapesPatch | undefined | null {
  const { previous, changed, dismissed } = v;
  if (
    previous === undefined &&
    changed === undefined &&
    dismissed === undefined
  )
    return undefined;
  if (
    !isObject(previous) ||
    !isSha(previous.gameSha) ||
    !Array.isArray(changed) ||
    !changed.every(isChange) ||
    typeof dismissed !== "number" ||
    !Number.isInteger(dismissed) ||
    dismissed < 0
  )
    return null;
  const trees = treesOf(previous.trees);
  if (!trees) return null;
  return {
    previous: { gameSha: previous.gameSha, trees },
    changed: changed.filter((c) => isCatalogId(c.catalogId)),
    dismissed,
  };
}

/** The shapes of `tree-shapes.json`, or null when its shape is wrong. */
function shapesOf(v: unknown): TreeShapes | null {
  if (!isObject(v) || v.version !== 1 || !isSha(v.gameSha)) return null;
  const trees = treesOf(v.trees);
  const patch = patchOf(v);
  if (!trees || patch === null) return null;
  return patch
    ? { gameSha: v.gameSha, trees, patch }
    : { gameSha: v.gameSha, trees };
}

/**
 * One JSON file of the app's data folder: read and checked once, set aside as `.bad` with a warning when its shape is
 * wrong, and written whole.
 */
function jsonFile<T>(
  file: string,
  shape: (v: unknown) => T | null,
  empty: () => T,
  toFile: (data: T) => unknown,
  sentences: { reset: string; unsaved: string },
): {
  load: () => T;
  /** Null when written; else the sentence of a failed write. The data stays in memory either way. */
  save: (data: T) => string | null;
  /** The warning of a file that could not be read, given once (FR-041). */
  warning: () => string | null;
} {
  let data: T | null = null;
  let warning: string | null = null;
  /** The file is there but could not be read (busy, locked): it is never written over in this session. */
  let kept = false;

  function load(): T {
    if (data !== null) return data;
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch (e) {
      data = empty();
      // Only a missing file is nothing saved; any other error keeps the file as it is, with the warning.
      if (!isObject(e) || e.code !== "ENOENT") {
        kept = true;
        warning = sentences.reset;
      }
      return data;
    }
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Read below as a wrong shape.
    }
    data = shape(parsed);
    if (data === null) {
      data = empty();
      warning = sentences.reset;
      try {
        renameSync(file, `${file}.bad`);
      } catch {
        // Set aside or not, the file is not read again in this session.
      }
    }
    return data;
  }

  return {
    load,
    save(next) {
      load();
      data = next;
      if (kept) return sentences.unsaved;
      // Written whole, as settings.json (replace-file.ts): to `.tmp` and renamed over the file, so a failed write of
      // `.tmp` never leaves half a file; only the direct write, when Windows keeps refusing the rename, is not atomic.
      try {
        return replaceFile(file, JSON.stringify(toFile(next)))
          ? null
          : sentences.unsaved;
      } catch {
        return sentences.unsaved;
      }
    },
    warning() {
      load();
      const w = warning;
      warning = null;
      return w;
    },
  };
}

export function savedFiles(dir: string): {
  marks: {
    list(n: number): Mark[];
    /** Null when saved; else the sentence for the player. */
    save(n: number, name: string, values: Values): string | null;
    clear(n: number, name: string): string | null;
    /** The warning of a file that could not be read, given once (FR-041). */
    warning(): string | null;
  };
  pins: {
    get(): Pin[];
    /** Null when saved; else the sentence for the player. */
    set(pins: Pin[]): string | null;
    /** The warning of a file that could not be read, given once (FR-041). */
    warning(): string | null;
  };
  /** The tree shapes of the last game version seen (FR-027, FR-029). */
  shapes: {
    get(): TreeShapes;
    /** Null when saved; else the sentence of a failed write. */
    save(shapes: TreeShapes): string | null;
    /** The warning of a file that could not be read, given once (FR-041). */
    warning(): string | null;
  };
} {
  const marks = jsonFile(
    join(dir, "marks.json"),
    marksOf,
    () => new Map<string, Mark[]>(),
    (all) => ({ version: 1, characters: Object.fromEntries(all) }),
    { reset: MARKS_RESET, unsaved: MARKS_UNSAVED },
  );
  const pins = jsonFile(
    join(dir, "pins.json"),
    pinsOf,
    (): Pin[] => [],
    (list) => ({ version: 1, pins: list }),
    { reset: PINS_RESET, unsaved: PINS_UNSAVED },
  );
  const shapes = jsonFile(
    join(dir, "tree-shapes.json"),
    shapesOf,
    (): TreeShapes => ({ gameSha: null, trees: new Map() }),
    ({ gameSha, trees, patch }) => ({
      version: 1,
      gameSha,
      trees: Object.fromEntries(trees),
      ...(patch && {
        previous: {
          gameSha: patch.previous.gameSha,
          trees: Object.fromEntries(patch.previous.trees),
        },
        changed: patch.changed,
        dismissed: patch.dismissed,
      }),
    }),
    { reset: SHAPES_RESET, unsaved: SHAPES_UNSAVED },
  );

  /** The marks whose write failed, by character and name: saved again, they are written again; any other name taken
   * stays taken. */
  const unsaved = new Set<string>();
  const keyOf = (n: number, name: string) => `${String(n)}\n${name}`;
  /** Writes the marks: a refused write keeps `key` to write again; one that works leaves all on disk. */
  const write = (all: Map<string, Mark[]>, key: string | null) => {
    const refused = marks.save(all);
    if (refused === null) unsaved.clear();
    else if (key !== null) unsaved.add(key);
    return refused;
  };

  return {
    marks: {
      list: (n) => marks.load().get(String(n)) ?? [],
      save(n, name, values) {
        const all = marks.load();
        const list = all.get(String(n)) ?? [];
        const key = keyOf(n, name);
        // A mark goes only with Clear (FR-025); saved again after its write failed, it is written again.
        if (list.some((m) => m.name === name))
          return unsaved.has(key) ? write(all, key) : MARK_TAKEN;
        if (list.length >= MAX_MARKS) return MARKS_FULL;
        all.set(String(n), [...list, { name, takenAt: Date.now(), values }]);
        return write(all, key);
      },
      clear(n, name) {
        const all = marks.load();
        const left = (all.get(String(n)) ?? []).filter((m) => m.name !== name);
        if (left.length > 0) all.set(String(n), left);
        else all.delete(String(n));
        return write(all, null);
      },
      warning: marks.warning,
    },
    pins: {
      get: pins.load,
      // Only which numbers, never a value (FR-036).
      set: (list) => (list.length > MAX_PINS ? PINS_FULL : pins.save(list)),
      warning: pins.warning,
    },
    shapes: { get: shapes.load, save: shapes.save, warning: shapes.warning },
  };
}
