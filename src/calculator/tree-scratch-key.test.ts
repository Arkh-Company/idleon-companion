// The piece key of a scratch read (spec 009 T023, decision of 18/11): the same box read at two moments is two pieces,
// each keyed by the write it comes from, so a piece shows one value wherever it is.
import { expect, test } from "vitest";
import { instrument } from "./instrument.ts";
import { buildTree } from "./tree-build.ts";
import { shapeOf } from "./tree-engine.ts";
import { scratchKeys } from "./tree/links.ts";
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

// ops: Stamp 0-2 (s.P + s.B), its step reading the total it wrote itself
const { ops } = instrument(
  "Blocks._customBlock_Stamp = function () { return s.P + s.B; };",
);

test("in a tree, a step that reads the working total its own block wrote keys it by that block and that write", () => {
  const rec = recordingOf(
    [
      { b: "(setup: game helpers)" },
      { b: "(root)", c: [2] },
      {
        b: "Stamp",
        a: ["X"],
        v: 6,
        x: [
          [1, 4],
          [2, 2],
          [0, 6],
        ],
        rx: [
          ["DummyNumbersStatManager.Total", 4, 0],
          ["B", 2, 1],
        ],
        r: [
          ["DummyNumbersStatManager.Total", 4, 1],
          ["B", 2],
        ],
      },
    ],
    [
      { path: "DummyNumbersStatManager.Total", node: 2, v: 0, seq: 0 },
      { path: "DummyNumbersStatManager.Total", node: 2, v: 4, seq: 1 },
    ],
    { setup: 0, root: 1 },
  );
  // no cache link covers the box: its writer is the reader itself
  expect(shapeOf(buildTree(rec, 0, ops)).map(([k]) => k)).toContain(
    JSON.stringify([0, "DummyNumbersStatManager.Total", 'Stamp("X")', 1]),
  );
});

test("a working total the reader wrote itself is keyed by the reader; any other read keeps its path alone", () => {
  const nodes = recordingOf([
    { b: "StampTotal", a: ["X"], v: 8 },
    { b: "Other", v: 1 },
  ]).nodes;
  const [stamp, other] = nodes;
  const keyOf = scratchKeys(
    [
      { path: "DummyNumbersStatManager.Total", node: 0, v: 0, xi: 0, seq: 0 },
      { path: "DummyNumbersStatManager.Total", node: 0, v: 4, xi: 1, seq: 1 },
    ],
    0,
  );
  // no writer linked (the box is no DNSM cache): the reader's own write of the value read
  expect(keyOf("DummyNumbersStatManager.Total", 4, null, stamp ?? null)).toBe(
    JSON.stringify([0, "DummyNumbersStatManager.Total", 'StampTotal("X")', 1]),
  );
  // a call that never wrote that value, a box no call wrote, and a read of the player's state: the path alone
  expect(keyOf("DummyNumbersStatManager.Total", 7, other ?? null)).toBe(
    '[0,"DummyNumbersStatManager.Total"]',
  );
  expect(keyOf("DNSM.Saved", 5, null)).toBe('[0,"DNSM.Saved"]');
  expect(keyOf("Stats.x", 0, stamp ?? null)).toBe('[0,"Stats.x"]');
});
