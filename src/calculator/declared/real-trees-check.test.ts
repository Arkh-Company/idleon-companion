// The check mode of the real-trees run (spec 010, T033, FR-002a, FR-010, contracts/real-trees-run.md and review.md), in
// CI over the invented game: the review's path and what it keeps, one character of each class of the snapshot, a
// number with a class source locked once per class, and the summary line with each stage's time.
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { CHARACTERS, GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import { bootRecorder } from "../tree-record.ts";
import { inventedBlueprint } from "./lock-fixture.ts";
import {
  classCharacters,
  lockNumber,
  lockRuns,
  reviewPath,
  writeLock,
} from "./real-trees-check.ts";
import type { RecordFn } from "./real-trees-check.ts";
import { summaryLine } from "./real-trees-run.ts";

const SHA = "a".repeat(64);
const GAME_SHA = "b".repeat(64);
const AT = "2026-11-22T21:00:00-03:00";
const dir = mkdtempSync(join(tmpdir(), "reviews-"));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("the review's path comes from the id and the lot only; anything else is refused", () => {
  expect(reviewPath(dir, "stats-drop-rate", "character")).toBe(
    join(dir, "character", "stats-drop-rate.review.json"),
  );
  for (const [id, lot] of [
    ["../stats-drop-rate", "character"],
    ["stats/drop-rate", "character"],
    ["stats-drop-rate", "../character"],
    ["stats-drop-rate", "w8"],
  ] as const)
    expect(() => reviewPath(dir, id, lot)).toThrow();
});

test("the review keeps only the blueprint's hash and the lock (ok, the game's hash, the time), never a reason nor a value", () => {
  mkdirSync(join(dir, "character"), { recursive: true });
  const file = reviewPath(dir, "stats-drop-rate", "character");
  writeLock(dir, "stats-drop-rate", "character", SHA, {
    ok: false,
    gameSha: GAME_SHA,
    at: AT,
  });
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
    version: 1,
    blueprintSha: SHA,
    lock: { ok: false, gameSha: GAME_SHA, at: AT },
    verdict: null,
    note: null,
    history: [],
  });
  // an answer the gallery gave stays while the blueprint is the same
  const saved = JSON.parse(readFileSync(file, "utf8")) as object;
  const approved = { ...saved, verdict: "approved" };
  writeFileSync(file, JSON.stringify(approved));
  writeLock(dir, "stats-drop-rate", "character", SHA, {
    ok: true,
    gameSha: GAME_SHA,
    at: AT,
  });
  expect(JSON.parse(readFileSync(file, "utf8"))).toMatchObject({
    verdict: "approved",
    lock: { ok: true },
  });
  // a review out of its shape is never written over: its history would be lost
  writeFileSync(file, '{"version": 2}');
  expect(() =>
    writeLock(dir, "stats-drop-rate", "character", SHA, {
      ok: true,
      gameSha: GAME_SHA,
      at: AT,
    }),
  ).toThrow();
  expect(readFileSync(file, "utf8")).toBe('{"version": 2}');
});

/** The invented snapshot: the first character of class 3 and active, the second of class 7. */
function snapshot(classes: readonly number[]) {
  const snap = JSON.parse(mosaicOf({ CharacterClass: classes[0] })) as {
    attrs: { PlayerDATABASE: { $m: Record<string, { $m: object }> } };
  };
  CHARACTERS.forEach((name, i) => {
    const saved = snap.attrs.PlayerDATABASE.$m[name];
    if (saved) saved.$m = { ...saved.$m, CharacterClass: classes[i] };
  });
  return snap;
}

test("one character of each class of the snapshot, the active one for its own class", () => {
  expect(classCharacters(snapshot([3, 7]))).toEqual(
    new Map([
      [3, 0],
      [7, 1],
    ]),
  );
  expect(classCharacters(snapshot([3, 3]))).toEqual(new Map([[3, 0]]));
  expect(classCharacters({})).toEqual(new Map());
});

test("a number with a class source runs once per class of the snapshot; one without, once for the active character", () => {
  const classes = new Map([
    [3, 0],
    [7, 1],
  ]);
  expect(lockRuns(inventedBlueprint("decl-chain"), classes, 0)).toEqual([
    { character: 0, characterClass: 3 },
    { character: 1, characterClass: 7 },
  ]);
  expect(lockRuns(inventedBlueprint("decl-expr"), classes, 0)).toEqual([
    { character: 0, characterClass: 3 },
  ]);
});

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(
    GAME,
    PAK,
    { startMs: 5_000, numberMs: 500 },
    { infinite: true },
  );
});

test("each class's run records its own character (the other one rebuilt, inactiveMosaic), and the result joins the runs", () => {
  const seen: { active: unknown; scene: boolean }[] = [];
  const record: RecordFn = (mosaic, scene, roots, routine) => {
    const m = JSON.parse(mosaic) as { attrs: { UserInfo: unknown[] } };
    seen.push({ active: m.attrs.UserInfo[0], scene });
    return recorder.record(
      mosaic,
      roots,
      { recompute: [], builders: [] },
      scene,
      [],
      routine,
    );
  };
  const bp = inventedBlueprint("decl-chain");
  const { lock, stages } = lockNumber(
    record,
    recorder.ops,
    bp,
    JSON.stringify(snapshot([3, 7])),
    [
      { character: 0, characterClass: 3 },
      { character: 1, characterClass: 7 },
    ],
  );
  expect(seen).toEqual([
    { active: CHARACTERS[0], scene: false },
    { active: CHARACTERS[1], scene: true },
  ]);
  // TreeDeclTalent(0) is class 3's, and the game calls it for the class-7 character too
  expect(lock.ok).toBe(false);
  expect(lock.errors).toContainEqual({
    kind: "classMismatch",
    where: "decl-chain/0/talents/talent",
    expected: "3",
    got: 7,
  });
  expect(Object.keys(stages)).toEqual(
    expect.arrayContaining(["mosaic", "roots", "answerKey", "lock"]),
  );

  const alone = lockNumber(
    record,
    recorder.ops,
    bp,
    JSON.stringify(snapshot([3, 7])),
    [{ character: 0, characterClass: 3 }],
  );
  expect(alone.lock).toMatchObject({ ok: true, errors: [] });
});

test("the summary line carries the time of each stage", () => {
  expect(
    summaryLine("stats-drop-rate", {
      result: "passed",
      ms: 3210.4,
      stages: { mosaic: 812.6, roots: 2001, answerKey: 40.2, lock: 9 },
    }),
  ).toBe(
    "stats-drop-rate\tpassed\t3210 ms\tmosaic 813 ms, roots 2001 ms, answerKey 40 ms, lock 9 ms",
  );
});
