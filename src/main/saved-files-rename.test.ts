// The saved files on Windows, as settings.json (settings-rename.test.ts): another process holding the file makes the
// rename of `.tmp` over it fail (EPERM, EBUSY). The rename fails here on purpose. Every value and name is invented.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { PINS_UNSAVED, savedFiles } from "./saved-files.ts";

const fails = vi.hoisted(() => ({ left: 0, write: "" }));
const eperm = () =>
  Object.assign(new Error("EPERM: operation not permitted"), {
    code: "EPERM",
  });
vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  return {
    ...fs,
    renameSync: (from: string, to: string) => {
      if (fails.left > 0) {
        fails.left--;
        throw eperm();
      }
      fs.renameSync(from, to);
    },
    // only the path in `fails.write` is refused: the .tmp beside it is written
    writeFileSync: (path: string, data: string) => {
      if (path === fails.write) throw eperm();
      fs.writeFileSync(path, data);
    },
  };
});
afterEach(() => {
  fails.left = 0;
  fails.write = "";
});

const HP = { treeId: "hp", nodeId: null };
const STR = { treeId: "str", nodeId: null };
const BEFORE = JSON.stringify({ version: 1, pins: [HP] });

function pinsFile(): string {
  const file = join(mkdtempSync(join(tmpdir(), "pins-")), "pins.json");
  writeFileSync(file, BEFORE);
  return file;
}
const onDisk = (file: string): unknown =>
  JSON.parse(readFileSync(file, "utf8"));

test("a rename that fails once is tried again", () => {
  const file = pinsFile();
  const { pins } = savedFiles(dirname(file));
  fails.left = 1;
  expect(pins.set([HP, STR])).toBe(null);
  expect(onDisk(file)).toEqual({ version: 1, pins: [HP, STR] });
  expect(existsSync(`${file}.tmp`)).toBe(false);
});

test("a rename that keeps failing writes the file directly and removes .tmp", () => {
  const file = pinsFile();
  const { pins } = savedFiles(dirname(file));
  fails.left = 100;
  expect(pins.set([STR])).toBe(null);
  expect(onDisk(file)).toEqual({ version: 1, pins: [STR] });
  expect(existsSync(`${file}.tmp`)).toBe(false);
});

test("a direct write refused too is the sentence of a failed save, and the file stays as it was", () => {
  const file = pinsFile();
  const { pins } = savedFiles(dirname(file));
  fails.left = 100;
  fails.write = file;
  expect(pins.set([STR])).toBe(PINS_UNSAVED);
  expect(readFileSync(file, "utf8")).toBe(BEFORE);
  expect(pins.get()).toEqual([STR]);
});
