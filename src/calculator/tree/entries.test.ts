// The entries of a cache the game fills in a loop (build-tree.cjs step 8d2 at BASELINE-4): each write of the entry keeps
// the steps, the calls and the reads of its own turn of the writer's loop.
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import type { Recording } from "../recording.ts";
import { bootRecorder } from "../tree-record.ts";
import { entriesOf } from "./entries.ts";
import { linkReads } from "./links.ts";
import { makeSteps } from "./steps.ts";
import { recordingOf } from "./tree-fixture.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});

const NONE = { recompute: [], builders: [] };
const entries = (rec: Recording, ops = recorder.ops) =>
  entriesOf(rec, linkReads(rec), makeSteps(rec, ops).turn);

test("each write of a cache filled in a loop keeps its turn's steps, calls and reads", () => {
  const rec = recorder.record(mosaicOf(), [["TreeFillRead", [0, 0, 0]]], NONE);
  const fill = rec.nodes.find((n) => n.b === "TreeFillLoop");
  const parts = rec.nodes.filter((n) => n.b === "TreePart").map((n) => n.id);
  const list = entries(rec).get(`${String(fill?.id)}|DNSM.TreeSum.v`);
  expect(list?.map((e) => [e.v, e.k, e.s.map((s) => s.v)])).toEqual([
    [6, [parts[0]], [6]],
    [12, [parts[1]], [12]],
  ]);
  // the second turn's step reads the entry where that turn read it, and takes its own turn's call, not the first one
  // with the same value
  expect(list?.[1]?.s[0]?.e).toEqual({
    t: "op",
    o: "+",
    l: { t: "read", p: "DNSM.TreeSum.v", v: 6 },
    r: { t: "call", id: parts[1], v: 6 },
    v: 12,
  });
  // a read of a cache in a turn carries the call that wrote it
  expect(list?.[1]?.r).toContainEqual(["DNSM.TreeSum.v", 6, fill?.id]);
});

test("a writer with one write has no entries: its own steps are the entry's", () => {
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Top", v: 2, r: [["DNSM.One.v", 2, 1]] },
      { b: "Fill", x: [[0, 2]] },
    ],
    [{ path: "DNSM.One.v", node: 2, v: 2, seq: 1, xi: 1 }],
    { root: 0 },
  );
  expect([...entriesOf(rec, linkReads(rec), () => []).keys()]).toEqual([]);
});

test("a search right at a turn's write belongs to the next turn; a write with nothing computed since the last is none", () => {
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      {
        b: "Top",
        v: 2,
        r: [["DNSM.Acc.v", 2, 3]],
      },
      {
        b: "Fill",
        x: [
          [0, 1],
          [0, 2],
        ],
        rx: [
          ["Item", 1, 0],
          ["List contains a", true, 1],
          ["Item", 2, 2],
        ],
      },
    ],
    [
      { path: "DNSM.Acc.v", node: 2, v: 0, seq: 1 },
      { path: "DNSM.Acc.v", node: 2, v: 1, seq: 2, xi: 1 },
      { path: "DNSM.Acc.v", node: 2, v: 1, seq: 3, xi: 1 },
      { path: "DNSM.Acc.v", node: 2, v: 2, seq: 4, xi: 2 },
    ],
    { root: 0 },
  );
  const list = entriesOf(rec, linkReads(rec), () => []).get("2|DNSM.Acc.v");
  expect(list?.map((e) => [e.v, e.r])).toEqual([
    [1, [["Item", 1]]],
    [
      2,
      [
        ["List contains a", true],
        ["Item", 2],
      ],
    ],
  ]);
});
