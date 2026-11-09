// Deleting the names of the previous version (FR-012), always in a temporary folder.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { forgetOldNames } from "./forget-names.ts";

const OLD_NAMES = ["names.json", "names.json.bak", "names.json.bad"];

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "forget-names-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(names: string[]): void {
  for (const name of names) writeFileSync(join(dir, name), "{}");
}

test("the three files are deleted", () => {
  write(OLD_NAMES);
  forgetOldNames(dir);
  expect(readdirSync(dir)).toEqual([]);
});

test("every other file stays", () => {
  const others = [
    "game-hash.json",
    "names.json.old",
    "settings.json",
    "steam-setup.json",
  ];
  write([...OLD_NAMES, ...others]);
  forgetOldNames(dir);
  expect(readdirSync(dir).sort()).toEqual(others);
});

test("no file in the folder: nothing happens", () => {
  expect(() => {
    forgetOldNames(dir);
  }).not.toThrow();
  expect(readdirSync(dir)).toEqual([]);
});

test("no folder: nothing happens and it is not created", () => {
  const missing = join(dir, "missing");
  expect(() => {
    forgetOldNames(missing);
  }).not.toThrow();
  expect(existsSync(missing)).toBe(false);
});

test.each(OLD_NAMES)(
  "a %s that cannot be deleted neither throws nor stops the others",
  (stuck) => {
    const others = OLD_NAMES.filter((name) => name !== stuck);
    write(others);
    // A directory with that name: rmSync without `recursive` refuses it, and what is inside stays.
    mkdirSync(join(dir, stuck));
    writeFileSync(join(dir, stuck, "inside.json"), "kept");

    expect(() => {
      forgetOldNames(dir);
    }).not.toThrow();

    expect(readdirSync(dir)).toEqual([stuck]);
    expect(readFileSync(join(dir, stuck, "inside.json"), "utf8")).toBe("kept");
  },
);

// ponytail: reads the source because index.ts imports electron and no test may load it.
test("every start of the app forgets the old names, in the app's own data folder", () => {
  const source = readFileSync(join(import.meta.dirname, "index.ts"), "utf8");
  expect(source).toMatch(
    /function start\(\): void \{\s+const dataDir = join\(app\.getPath\("appData"\), "IdleOn Companion"\);\s+forgetOldNames\(dataDir\);/,
  );
});
