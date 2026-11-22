// The root's shapes of the blueprint in the answer key (spec 010, T145, T152, T153; spec, Open Questions 21 and 22/11;
// ADR 0010): a part of a call, a sum of calls and a routine run on the recorder's copy, with their values, over the
// invented game (fake-game.js).
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import type { Recording } from "../recording.ts";
import { bootRecorder } from "../tree-record.ts";
import { answerKey } from "./answer-key.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});

const record = (block: string): Recording =>
  recorder.record(mosaicOf(), [[block, [0, 0, 0]]], {
    recompute: [],
    builders: [],
  });

// Spec 010, T145: the root's shapes, with their values (the review's I3).
test("a part of a call: the value is the recorded step that holds the references, and its terms are them", () => {
  const key = answerKey(record("TreeDeclFactor"), recorder.ops, {
    part: ["TreeLoop()", "TreeTwins[0]"],
  });
  if ("error" in key) throw new Error(key.reason);
  // TreeLoop() sums TreeList (1 + 2 + 3) and TreeTwins[0] is 3 (fake-mosaic.ts)
  expect(key.final).toBe(18);
  expect(key.pools.flatMap((p) => p.terms.map((t) => t.ref))).toEqual([
    "TreeLoop()",
    "TreeTwins[0]",
  ]);
});

test("a part whose step holds a reference outside it is refused, with the references too many", () => {
  const key = answerKey(record("TreeDeclFactor"), recorder.ops, {
    part: ["TreeLoop()", "TreeReads()"],
  });
  expect(key).toMatchObject({ error: "rootForm" });
  expect("reason" in key ? key.reason : "").toMatch(/TreeTwins\[0\]/);
});

test("a sum of calls: the final is the sum of the recorded values, the calls' refs in order", () => {
  const rec = recorder.record(
    mosaicOf(),
    [
      ["TreeReads", [0, 0, 0]],
      ["TreeLoop", [0, 0, 0]],
    ],
    { recompute: [], builders: [] },
  );
  const key = answerKey(rec, recorder.ops, { sum: 2 });
  if ("error" in key) throw new Error(key.reason);
  const [a, b] = (rec.nodes[rec.root ?? -1]?.c ?? []).map(
    (id) => rec.nodes[id]?.v,
  );
  expect(key.final).toBe(Number(a) + Number(b));
  expect(key.final).toBe(14);
  expect(key.pools.flatMap((p) => p.terms.map((t) => t.ref))).toEqual([
    "TreeReads(0,0,0)",
    "TreeLoop(0,0,0)",
  ]);
});

// Spec 010, T152: a routine run on the recorder's copy only (the Cog Board's total).
test("a routine's root: the sum of the state paths the routine writes, each path a source", () => {
  const rec = recorder.record(
    mosaicOf(),
    [],
    { recompute: [], builders: [] },
    false,
    [],
    {
      slot: 0,
      behavior: "ActorEvents_29",
      event: "_customEvent_TreeBoard",
      args: [],
    },
  );
  const key = answerKey(rec, recorder.ops, { routine: "TreeBoard[*]" });
  if ("error" in key) throw new Error(key.reason);
  expect(key.form).toBe("sum");
  // TreeList is 1, 2 and 3, each × (1 + 3 / 100)
  expect(key.final).toBeCloseTo(6.18, 12);
  const terms = key.pools.flatMap((p) => p.terms);
  expect(terms.map((t) => t.ref)).toEqual([
    "TreeBoard[0]",
    "TreeBoard[1]",
    "TreeBoard[2]",
  ]);
  terms.forEach((t, i) => {
    expect(t.value).toBeCloseTo((i + 1) * 1.03, 12);
  });
  const none = answerKey(rec, recorder.ops, { routine: "TreeNothing[*]" });
  expect(none).toMatchObject({ error: "rootForm" });
});
