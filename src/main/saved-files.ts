// The files the app saves on the player's machine (spec 008 FR-010a, FR-025, FR-036, FR-037, FR-041;
// contracts/saved-files.md): read, checked, written whole, as settings.ts does. A file that cannot be read is set aside
// as `.bad`, the item starts empty and the window is told once; nothing here ever throws to the app. A character is its
// number, never its name. No electron import, so tests can load it.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  IPC,
  isCatalogId,
  isObject,
  MAX_PINS,
  PINS_FULL,
} from "../shared/index.ts";
import type { Mark, Pin } from "../shared/index.ts";
import {
  emptyPayload,
  MAX_MARK_NAME,
  markPayload,
  marksListPayload,
  pinsPayload,
} from "./payloads.ts";

export const MAX_MARKS = 3;
export const MARKS_FULL = "Up to 3 marks: clear one first.";
export const MARKS_RESET = "Saved marks could not be read and were reset";
export const MARKS_UNSAVED = "The marks could not be saved on this computer.";
export const MARK_WITH_NAME = "A mark's name can't have a character's name.";
export const MARK_TAKEN = "A mark with this name already exists.";
export const PINS_RESET = "Saved pins could not be read and were reset";
export const PINS_UNSAVED = "The pins could not be saved on this computer.";
export const SHAPES_RESET =
  "Saved tree shapes could not be read and were reset";
const SHAPES_UNSAVED = "The tree shapes could not be saved on this computer.";

/** The parts of each catalog tree, [pieceKey, name], for one game version (its N.js's sha256); never a value. */
export interface TreeShapes {
  gameSha: string | null;
  trees: Map<string, [key: string, name: string][]>;
}

type Values = Mark["values"];

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
    values: Object.fromEntries(Object.entries(values)) as Values,
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

