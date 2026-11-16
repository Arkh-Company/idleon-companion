// A saved file that is there but cannot be read (busy, locked, not a file) is never written over: only a missing file is
// "nothing saved" (review of the feature, CR2; FR-041). The item starts empty for the session and warns once. A mark
// whose write failed is tried again by saving it again. Every value and name is invented.
import { existsSync, mkdirSync, mkdtempSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  MARKS_RESET,
  MARK_TAKEN,
  MARKS_UNSAVED,
  PINS_RESET,
  PINS_UNSAVED,
  savedFiles,
  SHAPES_RESET,
} from "./saved-files.ts";

/** A folder where the file is a folder: reading it fails with an error that is not "no such file". */
function unreadable(file: string): string {
  const dir = mkdtempSync(join(tmpdir(), "unreadable-"));
  mkdirSync(join(dir, file));
  return dir;
}

test.each([
  [
    "marks.json",
    MARKS_RESET,
    MARKS_UNSAVED,
    (s: ReturnType<typeof savedFiles>) => s.marks.save(0, "Mark 1", { k: 1 }),
    (s: ReturnType<typeof savedFiles>) => s.marks.warning(),
  ],
  [
    "pins.json",
    PINS_RESET,
    PINS_UNSAVED,
    (s: ReturnType<typeof savedFiles>) =>
      s.pins.set([{ treeId: "hp", nodeId: null }]),
    (s: ReturnType<typeof savedFiles>) => s.pins.warning(),
  ],
  [
    "tree-shapes.json",
    SHAPES_RESET,
    "The tree shapes could not be saved on this computer.",
    (s: ReturnType<typeof savedFiles>) =>
      s.shapes.save({ gameSha: null, trees: new Map() }),
    (s: ReturnType<typeof savedFiles>) => s.shapes.warning(),
  ],
])(
  "%s that cannot be read warns once and is never written over",
  (file, reset, unsaved, save, warning) => {
    const dir = unreadable(file);
    const s = savedFiles(dir);
    expect(warning(s)).toBe(reset);
    expect(warning(s)).toBe(null);
    expect(save(s)).toBe(unsaved);
    expect(existsSync(join(dir, `${file}.tmp`))).toBe(false);
    expect(existsSync(join(dir, `${file}.bad`))).toBe(false);
  },
);

test("saving again a mark whose write failed tries the write again, never 'already exists'", () => {
  const dir = mkdtempSync(join(tmpdir(), "retry-"));
  // A folder where the temporary file goes: the write fails, the file is still missing.
  mkdirSync(join(dir, "marks.json.tmp"));
  const { marks } = savedFiles(dir);
  expect(marks.save(0, "Mark 1", { k: 1 })).toBe(MARKS_UNSAVED);
  rmdirSync(join(dir, "marks.json.tmp"));
  expect(marks.save(0, "Mark 1", { k: 1 })).toBe(null);
  expect(
    savedFiles(dir)
      .marks.list(0)
      .map((m) => m.name),
  ).toEqual(["Mark 1"]);
});

test("after a Clear whose write failed, saving a mark that exists is still 'already exists'", () => {
  const dir = mkdtempSync(join(tmpdir(), "clear-"));
  const { marks } = savedFiles(dir);
  expect(marks.save(0, "Mark 1", { k: 1 })).toBe(null);
  expect(marks.save(0, "Mark 2", { k: 2 })).toBe(null);
  mkdirSync(join(dir, "marks.json.tmp"));
  expect(marks.clear(0, "Mark 2")).toBe(MARKS_UNSAVED);
  rmdirSync(join(dir, "marks.json.tmp"));
  expect(marks.save(0, "Mark 1", { k: 1 })).toBe(MARK_TAKEN);
});

test("two mark writes failing in a row: saving the first again writes both", () => {
  const dir = mkdtempSync(join(tmpdir(), "twice-"));
  mkdirSync(join(dir, "marks.json.tmp"));
  const { marks } = savedFiles(dir);
  expect(marks.save(0, "Mark 1", { k: 1 })).toBe(MARKS_UNSAVED);
  expect(marks.save(0, "Mark 2", { k: 2 })).toBe(MARKS_UNSAVED);
  rmdirSync(join(dir, "marks.json.tmp"));
  expect(marks.save(0, "Mark 1", { k: 1 })).toBe(null);
  expect(
    savedFiles(dir)
      .marks.list(0)
      .map((m) => m.name),
  ).toEqual(["Mark 1", "Mark 2"]);
});
