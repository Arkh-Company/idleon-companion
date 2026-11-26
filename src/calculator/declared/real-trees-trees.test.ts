// The trees the check mode writes (spec 010, T040, FR-023, contracts/real-trees-run.md): `trees/<id>.json`, the whole
// tree open to the leaves, the run before's moved to `previous/trees/` first; a number the lock refuses gets no new
// tree. (A file of its own: real-trees-run.test.ts is near the 400 lines.)
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import type { CalcTreeNode } from "../tree-contract.ts";
import { emptyOut } from "./lock-levels.ts";
import type { LockResult } from "./lock.ts";
import { getsTree, moveToPrevious, writeTree } from "./real-trees-run.ts";

const out = mkdtempSync(join(tmpdir(), "trees-out-"));
afterAll(() => {
  rmSync(out, { recursive: true, force: true });
});

const tree = (value: number): CalcTreeNode => ({
  id: "stats-drop-rate",
  pieceKey: null,
  name: "Drop Rate",
  value,
  fmt: null,
  leaf: null,
  condition: null,
  why: null,
  formula: null,
  code: null,
  role: "root",
  share: null,
  shareMode: null,
  flags: {},
  kids: [],
});
const read = (...parts: string[]): unknown =>
  JSON.parse(readFileSync(join(out, ...parts), "utf8"));

test("the run before's tree goes to previous/ before the new one is written", () => {
  // the first run: no tree before, nothing to move
  moveToPrevious(out, "stats-drop-rate");
  expect(existsSync(join(out, "previous"))).toBe(false);
  writeTree(out, "stats-drop-rate", tree(1));
  expect(read("trees", "stats-drop-rate.json")).toEqual(tree(1));
  // the next run
  moveToPrevious(out, "stats-drop-rate");
  expect(existsSync(join(out, "trees", "stats-drop-rate.json"))).toBe(false);
  writeTree(out, "stats-drop-rate", tree(2));
  expect(read("previous", "trees", "stats-drop-rate.json")).toEqual(tree(1));
  expect(read("trees", "stats-drop-rate.json")).toEqual(tree(2));
});

test("a tree's file is named by the catalog's id only", () => {
  expect(() => {
    writeTree(out, "../stats-drop-rate", tree(1));
  }).toThrow();
  expect(() => {
    moveToPrevious(out, "../stats-drop-rate");
  }).toThrow();
  expect(existsSync(join(out, "stats-drop-rate.json"))).toBe(false);
});

test("a number the lock refuses gets no new tree; a draft gets one, its pending places marked", () => {
  const passed: LockResult = { ok: true, ...emptyOut(), pendingAt: [] };
  const failed: LockResult = {
    ...passed,
    ok: false,
    errors: [{ kind: "notClosing", where: "pool:0", expected: 1, got: 2 }],
  };
  expect(getsTree(passed, true)).toBe(true);
  expect(getsTree(failed, true)).toBe(false);
  expect(getsTree(failed, false)).toBe(true);
});