/** The shapes of `tree-shapes.json`, or null when its shape is wrong. A number no longer in the catalog is dropped. */
function shapesOf(v: unknown): TreeShapes | null {
  if (
    !isObject(v) ||
    v.version !== 1 ||
    typeof v.gameSha !== "string" ||
    !/^[0-9a-f]{64}$/.test(v.gameSha) ||
    !isObject(v.trees)
  )
    return null;
  const trees = new Map<string, [string, string][]>();
  for (const [id, parts] of Object.entries(v.trees)) {
    if (!Array.isArray(parts) || !parts.every(isPart)) return null;
    if (isCatalogId(id)) trees.set(id, parts);
  }
  return { gameSha: v.gameSha, trees };
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

  function load(): T {
    if (data !== null) return data;
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      // No file yet (or none readable): nothing saved.
      data = empty();
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
      data = next;
      // Written to `.tmp` and renamed over the file (as setup-store.ts), so a failed write never leaves half a file.
      try {
        mkdirSync(dirname(file), { recursive: true });
        const tmp = `${file}.tmp`;
        writeFileSync(tmp, JSON.stringify(toFile(next)));
        renameSync(tmp, file);
        return null;
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
    ({ gameSha, trees }) => ({
      version: 1,
      gameSha,
      trees: Object.fromEntries(trees),
    }),
    { reset: SHAPES_RESET, unsaved: SHAPES_UNSAVED },
  );

  return {
    marks: {
      list: (n) => marks.load().get(String(n)) ?? [],
      save(n, name, values) {
        const all = marks.load();
        const list = all.get(String(n)) ?? [];
        // A mark goes only with Clear (FR-025).
        if (list.some((m) => m.name === name)) return MARK_TAKEN;
        if (list.length >= MAX_MARKS) return MARKS_FULL;
        all.set(String(n), [...list, { name, takenAt: Date.now(), values }]);
        return marks.save(all);
      },
      clear(n, name) {
        const all = marks.load();
        const left = (all.get(String(n)) ?? []).filter((m) => m.name !== name);
        if (left.length > 0) all.set(String(n), left);
        else all.delete(String(n));
        return marks.save(all);
      },
      warning: marks.warning,
    },
    pins: {
      get: pins.load,
      // Only which numbers, never a value (FR-036).
      set: (list) =>
        list.length > MAX_PINS
          ? PINS_FULL
          : pins.save(list.map(({ treeId, nodeId }) => ({ treeId, nodeId }))),
      warning: pins.warning,
    },
    shapes: { get: shapes.load, save: shapes.save, warning: shapes.warning },
  };
}

/** The mosaic's active character and list of characters' names; null when it has neither. */
export function players(
  mosaicJson: string,
): { info: unknown[]; names: unknown[] } | null {
  try {
    const parsed: unknown = JSON.parse(mosaicJson);
    const attrs = isObject(parsed) ? parsed.attrs : null;
    if (!isObject(attrs)) return null;
    const { UserInfo: info, GetPlayersUsernames: names } = attrs;
    return Array.isArray(info) && Array.isArray(names) ? { info, names } : null;
  } catch {
    return null;
  }
}

/** The characters' names of the mosaic: what a saved file must never get (FR-010a). */
export const namesOf = (mosaicJson: string): string[] =>
  (players(mosaicJson)?.names ?? []).filter(
    (n): n is string => typeof n === "string",
  );

/** Whether `text` holds a character's name anywhere, any case: what a saved file must never get (FR-010a). */
export const holdsName = (text: string, names: readonly string[]) => {
  const lower = text.toLowerCase();
  return names.some((n) => n !== "" && lower.includes(n.toLowerCase()));
};

/** Whether `text` has a character's name as a whole word, any case. */
const hasName = (text: string, names: readonly string[]) => {
  const words = text.toLowerCase().split(/[^\p{L}\p{N}_]+/u);
  return names.some((n) => words.includes(n.toLowerCase()));
};

/**
 * The marks channels (contracts/ipc.md), each payload checked first. A mark takes the open tree's values (`open`); a
 * piece whose key holds a character's name is left out, and a mark's name with one is refused (FR-010a).
 */
export function marksHandlers(
  marks: ReturnType<typeof savedFiles>["marks"],
  open: (character: number) => { values: Values; names: string[] } | null,
): Record<string, (payload: unknown) => unknown> {
  return {
    [IPC.marksList]: (payload) => {
      const r = marksListPayload(payload);
      if (!r) throw new Error("marks:list: invalid request");
      return { marks: marks.list(r.character), warning: marks.warning() };
    },
    [IPC.marksSave]: (payload) => {
      const r = markPayload(payload);
      if (!r) throw new Error("marks:save: invalid mark");
      const tree = open(r.character);
      if (!tree) throw new Error("marks:save: no tree open for that character");
      if (hasName(r.name, tree.names)) return MARK_WITH_NAME;
      const values = Object.fromEntries(
        Object.entries(tree.values).filter(
          ([key]) => !holdsName(key, tree.names),
        ),
      );
      return marks.save(r.character, r.name, values);
    },
    [IPC.marksClear]: (payload) => {
      const r = markPayload(payload);
      if (!r) throw new Error("marks:clear: invalid mark");
      return marks.clear(r.character, r.name);
    },
  };
}

/** The pins channels (contracts/ipc.md), each payload checked first; `pinned` hears each list kept. */
export function pinsHandlers(
  pins: ReturnType<typeof savedFiles>["pins"],
  pinned: (list: Pin[]) => void,
): Record<string, (payload: unknown) => unknown> {
  return {
    [IPC.pinsGet]: (payload) => {
      if (!emptyPayload(payload)) throw new Error("pins:get: invalid request");
      return { pins: pins.get(), warning: pins.warning() };
    },
    [IPC.pinsSet]: (payload) => {
      const list = pinsPayload(payload);
      if (!list) throw new Error("pins:set: invalid pins");
      const refused = pins.set(list);
      pinned(pins.get());
      return refused;
    },
  };
}
