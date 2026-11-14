// The marks saved on the player's machine (spec 008 FR-010a, FR-025, FR-037, FR-041; contracts/saved-files.md, T040): up
// to 3 named marks per character number, kept until Clear, across a character change and a restart; an unreadable file
// set aside as `.bad`, with one warning. Every value and name is invented.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { IPC } from "../shared/index.ts";
import {
  MARKS_FULL,
  MARKS_RESET,
  MARKS_UNSAVED,
  MARK_TAKEN,
  marksHandlers,
  savedFiles,
} from "./saved-files.ts";

const VALUES = { '[0,"Sword"]': 4, '[0,"Owned"]': true };

function folder(marksJson?: string): string {
  const dir = mkdtempSync(join(tmpdir(), "marks-"));
  if (marksJson !== undefined)
    writeFileSync(join(dir, "marks.json"), marksJson);
  return dir;
}
const onDisk = (dir: string): unknown =>
  JSON.parse(readFileSync(join(dir, "marks.json"), "utf8"));

test("a missing file is no mark, with no warning", () => {
  const { marks } = savedFiles(folder());
  expect(marks.list(0)).toEqual([]);
  expect(marks.warning()).toBe(null);
});

test("a mark is saved with its name, time and values, under the character's number", () => {
  const dir = folder();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(5_000);
  expect(savedFiles(dir).marks.save(2, "Before the swap", VALUES)).toBe(null);
  vi.useRealTimers();
  expect(onDisk(dir)).toEqual({
    version: 1,
    characters: {
      "2": [{ name: "Before the swap", takenAt: 5_000, values: VALUES }],
    },
  });
});

test("a name up to 40 characters is kept whole", () => {
  const { marks } = savedFiles(folder());
  const name = "x".repeat(40);
  marks.save(0, name, VALUES);
  expect(marks.list(0).map((m) => m.name)).toEqual([name]);
});

test("a fourth mark of the same character is refused; another character still has room (FR-037)", () => {
  const { marks } = savedFiles(folder());
  for (const name of ["Mark 1", "Mark 2", "Mark 3"])
    expect(marks.save(0, name, VALUES)).toBe(null);
  expect(marks.save(0, "Mark 4", VALUES)).toBe(MARKS_FULL);
  expect(MARKS_FULL).toBe("Up to 3 marks: clear one first.");
  expect(marks.list(0)).toHaveLength(3);
  expect(marks.save(1, "Mark 1", VALUES)).toBe(null);
});

test("a name already taken is refused: a mark goes only with Clear (FR-025)", () => {
  const dir = folder();
  const { marks } = savedFiles(dir);
  marks.save(0, "Mark 1", VALUES);
  expect(marks.save(0, "Mark 1", { '[0,"Sword"]': 9 })).toBe(MARK_TAKEN);
  expect(MARK_TAKEN).toBe("A mark with this name already exists.");
  expect(
    savedFiles(dir)
      .marks.list(0)
      .map((m) => m.values),
  ).toEqual([VALUES]);
  // Another character may use the same name.
  expect(marks.save(1, "Mark 1", VALUES)).toBe(null);
});

test("a write that fails leaves the file before whole and readable", () => {
  const dir = folder();
  savedFiles(dir).marks.save(0, "Mark 1", VALUES);
  // A folder where the temporary file goes: that write fails.
  mkdirSync(join(dir, "marks.json.tmp"));
  const { marks } = savedFiles(dir);
  expect(marks.save(0, "Mark 2", VALUES)).toBe(MARKS_UNSAVED);
  const again = savedFiles(dir).marks;
  expect(again.list(0).map((m) => m.name)).toEqual(["Mark 1"]);
  expect(again.warning()).toBe(null);
});

test("Clear removes only that mark, on disk too", () => {
  const dir = folder();
  const { marks } = savedFiles(dir);
  marks.save(0, "Mark 1", VALUES);
  marks.save(0, "Mark 2", VALUES);
  expect(marks.clear(0, "Mark 1")).toBe(null);
  expect(
    savedFiles(dir)
      .marks.list(0)
      .map((m) => m.name),
  ).toEqual(["Mark 2"]);
});

test("the marks survive a character change and an app restart", () => {
  const dir = folder();
  savedFiles(dir).marks.save(0, "Mark 1", VALUES);
  const again = savedFiles(dir).marks;
  expect(again.list(1)).toEqual([]);
  expect(again.list(0).map((m) => m.values)).toEqual([VALUES]);
});

