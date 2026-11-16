// The passes of pieces.cjs explainOnce0 at BASELINE-4: a block that only returns one cache, the outcome of a lone check
// (OPUS4-T2) and the root that opens its last step ([F2-TOP]).
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import { instrument } from "../instrument.ts";
import type { RecNode } from "../recording.ts";
import { buildTree } from "../tree-build.ts";
import { bootRecorder } from "../tree-record.ts";
import { brief, kidsOf, openPath, recordingOf } from "./tree-fixture.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});
const NONE = { recompute: [], builders: [] };
const gameOf = (block: string) =>
  buildTree(
    recorder.record(mosaicOf(), [[block, [0, 0, 0]]], NONE),
    0,
    recorder.ops,
  );

/** Top reads one cache W wrote, with Top's own value; `more` are Top's other reads. */
const onlyOf = (more: [string, number][] = []) =>
  recordingOf(
    [
      { b: "(root)", c: [1, 2] },
      { b: "Top", v: 7, r: [["DNSM.Only.v", 7, 1], ...more] },
      { b: "W", v: 7, r: [["Lv", 7]] },
    ],
    [{ path: "DNSM.Only.v", node: 2, v: 7, seq: 1 }],
    { root: 0 },
  );

test("a block that only returns one cache shows the cache's own computation", () => {
  expect(brief(buildTree(onlyOf(), 0).root)).toEqual([["Lv", 7]]);
});

test("a block that also read something else keeps its cache as a row", () => {
  expect(brief(buildTree(onlyOf([["Lv2", 3]]), 0).root)).toEqual([
    ["DNSM.Only.v", 7],
    ["Lv2", 3],
  ]);
});

/** A block with one check of the player's state against a number made of its own argument, and no step. */
const GATE = instrument(
  "Blocks._customBlock_Gate = function (t) { return s.L > t * 2 ? Number(s.C) : 0; };",
).ops;
function gateOf(t: number, passed: boolean, v: number): RecNode[] {
  const at = (kind: string, k = 0) =>
    GATE.flatMap((o, i) => (o.kind === kind ? [i] : []))[k] ?? -1;
  return recordingOf(
    [
      { b: "(root)", c: [1] },
      {
        b: "Gate",
        a: [t],
        v,
        r: [
          ["L", 25],
          ["CustomLists.Gate[0]", "7"],
        ],
        rx: [["L", 25, 0]],
        x: [
          [at("leaf", 0), 25],
          [at("leaf", 1), t],
          [at("op"), t * 2],
          [at("cmp"), passed],
          [at("test"), passed],
        ],
      },
    ],
    [],
    { root: 0 },
  ).nodes;
}
const gateRows = (t: number, passed: boolean, v: number) =>
  kidsOf(
    buildTree(
      { ...recordingOf([]), nodes: gateOf(t, passed, v), root: 0 },
      0,
      GATE,
    ).root,
  ).map((k) => [k.name, k.code, k.value, k.leaf]);

test("[OPUS4-T2] a lone check that passed and returned a table cell shows the bonus beside the check", () => {
  expect(gateRows(3, true, 7)).toEqual([
    ["Game value", "L", 25, "unknown"],
    ["Game value", null, 1, "condition"],
    ["Bonus when the check passes", "CustomLists.Gate[0]", 7, "fixedValue"],
  ]);
});

test("[OPUS4-T2] a lone check that failed and returned 0 shows the value it falls back to", () => {
  expect(gateRows(20, false, 0)).toEqual([
    ["Game value", "L", 25, "unknown"],
    ["Game value", null, 0, "condition"],
    ["Value when the check fails", null, 0, "fixedValue"],
  ]);
});

test("[F2-TOP] the root whose last step rounds a cache opens into that step's parts", () => {
  expect(brief(gameOf("TreeTopRound").root)).toEqual([
    ["DNSM.GameCache.v", 5],
    [null, 1.5],
  ]);
});

test("[F2-TOP] the same block under another call stays a leaf", () => {
  const build = gameOf("TreeTopWrap");
  expect(brief(openPath(build, "TreeTopRound()"))).toEqual([]);
});
