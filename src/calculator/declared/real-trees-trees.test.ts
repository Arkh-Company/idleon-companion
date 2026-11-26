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
import {
  getsTree,
  keepTree,
  moveToPrevious,
  writeTree,
} from "./real-trees-trees.ts";

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

test("a number the lock refuses gets no new tree; a draft gets one only when what it lacks is pending", () => {
  const passed: LockResult = { ok: true, ...emptyOut(), pendingAt: [] };
  const failed: LockResult = {
    ...passed,
    ok: false,
    errors: [{ kind: "notClosing", where: "pool:0", expected: 1, got: 2 }],
  };
  expect(getsTree(passed, true)).toBe(true);
  expect(getsTree(failed, true)).toBe(false);
  expect(getsTree(failed, false)).toBe(false);
});

test("a draft the lock refuses past its pending places gets no tree, and a refused number keeps none of the run before", () => {
  const pending: LockResult = {
    ok: false,
    ...emptyOut(),
    errors: [{ kind: "pending", where: "pools/0/groups/0", got: "name" }],
    pendingAt: [],
  };
  const failed: LockResult = {
    ...pending,
    errors: [
      ...pending.errors,
      { kind: "notClosing", where: "pool:0", expected: 1, got: 2 },
    ],
  };
  expect(getsTree(pending, false)).toBe(true);
  expect(getsTree(failed, false)).toBe(false);
  // the run before wrote a tree; this run's is refused: it goes to previous/, and trees/ has none
  writeTree(out, "stats-class-exp", tree(1));
  keepTree(out, "stats-class-exp", tree(2), failed, false);
  expect(existsSync(join(out, "trees", "stats-class-exp.json"))).toBe(false);
  expect(read("previous", "trees", "stats-class-exp.json")).toEqual(tree(1));
  keepTree(out, "stats-class-exp", tree(3), pending, false);
  expect(read("trees", "stats-class-exp.json")).toEqual(tree(3));
});