test.each([
  ["invalid JSON", "{"],
  ["a half-written file", '{"version":1,"characters":{"0":[{"name":"Ma'],
  ["another version", '{"version":2,"characters":{}}'],
  ["no characters", '{"version":1}'],
  ["a character that is a name", '{"version":1,"characters":{"Invented":[]}}'],
  [
    "a mark without values",
    '{"version":1,"characters":{"0":[{"name":"M","takenAt":1}]}}',
  ],
  [
    "a value that is text",
    '{"version":1,"characters":{"0":[{"name":"M","takenAt":1,"values":{"k":"x"}}]}}',
  ],
])(
  "%s is renamed .bad, starts empty and warns once (FR-041)",
  (_name, content) => {
    const dir = folder(content);
    const { marks } = savedFiles(dir);
    expect(marks.list(0)).toEqual([]);
    expect(marks.warning()).toBe(MARKS_RESET);
    expect(MARKS_RESET).toBe("Saved marks could not be read and were reset");
    expect(marks.warning()).toBe(null);
    expect(readFileSync(join(dir, "marks.json.bad"), "utf8")).toBe(content);
    expect(existsSync(join(dir, "marks.json"))).toBe(false);
    marks.save(0, "Mark 1", VALUES);
    expect(savedFiles(dir).marks.list(0)).toHaveLength(1);
  },
);

test("over the limits, the excess is dropped on reading, with no warning", () => {
  const mark = (name: string) => ({ name, takenAt: 1, values: VALUES });
  const dir = folder(
    JSON.stringify({
      version: 1,
      characters: {
        "0": [mark("x".repeat(50)), mark("B"), mark("C"), mark("D")],
      },
    }),
  );
  const { marks } = savedFiles(dir);
  expect(marks.list(0).map((m) => m.name)).toEqual(["x".repeat(40), "B", "C"]);
  expect(marks.warning()).toBe(null);
});

test("a write that fails is a message, never a crash; the mark stays for this session", () => {
  const dir = folder();
  // A folder where the file should be: the write fails.
  mkdirSync(join(dir, "marks.json"));
  const { marks } = savedFiles(dir);
  expect(marks.save(0, "Mark 1", VALUES)).toBe(MARKS_UNSAVED);
  expect(marks.list(0)).toHaveLength(1);
});

/** The marks channels over a fake open tree of character 0, whose names are in `names`. */
function channels(
  open: { values: Record<string, number | boolean>; names: string[] } | null,
) {
  const dir = folder();
  const files = savedFiles(dir);
  const h = marksHandlers(files.marks, (n) => (n === 0 ? open : null));
  return { dir, files, h };
}
const call = (
  h: Record<string, (p: unknown) => unknown>,
  channel: string,
  payload: unknown,
) => Promise.resolve().then(() => h[channel]?.(payload));

test("marks:save takes the open tree's values; marks:list gives them back with the warning once", async () => {
  const { h } = channels({ values: VALUES, names: ["Invented"] });
  expect(await call(h, IPC.marksSave, { character: 0, name: " Mark 1 " })).toBe(
    null,
  );
  expect(await call(h, IPC.marksList, { character: 0 })).toMatchObject({
    marks: [{ name: "Mark 1", values: VALUES }],
    warning: null,
  });
  expect(await call(h, IPC.marksClear, { character: 0, name: "Mark 1" })).toBe(
    null,
  );
});

test("the saved file has the character's number and never a name (FR-010a)", async () => {
  const { dir, h } = channels({
    values: { ...VALUES, '[0,"PlayerDATABASE.Invented.Level"]': 3 },
    names: ["Invented", "Other"],
  });
  await call(h, IPC.marksSave, { character: 0, name: "Mark 1" });
  expect(readFileSync(join(dir, "marks.json"), "utf8")).not.toMatch(
    /Invented|Other/,
  );
  expect(
    await call(h, IPC.marksSave, {
      character: 0,
      name: "Before invented swap",
    }),
  ).toBe("A mark's name can't have a character's name.");
  // A name that only contains a character's name inside a word is fine.
  expect(
    await call(h, IPC.marksSave, { character: 0, name: "Otherwise" }),
  ).toBe(null);
});

test("marks:save with no tree open for that character is refused", async () => {
  const { h } = channels(null);
  await expect(
    call(h, IPC.marksSave, { character: 0, name: "Mark 1" }),
  ).rejects.toThrow("marks:save: no tree open for that character");
});

test.each<[string, string, unknown]>([
  ["list without a character", IPC.marksList, {}],
  ["list with a name", IPC.marksList, { character: 0, name: "M" }],
  ["a character that is text", IPC.marksSave, { character: "0", name: "M" }],
  ["a negative character", IPC.marksClear, { character: -1, name: "M" }],
  ["a character too big to write whole", IPC.marksList, { character: 1e21 }],
  ["an empty name", IPC.marksSave, { character: 0, name: "  " }],
  [
    "a name of 41 characters",
    IPC.marksSave,
    { character: 0, name: "x".repeat(41) },
  ],
  ["a name that is not text", IPC.marksClear, { character: 0, name: 1 }],
  ["an unknown key", IPC.marksSave, { character: 0, name: "M", values: {} }],
])("the marks channels refuse %s", async (_name, channel, payload) => {
  const { h } = channels({ values: VALUES, names: [] });
  await expect(call(h, channel, payload)).rejects.toThrow(
    `${channel}: invalid`,
  );
});
