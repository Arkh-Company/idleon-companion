// A cache filled in a loop over a step written by hand (pieces.cjs entryRows and cacheRows at BASELINE-4): each turn's
// part from its own step, the kind of a turn's part, a write that replaces the total, and the special totals.
import { expect, test } from "vitest";
import { instrument } from "../instrument.ts";
import type { RecNode, Recording } from "../recording.ts";
import { buildTree } from "../tree-build.ts";
import {
  brief,
  kidsOf,
  openPath as open,
  recordingOf,
} from "./tree-fixture.ts";

/**
 * A loop over `t = t + s.A` written by hand: Top reads the cache W wrote at the end of each turn. `turns` gives each
 * turn's running total before, its A, and the reads the turn made (with their place in the step log).
 */
const LOOP = instrument(
  "Blocks._customBlock_W = function () { t = t + s.A; };",
).ops;
const [OP, T, A] = ["op", "leaf", "leaf"].map((kind, i) =>
  LOOP.findIndex(
    (o, j) =>
      o.kind === kind &&
      (i < 2 || j > LOOP.findIndex((x) => x.kind === "leaf")),
  ),
);
function loopOf(
  turns: [before: number, a: number][],
  rx: NonNullable<RecNode["rx"]>,
  more: Partial<RecNode> = {},
  writes = turns.map(([t, a], i) => ({
    path: "DNSM.Acc.v",
    node: 2,
    v: t + a,
    seq: i + 1,
    xi: 3 * (i + 1),
  })),
) {
  const last = writes.at(-1)?.v ?? 0;
  return recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Top", v: 1, r: [["DNSM.Acc.v", last, writes.length]] },
      {
        b: "W",
        x: turns.flatMap(([t, a]): [number, number][] => [
          [T ?? -1, t],
          [A ?? -1, a],
          [OP ?? -1, t + a],
        ]),
        rx,
        ...more,
      },
    ],
    writes,
    { root: 0 },
  );
}
const loopRows = (rec: Recording) =>
  open(buildTree(rec, 0, LOOP), "DNSM.Acc.v");

test("the hand-written loop's steps are its sum", () => {
  expect([OP, T, A].map((i) => LOOP[i ?? -1]?.kind)).toEqual([
    "op",
    "leaf",
    "leaf",
  ]);
});

test("a turn's found item is a yes/no part with nothing under it; a turn that read an item's definition is a raw bonus", () => {
  const rec = loopOf(
    [
      [0, 1],
      [1, 2],
    ],
    [
      ["Cards[1] contains z", true, 0],
      ["A", 1, 1],
      ["ItemDefinitionsGET.k.v", 2, 4],
      ["A", 2, 4],
    ],
  );
  expect(
    kidsOf(loopRows(rec)).map((k) => [k.value, k.leaf, k.condition, k.kids]),
  ).toEqual([
    [1, "condition", "owned", []],
    // no step of 2 in that turn, and the read of 2 is no cache: nothing under it
    [2, "rawBonus", null, []],
  ]);
});

test("[OPUS4-10] a cache whose every write is 0 opens into the last turn's step; a turn read of 0 names nothing", () => {
  const rec = loopOf(
    [
      [0, 0],
      [0, 0],
    ],
    [
      ["A", 0, 1],
      ["B", 0, 4],
      ["Z", 0, 5],
    ],
  );
  expect(kidsOf(loopRows(rec)).map((k) => [k.role, k.code])).toEqual([
    ["atZero", null],
  ]);
  // the last turn read B; the writer's own first step read A
  expect(brief(kidsOf(loopRows(rec))[0])).toEqual([["B", 0]]);
});

test("a write that does not add to the running total replaces it: the parts start again", () => {
  const rec = loopOf(
    [
      [0, 3],
      [5, 2],
    ],
    [
      ["A", 3, 1],
      ["A", 2, 4],
    ],
  );
  expect(kidsOf(loopRows(rec)).map((k) => [k.code, k.value])).toEqual([
    [null, 5],
    ["A", 2],
  ]);
});

/** A loop whose second turn adds 4 with no step of 4, and reads `other` (the cache Other wrote) with the value `read`. */
function otherOf(read: number | string) {
  const rec = loopOf(
    [
      [0, 0],
      [0, 4],
    ],
    [
      ["A", 0, 1],
      ["DNSM.Other.v", read, 6],
    ],
    { c: [3] },
    [
      { path: "DNSM.Acc.v", node: 2, v: 0, seq: 2, xi: 3 },
      { path: "DNSM.Acc.v", node: 2, v: 4, seq: 3, xi: 6 },
    ],
  );
  rec.nodes.push({
    id: 3,
    b: "Other",
    a: [],
    c: [],
    p: 2,
    pxi: 9,
    v: 4,
    r: [["Lv", 4]],
  });
  rec.writes.unshift({ path: "DNSM.Other.v", node: 3, v: 4, seq: 1, xi: 0 });
  return rec;
}

