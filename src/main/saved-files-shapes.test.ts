// The tree shapes saved on the player's machine (spec 008 FR-027, FR-029, FR-041; contracts/saved-files.md): the parts
// of each catalog tree for one game version, never a value; an unreadable file set aside as `.bad`, with one warning.
// Every key, name and hash is invented.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { savedFiles, SHAPES_RESET } from "./saved-files.ts";
import type { TreeShapes } from "./saved-files.ts";

const SHA = "a".repeat(64);
const SHAPES: TreeShapes = {
  gameSha: SHA,
  trees: new Map([
    [
      "hp",
      [
        ['["Sword"]', "Game value"],
        ['["Owned"]', "Game value"],
      ],
    ],
    ["str", [['["Sword"]', "Game value"]]],
  ]),
};

function folder(json?: string): string {
  const dir = mkdtempSync(join(tmpdir(), "shapes-"));
  if (json !== undefined) writeFileSync(join(dir, "tree-shapes.json"), json);
  return dir;
}
const onDisk = (dir: string): unknown =>
  JSON.parse(readFileSync(join(dir, "tree-shapes.json"), "utf8"));

test("a missing file is no shape, with no warning", () => {
  const { shapes } = savedFiles(folder());
  expect(shapes.get()).toEqual({ gameSha: null, trees: new Map() });
  expect(shapes.warning()).toBe(null);
});

test("the shapes are saved by game version, parts and names only, and read back after a restart", () => {
  const dir = folder();
  expect(savedFiles(dir).shapes.save(SHAPES)).toBe(null);
  expect(onDisk(dir)).toEqual({
    version: 1,
    gameSha: SHA,
    trees: {
      hp: [
        ['["Sword"]', "Game value"],
        ['["Owned"]', "Game value"],
      ],
      str: [['["Sword"]', "Game value"]],
    },
  });
  expect(savedFiles(dir).shapes.get()).toEqual(SHAPES);
});

test("a number no longer in the catalog is dropped on reading, with no warning", () => {
  const dir = folder(
    JSON.stringify({
      version: 1,
      gameSha: SHA,
      trees: { hp: [['["Sword"]', "Game value"]], gone: [] },
    }),
  );
  const { shapes } = savedFiles(dir);
  expect([...shapes.get().trees.keys()]).toEqual(["hp"]);
  expect(shapes.warning()).toBe(null);
});

test.each([
  ["invalid JSON", "{"],
  ["another version", JSON.stringify({ version: 2, gameSha: SHA, trees: {} })],
  ["no game version", JSON.stringify({ version: 1, trees: {} })],
  [
    "a game version that is no hash",
    JSON.stringify({ version: 1, gameSha: "x", trees: {} }),
  ],
  ["no trees", JSON.stringify({ version: 1, gameSha: SHA })],
  [
    "a part that is no pair",
    JSON.stringify({ version: 1, gameSha: SHA, trees: { hp: [["k"]] } }),
  ],
  [
    "a part with a value",
    JSON.stringify({ version: 1, gameSha: SHA, trees: { hp: [["k", 3]] } }),
  ],
])(
  "a shapes file with %s is renamed .bad, starts empty and warns once (FR-041)",
  (_name, content) => {
    const dir = folder(content);
    const { shapes } = savedFiles(dir);
    expect(shapes.get()).toEqual({ gameSha: null, trees: new Map() });
    expect(shapes.warning()).toBe(SHAPES_RESET);
    expect(SHAPES_RESET).toBe(
      "Saved tree shapes could not be read and were reset",
    );
    expect(shapes.warning()).toBe(null);
    expect(readFileSync(join(dir, "tree-shapes.json.bad"), "utf8")).toBe(
      content,
    );
  },
);
