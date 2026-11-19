// The piece key of a scratch read (spec 009 T023, decision of 18/11): the same box read at two moments is two pieces,
// each keyed by the write it comes from, so a piece shows one value wherever it is.
import { expect, test } from "vitest";
import { buildTree } from "./tree-build.ts";
import { shapeOf } from "./tree-engine.ts";
import { recordingOf } from "./tree/tree-fixture.ts";

// Writer(1) writes the box twice, and each of its two readers reads one of the writes
const REC = recordingOf(
  [
    { b: "(setup: game helpers)" },
    { b: "(root)", c: [2] },
    { b: "Top", v: 7, c: [3] },
    { b: "Writer", a: [1], v: 7, c: [4, 5] },
    { b: "ReadA", v: 2, r: [["DNSM.Box", 2, 0]] },
    { b: "ReadB", v: 5, r: [["DNSM.Box", 5, 1]] },
  ],
  [
    { path: "DNSM.Box", node: 3, v: 2, seq: 0 },
    { path: "DNSM.Box", node: 3, v: 5, seq: 1 },
  ],
  { setup: 0, root: 1 },
);

test("a scratch box read at two moments is two pieces, each keyed by its writer's call and the write's place", () => {
  const keys = shapeOf(buildTree(REC, 0))
    .map(([k]) => k)
    .filter((k) => k.includes("DNSM.Box"));
  expect(keys).toEqual([
    '[0,"DNSM.Box","Writer(1)",0]',
    '[0,"DNSM.Box","Writer(1)",1]',
  ]);
});

test("a working total the reader wrote itself is keyed by the reader; a box no call wrote keeps its path alone", () => {
  const rec = recordingOf(
    [
      { b: "(setup: game helpers)" },
      { b: "(root)", c: [2] },
      { b: "Top", v: 9, c: [3, 4] },
      {
        b: "StampTotal",
        a: ["X"],
        v: 4,
        r: [["DummyNumbersStatManager.Total", 4, 1]],
      },
      { b: "FromGame", v: 5, r: [["DNSM.Saved", 5]] },
    ],
    [
      { path: "DummyNumbersStatManager.Total", node: 3, v: 0, seq: 0 },
      { path: "DummyNumbersStatManager.Total", node: 3, v: 4, seq: 1 },
    ],
    { setup: 0, root: 1, fromGame: ["Saved"] },
  );
  const keys = shapeOf(buildTree(rec, 0)).map(([k]) => k);
  expect(keys).toContain(
    '[0,"DummyNumbersStatManager.Total","StampTotal(\\"X\\")",1]',
  );
  expect(keys).toContain('[0,"DNSM.Saved"]');
});