test("a turn with no step of its part opens the cache it read with that value", () => {
  expect(brief(loopRows(otherOf(4)))).toEqual([["Lv", 4]]);
});

test("[R1-PATCH, A R2] a turn's read kept as text is the same number: it opens the cache that wrote it", () => {
  expect(brief(loopRows(otherOf("4")))).toEqual([["Lv", 4]]);
});

test("a cache written once opens into the writer's step that gave the value", () => {
  const rec = loopOf([[2, 3]], [["A", 3, 1]], { v: 0 });
  // the running total before is a value of an earlier step
  expect(brief(loopRows(rec))).toEqual([
    [null, 2],
    ["A", 3],
  ]);
});

test("[OPUS4-4] a total summed again in each loop opens into the run of writes that ends with the value read", () => {
  const p = "DNSM.SpelunkyUpgDN";
  const turns: [number, number][] = [
    [0, 2],
    [2, 3],
    [0, 1],
    [1, 3],
  ];
  const rec = loopOf(
    turns,
    turns.map(([, a], i): [string, number, number] => ["A", a, 3 * i + 1]),
    { v: 4, r: [[p, 5, 2]] },
    turns.map(([t, a], i) => ({
      path: p,
      node: 2,
      v: t + a,
      seq: i + 1,
      xi: 3 * (i + 1),
    })),
  );
  // the writer reads the total itself: the first run (2, then 5) is the value read
  const root = rec.nodes[0];
  if (root) root.c = [2];
  const total = open(buildTree(rec, 0, LOOP), p);
  expect(kidsOf(total).map((k) => [k.value, k.fmt])).toEqual([
    [2, "+"],
    [3, "+"],
  ]);
});

test("[OPUS4-4] a bubble read inside its own turn opens that turn once more, as its own entry, then is cut", () => {
  const p = "DNSM.AlchBubbles.a";
  const rec = loopOf(
    [
      [0, 2],
      [2, 3],
    ],
    [
      [p, 2, 1],
      ["Q", 3, 4],
    ],
    { v: 5, r: [[p, 2, 1]] },
    [
      { path: p, node: 2, v: 2, seq: 1, xi: 3 },
      { path: p, node: 2, v: 5, seq: 2, xi: 6 },
    ],
  );
  const root = rec.nodes[0];
  if (root) root.c = [2];
  const build = buildTree(rec, 0, LOOP);
  // the total before the last turn is the bubble's first write, read in that turn
  const first = open(build, p);
  expect(brief(first)).toEqual([[p, 2]]);
  // inside the turn being walked the same entry opens once more, then the loop stops
  const again = build.expand(kidsOf(first)[0]?.id ?? "");
  expect(brief(again)).toEqual([[p, 2]]);
  expect(build.expand(kidsOf(again)[0]?.id ?? "")?.flags.truncated).toBe(true);
});

test("a turn whose step of its part is only numbers of the code opens the call of the turn with that value", () => {
  // ops: 0 is t + s.A, 1 and 2 its leaves, 3 is 2 * 3
  const { ops } = instrument(
    "Blocks._customBlock_W = function () { t = t + s.A; u = 2 * 3; };",
  );
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Top", v: 1, r: [["DNSM.Acc.v", 12, 2]] },
      {
        b: "W",
        c: [3],
        x: [
          [1, 0],
          [2, 6],
          [0, 6],
          [3, 6],
          [1, 6],
          [2, 6],
          [0, 12],
          [3, 6],
        ],
        rx: [
          ["A", 6, 1],
          ["A", 6, 5],
        ],
      },
      { b: "Part", v: 6, pxi: 6, r: [["Lv", 6]] },
    ],
    [
      { path: "DNSM.Acc.v", node: 2, v: 6, seq: 1, xi: 4 },
      { path: "DNSM.Acc.v", node: 2, v: 12, seq: 2, xi: 8 },
    ],
    { root: 0 },
  );
  const second = kidsOf(open(buildTree(rec, 0, ops), "DNSM.Acc.v"))[1];
  expect(brief(second)).toEqual([["Lv", 6]]);
});
