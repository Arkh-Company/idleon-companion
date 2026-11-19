// The piece key of a scratch read (spec 009 T023, decision of 18/11): the same box read at two moments is two pieces,
// each keyed by the write it comes from, so a piece shows one value wherever it is.
import { expect, test } from "vitest";
import { instrument } from "./instrument.ts";
import { buildTree } from "./tree-build.ts";
import { shapeOf } from "./tree-engine.ts";
import {
  readSeq,
  scratchKey,
  scratchSeen,
  scratchWrites,
} from "./tree/links.ts";
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
  const writeOf = scratchWrites([
    { path: "DummyNumbersStatManager.Total", node: 0, v: 0, xi: 0, seq: 0 },
    { path: "DummyNumbersStatManager.Total", node: 0, v: 4, xi: 1, seq: 1 },
  ]);
  const keyOf = (path: string, value: number, ...by: (typeof stamp)[]) =>
    scratchKey(
      0,
      path,
      writeOf(path, value, undefined, ...by.map((n) => n ?? null)),
    );
  // no writer linked (the box is no DNSM cache): the reader's own write of the value read
  expect(keyOf("DummyNumbersStatManager.Total", 4, undefined, stamp)).toBe(
    JSON.stringify([0, "DummyNumbersStatManager.Total", 'StampTotal("X")', 1]),
  );
  // a call that never wrote that value, a box no call wrote, and a read of the player's state: the path alone
  expect(keyOf("DummyNumbersStatManager.Total", 7, other)).toBe(
    '[0,"DummyNumbersStatManager.Total"]',
  );
  expect(keyOf("DNSM.Saved", 5)).toBe('[0,"DNSM.Saved"]');
  expect(keyOf("Stats.x", 0, stamp)).toBe('[0,"Stats.x"]');
});

test("a box written twice with the same value: the write the read saw, by the write's number the recording gives", () => {
  const [writer] = recordingOf([{ b: "Writer", a: [1] }]).nodes;
  const writeOf = scratchWrites([
    { path: "DNSM.Box", node: 0, v: 1, xi: 0, seq: 0 },
    { path: "DNSM.Box", node: 0, v: 5, xi: 1, seq: 1 },
    { path: "DNSM.Box", node: 0, v: 1, xi: 2, seq: 2 },
  ]);
  expect(writeOf("DNSM.Box", 1, 2, writer ?? null)?.at).toBe(2);
  expect(writeOf("DNSM.Box", 1, 0, writer ?? null)?.at).toBe(0);
  // with no number, the first write of the value
  expect(writeOf("DNSM.Box", 1, undefined, writer ?? null)?.at).toBe(0);
});

test("a write of the builders' pass, kept out of the recording's writes, is still the write a read comes from", () => {
  const [writer] = recordingOf([
    { b: "Who", a: ["AllTalentLVz", "1|4"] },
  ]).nodes;
  // the pass hands its scratch writes over last first: the order is the writes' numbers
  const writeOf = scratchWrites(
    [],
    [
      { path: "DNSM.Who", node: 0, v: 4, xi: 2, seq: 9 },
      { path: "DNSM.Who", node: 0, v: 8, xi: 1, seq: 8 },
    ],
  );
  expect(writeOf("DNSM.Who", 4, 9, writer ?? null)?.at).toBe(1);
  expect(writeOf("DNSM.Who", 8, undefined, writer ?? null)?.at).toBe(0);
});

test("a field of a box that holds an object comes from the write of the box before the read, by its number", () => {
  const [worn] = recordingOf([{ b: "Worn", a: ["STR"] }]).nodes;
  const writeOf = scratchWrites([
    { path: "DNSM.Item", node: 0, v: "(object)", xi: 0, seq: 1 },
    { path: "DNSM.Item", node: 0, v: "(object)", xi: 5, seq: 4 },
  ]);
  expect(writeOf("DNSM.Item.v1", 30, 2, worn ?? null)?.at).toBe(0);
  expect(writeOf("DNSM.Item.v1", 10, 5, worn ?? null)?.at).toBe(1);
  // with no number, a box written with two objects says nothing of which one was read
  expect(writeOf("DNSM.Item.v1", 10, undefined, worn ?? null)).toBeNull();
  // the box itself stops the climb: a path of another box is no field of it
  expect(writeOf("DNSM.ItemB", 10, 5, worn ?? null)).toBeNull();
});

test("the write a read saw is the last write of its path, or of the box that holds it, before the read's number", () => {
  const seen = scratchSeen(
    [
      { path: "DNSM.Box", node: 3, v: 2, xi: 0, seq: 1 },
      { path: "DNSM.Box", node: 4, v: 5, xi: 0, seq: 3 },
      { path: "DNSM.Item", node: 4, v: "(object)", xi: 1, seq: 4 },
    ],
    [{ path: "DNSM.Box", node: 5, v: 7, xi: 0, seq: 6 }],
  );
  expect(seen("DNSM.Box", 2, 2)?.node).toBe(3);
  expect(seen("DNSM.Box", 5, 4)?.node).toBe(4);
  expect(seen("DNSM.Box", 7, 6)?.node).toBe(5);
  expect(seen("DNSM.Item.v1", 30, 4)?.seq).toBe(4);
  // a value no write before the read gave, and a read before any write: none
  expect(seen("DNSM.Box", 9, 4)).toBeNull();
  expect(seen("DNSM.Box", 2, 0)).toBeNull();
});

test("a read's number is its reader's last read of the path with that value, in the loop's turn when one is open", () => {
  const [reader] = recordingOf([
    {
      b: "Loop",
      r: [["DNSM.Box", 3, 10]],
      rx: [
        ["DNSM.Box", 3, 1, 10],
        ["DNSM.Box", 3, 5, 12],
        ["DNSM.Box", 4, 9, 14],
        ["DNSM.Box", 3, 12, 15],
      ],
    },
  ]).nodes;
  expect(readSeq(reader, "DNSM.Box", 3)).toBe(15);
  expect(readSeq(reader, "DNSM.Box", 4)).toBe(14);
  // in the turn of steps 3 to 8, the read of that turn
  expect(readSeq(reader, "DNSM.Box", 3, { from: 3, to: 8 })).toBe(12);
  // a value the log does not have: the first read's number, when it has that value
  expect(readSeq(reader, "DNSM.Box", 9)).toBeUndefined();
  expect(
    readSeq(
      recordingOf([{ b: "X", r: [["DNSM.Box", 3, 10]] }]).nodes[0],
      "DNSM.Box",
      3,
    ),
  ).toBe(10);
});

test("a write's reads are its writer's logged reads after its previous write, of any path, and before it", () => {
  const [w] = recordingOf([
    {
      b: "TalentCalc",
      a: [-2],
      rx: [
        ["Meals[0][1]", 2, 0, 2],
        ["Cards[1].length", 1868, 4, 4],
        ["X", 1, 6, 5],
      ],
    },
  ]).nodes;
  const writeOf = scratchWrites(
    [
      { path: "DNSM.Box", node: 0, v: 1, xi: 1, seq: 3 },
      { path: "DNSM.Other", node: 0, v: 0, xi: 3, seq: 4 },
    ],
    [{ path: "DNSM.Box", node: 0, v: 18, xi: 5, seq: 5 }],
  );
  expect(writeOf("DNSM.Box", 18, 5, w ?? null)?.reads()).toEqual([
    "Cards[1].length",
  ]);
  expect(writeOf("DNSM.Box", 1, 3, w ?? null)?.reads()).toEqual([
    "Meals[0][1]",
  ]);
});
