// The root's shapes of the blueprint in the answer key, over a loop (spec 010, T161, T163; spec, Open Questions 22/11;
// moved out of answer-key-shapes.test.ts as they were): a part in each turn of a loop, a branch's turns by the list it
// searches, and the cap of a call's step log, over the invented game (fake-game.js).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import { LOG_CAP } from "../recording.ts";
import type { Recording } from "../recording.ts";
import { bootRecorder } from "../tree-record.ts";
import { answerKey } from "./answer-key.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(
    GAME,
    PAK,
    { startMs: 5_000, numberMs: 500 },
    { infinite: true },
  );
});

const record = (block: string): Recording =>
  recorder.record(mosaicOf(), [[block, [0, 0, 0]]], {
    recompute: [],
    builders: [],
  });

// Spec 010, T161 (spec, Open Questions 22/11): a root that returns no number takes a part; the same part in each turn
// of a loop, with the same terms and the same value, is one part; in a ➗ line, the part is in %.
test("a part in each turn of a loop, with the same terms and value, is one part, and the root needs no number (the Seraph)", () => {
  const rec = record("TreeSignLoop");
  expect(typeof rec.nodes[rec.nodes[rec.root ?? -1]?.c[0] ?? -1]?.v).not.toBe(
    "number",
  );
  const key = answerKey(rec, recorder.ops, {
    part: ["TreeStats.a", "TreeLevel"],
  });
  if ("error" in key) throw new Error(key.reason);
  // min(5, (1.1 + 3 / 100) ^ ceil(26 / 20))
  expect(key.final).toBeCloseTo(1.13 ** 2, 12);
  expect(key.pools.flatMap((p) => p.terms.map((t) => t.refs))).toEqual([
    ["TreeStats.a", "TreeLevel"],
  ]);
});

test("a part whose value changes from turn to turn of the loop is refused", () => {
  const key = answerKey(record("TreeSignTurns"), recorder.ops, {
    part: ["TreeStats.a"],
  });
  expect("reason" in key ? key.reason : "no refusal").toMatch(
    /a parte não tem os mesmos termos e o mesmo valor em todas as voltas do laço/,
  );
});

test("a part in the ➗ line of each turn (the Mob respawn): its terms in %", () => {
  // each time ÷ (1 + (TreeReads() + TreeBase + TreeList[i]) / 100): the part is 8 + 4
  const key = answerKey(record("TreeRespawnLoop"), recorder.ops, {
    part: ["TreeReads()", "TreeBase"],
  });
  if ("error" in key) throw new Error(key.reason);
  expect(key.final).toBeCloseTo(12, 12);
  expect(
    key.pools.map((p) => [p.kind, p.terms.map((t) => [t.ref, t.weight])]),
  ).toEqual([
    [
      "additive",
      [
        ["TreeReads()", 1],
        ["TreeBase", 1],
      ],
    ],
  ]);
});

// Spec 010, T163 (spec, Open Questions 22/11): the Mob respawn, one tree per world. The blueprint says which turns of
// the loop are the world's by the list its branch searches, never by their order; the world's ➗ line is its part.
const weights = (key: ReturnType<typeof answerKey>) =>
  "error" in key
    ? key.reason
    : key.pools.flatMap((p) => p.terms.map((t) => [t.ref, t.weight]));

test("a branch takes the turns whose search of its list found the item: the world's whole ➗ line, in %", () => {
  const rec = record("TreeRespawnWorlds");
  const part = ["TreeReads()", "TreeBase", "TreeStats.a"];
  // without a branch, the turns of the first and the third world have the same terms and other values
  const mixed = answerKey(rec, recorder.ops, { part });
  expect("reason" in mixed ? mixed.reason : "no refusal").toMatch(
    /a parte não tem os mesmos termos e o mesmo valor em todas as voltas do laço/,
  );
  const key = answerKey(rec, recorder.ops, { part, branch: "TreeWorlds[0]" });
  if ("error" in key) throw new Error(key.reason);
  // 8 + 4 + 3
  expect(key.final).toBeCloseTo(15, 12);
  expect(weights(key)).toEqual([
    ["TreeReads()", 1],
    ["TreeBase", 1],
    ["TreeStats.a", 1],
  ]);
});

test("a constant that multiplies a sum in the ➗ line scales each of its terms (the 0.65 of W7)", () => {
  const key = answerKey(record("TreeRespawnWorlds"), recorder.ops, {
    part: ["TreeReads()", "TreeBase", "TreeStats.b"],
    branch: "TreeWorlds[1]",
  });
  if ("error" in key) throw new Error(key.reason);
  // 0.65 × (8 + 4) + 5
  expect(key.final).toBeCloseTo(12.8, 12);
  expect(weights(key)).toEqual([
    ["TreeReads()", 0.65],
    ["TreeBase", 0.65],
    ["TreeStats.b", 1],
  ]);
});

test("a branch whose turns differ, a branch's turn without the part, or a branch with no turn is refused", () => {
  const rec = record("TreeRespawnWorlds");
  const reason = (part: string[], branch: string) => {
    const key = answerKey(rec, recorder.ops, { part, branch });
    return "reason" in key ? key.reason : "no refusal";
  };
  const part = ["TreeReads()", "TreeBase", "TreeStats.a"];
  expect(reason(part, "TreeWorlds[2]")).toMatch(
    /a parte não tem os mesmos termos e o mesmo valor em todas as voltas do laço/,
  );
  // a turn of the branch is never left out: the reference missing in it refuses the root
  expect(reason([...part, "TreeLevel"], "TreeWorlds[0]")).toMatch(
    /a parte não é termo de um pool gravado: TreeLevel/,
  );
  expect(reason(part, "TreeNoWorld")).toMatch(
    /nenhuma volta achou o item na lista TreeNoWorld/,
  );
});

// The review of T163: a step log cut at the recorder's cap could leave turns of the branch out without a word.
test("the cap of a call's step log is the recorder's, and a branch over a log at the cap is refused", () => {
  const src = readFileSync(
    join(import.meta.dirname, "..", "recorder.js"),
    "utf8",
  );
  expect(LOG_CAP).toBe(20_000);
  expect(/var LOG_CAP = (\d+);/.exec(src)?.[1]).toBe(String(LOG_CAP));
  const rec = record("TreeRespawnWorlds");
  const top = rec.nodes[rec.nodes[rec.root ?? -1]?.c[0] ?? -1];
  if (!top?.rx) throw new Error("no step log");
  while (top.rx.length < LOG_CAP) top.rx.push(["TreePad", 0, 0]);
  const key = answerKey(rec, recorder.ops, {
    part: ["TreeReads()", "TreeBase", "TreeStats.a"],
    branch: "TreeWorlds[0]",
  });
  expect("reason" in key ? key.reason : "no refusal").toMatch(
    /o log da chamada chegou ao limite antes das voltas do ramo/,
  );
});
