// The check mode's tree (spec 010, T040, FR-023): the tree's character's run assembled whole, locked once, its time the
// summary's `assemble` stage. (Apart from real-trees-check.test.ts, which would pass the 400 lines.)
import { beforeAll, expect, test, vi } from "vitest";
import type { bootRecorder } from "../tree-record.ts";
import { inventedBlueprint } from "./lock-fixture.ts";
import { lockBlueprint } from "./lock.ts";
import { lockNumber } from "./real-trees-check.ts";
import {
  BOTH,
  checkRecorder,
  recordRoots,
  twoClasses,
} from "./real-trees-check-fixture.ts";

// the lock as it is, its calls counted
vi.mock("./lock.ts", async (actual) => {
  const lock = await actual<typeof import("./lock.ts")>();
  return { ...lock, lockBlueprint: vi.fn(lock.lockBlueprint) };
});

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = checkRecorder();
});

test("the tree's character's run is assembled whole, and the summary's stages carry the assembly's time (T040)", () => {
  const bp = inventedBlueprint("decl-chain");
  const mosaic = JSON.stringify(twoClasses());
  const { tree, stages } = lockNumber(
    recordRoots,
    recorder.ops,
    bp,
    mosaic,
    BOTH,
    1,
  );
  // the class-7 character's tree: its talent in Multi pool 2, none in Additive pool 1
  const kids = (n?: { kids: unknown }) =>
    Array.isArray(n?.kids) ? (n.kids as { name: string; kids: unknown }[]) : [];
  expect(kids(kids(tree)[0]).map((g) => g.name)).not.toContain("🎯 Talents");
  expect(kids(kids(tree)[3]).map((g) => g.name)).toEqual([
    "🙏 Prayers",
    "🎯 Talents",
    "💎 Gem Shop",
  ]);
  expect(Object.keys(stages)).toContain("assemble");
  // no tree asked, none made
  const none = lockNumber(recordRoots, recorder.ops, bp, mosaic, BOTH);
  expect([none.tree, Object.keys(none.stages)]).toEqual([
    undefined,
    expect.not.arrayContaining(["assemble"]),
  ]);
});

test("the tree's character's run is locked once: the assembly takes what its lock kept (T040)", () => {
  const bp = inventedBlueprint("decl-chain");
  const mosaic = JSON.stringify(twoClasses());
  vi.mocked(lockBlueprint).mockClear();
  lockNumber(recordRoots, recorder.ops, bp, mosaic, BOTH, 1);
  expect(vi.mocked(lockBlueprint)).toHaveBeenCalledTimes(BOTH.length);
});
