// The files the app saves on the player's machine (spec 008 FR-010a, FR-025, FR-037, FR-041; contracts/saved-files.md):
// read, checked, written whole, as settings.ts does. A file that cannot be read is set aside as `.bad`, the item starts
// empty and the window is told once; nothing here ever throws to the app. A character is its number, never its name.
// No electron import, so tests can load it.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { IPC, isObject } from "../shared/index.ts";
import type { Mark } from "../shared/index.ts";
import { MAX_MARK_NAME, markPayload, marksListPayload } from "./payloads.ts";

export const MAX_MARKS = 3;
export const MARKS_FULL = "Up to 3 marks: clear one first.";
export const MARKS_RESET = "Saved marks could not be read and were reset";
export const MARKS_UNSAVED = "The marks could not be saved on this computer.";
export const MARK_WITH_NAME = "A mark's name can't have a character's name.";

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

export function savedFiles(dir: string): {
  marks: {
    list(n: number): Mark[];
    /** Null when saved; else the sentence for the player. */
    save(n: number, name: string, values: Values): string | null;
    clear(n: number, name: string): string | null;
    /** The warning of a file that could not be read, given once (FR-041). */
    warning(): string | null;
  };
} {
  const file = join(dir, "marks.json");
  let data: Map<string, Mark[]> | null = null;
  let warning: string | null = null;

  function load(): Map<string, Mark[]> {
    if (data) return data;
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      // No file yet (or none readable): no mark.
      data = new Map();
      return data;
    }
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Read below as a wrong shape.
    }
    data = marksOf(parsed);
    if (!data) {
      data = new Map();
      warning = MARKS_RESET;
      try {
        renameSync(file, `${file}.bad`);
      } catch {
        // Set aside or not, the file is not read again in this session.
      }
    }
    return data;
  }

  /** The whole file, or the sentence of a failed write; the marks stay in memory either way. */
  function write(): string | null {
    try {
      mkdirSync(dir, { recursive: true });
      const characters = Object.fromEntries(load());
      writeFileSync(file, JSON.stringify({ version: 1, characters }));
      return null;
    } catch {
      return MARKS_UNSAVED;
    }
  }

  return {
    marks: {
      list: (n) => load().get(String(n)) ?? [],
      save(n, name, values) {
        const others = (load().get(String(n)) ?? []).filter(
          (m) => m.name !== name,
        );
        if (others.length >= MAX_MARKS) return MARKS_FULL;
        load().set(String(n), [
          ...others,
          { name, takenAt: Date.now(), values },
        ]);
        return write();
      },
      clear(n, name) {
        const left = (load().get(String(n)) ?? []).filter(
          (m) => m.name !== name,
        );
        if (left.length > 0) load().set(String(n), left);
        else load().delete(String(n));
        return write();
      },
      warning() {
        load();
        const w = warning;
        warning = null;
        return w;
      },
    },
  };
}

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
      const lower = tree.names.map((n) => n.toLowerCase());
      const values = Object.fromEntries(
        Object.entries(tree.values).filter(
          ([key]) => !lower.some((n) => key.toLowerCase().includes(n)),
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
