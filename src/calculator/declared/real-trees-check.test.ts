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
import { parseBlueprint } from "./blueprint.ts";
import { inventedBlueprint, sourceOf } from "./lock-fixture.ts";
import {
  classCharacters,
  lockNumber,
  lockRuns,
  reviewPath,
  writeLock,
} from "./real-trees-check.ts";
import type { RecordFn } from "./real-trees-check.ts";
import { summaryLine } from "./real-trees-run.ts";
import { SYSTEMS } from "./systems.ts";

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
  expect(() => {
    writeLock(dir, "stats-drop-rate", "character", SHA, {
      ok: true,
      gameSha: GAME_SHA,
      at: AT,
    });
  }).toThrow();
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
  // the active one is the second of its class: it stands for the class
  const same = snapshot([3, 3]);
  expect(
    classCharacters({
      ...same,
      attrs: { ...same.attrs, UserInfo: [CHARACTERS[1]] },
    }),
  ).toEqual(new Map([[3, 1]]));
  expect(classCharacters({})).toEqual(new Map());
});

/** Both classes, the class-7 character with no point in class 3's talent: TreeDeclTalent(0) gives it 0, as the game. */
function twoClasses() {
  const snap = snapshot([3, 7]);
  const second = snap.attrs.PlayerDATABASE.$m[CHARACTERS[1]];
  if (second) second.$m = { ...second.$m, SkillLevels: [0, 8] };
  return snap;
}

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
/** The recorder over the roots it is given. */
const recordRoots: RecordFn = (mosaic, scene, roots, routine) =>
  recorder.record(
    mosaic,
    roots,
    { recompute: [], builders: [] },
    scene,
    [],
    routine,
  );
const BOTH = [
  { character: 0, characterClass: 3 },
  { character: 1, characterClass: 7 },
];

test("each class's run records its own character (the other one rebuilt, inactiveMosaic), and the result joins the runs", () => {
  const seen: { active: unknown; scene: boolean }[] = [];
  const record: RecordFn = (mosaic, scene, roots, routine) => {
    const m = JSON.parse(mosaic) as { attrs: { UserInfo: unknown[] } };
    seen.push({ active: m.attrs.UserInfo[0], scene });
    return recordRoots(mosaic, scene, roots, routine);
  };
  const bp = inventedBlueprint("decl-chain");
  const mosaic = JSON.stringify(twoClasses());
  const { lock, stages } = lockNumber(record, recorder.ops, bp, mosaic, BOTH);
  expect(seen).toEqual([
    { active: CHARACTERS[0], scene: false },
    { active: CHARACTERS[1], scene: true },
  ]);
  // TreeDeclTalent(0) is class 3's: the game calls it for the class-7 character too, at 0; TreeDeclTalent(1) is class
  // 7's, run only on its character's map
  expect(lock.ok).toBe(true);
  expect(lock.errors).toEqual([]);
  expect(Object.keys(stages)).toEqual(
    expect.arrayContaining(["mosaic", "roots", "answerKey", "lock"]),
  );

  // the same error in both runs is said once
  const half = inventedBlueprint("decl-chain");
  sourceOf(half, 2, "guild", "half").constant = 0.7;
  expect(
    lockNumber(recordRoots, recorder.ops, half, mosaic, BOTH).lock.errors,
  ).toEqual([
    { kind: "extraSource", where: "decl-chain/2/guild/half", got: "0.7" },
    {
      kind: "missingSource",
      where: "pool:2",
      pool: "additive",
      expected: "0.5",
    },
    {
      kind: "notClosing",
      where: "pool:2",
      pool: "additive",
      expected: 0.5,
      got: 0,
    },
  ]);
});

test("a recording whose root is out of the pools' rule is refused as rootForm, at the root", () => {
  const swap: RecordFn = (mosaic, scene, _roots, routine) =>
    recordRoots(mosaic, scene, [["TreeDeclSwap", [0, 0, 0]]], routine);
  const { lock } = lockNumber(
    swap,
    recorder.ops,
    inventedBlueprint("decl-chain"),
    JSON.stringify(twoClasses()),
    [{ character: 0, characterClass: 3 }],
  );
  expect(lock.ok).toBe(false);
  expect(lock.errors).toEqual([
    expect.objectContaining({ kind: "rootForm", where: "root" }),
  ]);
});

test("every complete invented blueprint (fixtures/blueprints) passes the lock over its root in the invented game", () => {
  const files = import.meta.glob<unknown>(
    "../fixtures/blueprints/*.blueprint.json",
    { eager: true, import: "default" },
  );
  const systemIds = new Set(SYSTEMS.map((s) => s.id));
  const snap = twoClasses();
  const locked: string[] = [];
  const refused = Object.entries(files).flatMap(([path, raw]) => {
    const fileId = /([^/]+)\.blueprint\.json$/.exec(path)?.[1] ?? "";
    const out = parseBlueprint(raw, { fileId, systemIds });
    if (!out.ok || out.stage !== "complete") return [];
    locked.push(fileId);
    const runs = lockRuns(out.blueprint, classCharacters(snap), 0);
    const { lock } = lockNumber(
      recordRoots,
      recorder.ops,
      out.blueprint,
      JSON.stringify(snap),
      runs,
    );
    return lock.ok ? [] : [[fileId, lock.errors]];
  });
  expect(locked).toContain("decl-chain");
  expect(refused).toEqual([]);
});

/** TreeGateMapRoot over both classes, each character's map with `sizes` entries (map 3 the first's, 7 the second's). */
function gateLock(sizes: [number, number]) {
  const out = parseBlueprint(
    {
      id: "invented-gate",
      root: { name: "Invented", ref: { call: "TreeGateMapRoot", args: [] } },
      pools: [
        {
          kind: "additive",
          groups: [
            {
              system: "cards",
              sources: [
                {
                  key: "level",
                  name: "Level",
                  ref: { read: "TreeLevel" },
                  leaf: "level",
                },
                {
                  key: "gate",
                  name: "Gate",
                  ref: { call: "TreeGateMap", args: [] },
                  children: [
                    {
                      key: "item",
                      name: "Item",
                      ref: { call: "TreeTurnItem", args: [1] },
                      children: [
                        {
                          key: "list",
                          name: "List",
                          ref: { read: "TreeList[1]" },
                          leaf: "level",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    { fileId: "invented-gate", systemIds: new Set(["cards"]) },
  );
  if (!out.ok) throw new Error(out.reason);
  const snap = twoClasses() as ReturnType<typeof twoClasses> & {
    attrs: { TreeMaps?: unknown };
  };
  const maps: number[][] = Array.from({ length: 8 }, () => []);
  maps[3] = Array.from({ length: sizes[0] }, () => 1);
  maps[7] = Array.from({ length: sizes[1] }, () => 1);
  snap.attrs.TreeMaps = maps;
  const mosaic = JSON.stringify(snap);
  return lockNumber(recordRoots, recorder.ops, out.blueprint, mosaic, BOTH)
    .lock;
}

test("a run whose gate gives the code's 0 before its count does not refuse the children it did not reach (T210)", () => {
  // the first character's map opens the gate (TreeTurnItem(1) = 4), the second's closes it (0)
  const lock = gateLock([3, 1]);
  expect(lock.errors).toEqual([]);
  expect(lock.ok).toBe(true);
});

test("a child no run reached, the gate closed in every run, is still refused when the runs join (T210)", () => {
  expect(gateLock([1, 1]).errors).toEqual([
    { kind: "childNoValue", where: "invented-gate/0/cards/gate/item" },
  ]);
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
