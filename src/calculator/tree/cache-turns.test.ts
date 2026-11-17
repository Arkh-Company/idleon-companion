// A cache filled in a loop over a step written by hand (pieces.cjs entryRows and cacheRows at BASELINE-4): each turn's
// part from its own step, the kind of a turn's part, a write that replaces the total, and the special totals.
import { expect, test } from "vitest";
import { instrument } from "../instrument.ts";
import { buildTree } from "../tree-build.ts";
import {
  brief,
  kidsOf,
  openPath as open,
  recordingOf,
} from "./tree-fixture.ts";
import { A, LOOP, loopOf, loopRows, OP, T } from "./loop-fixture.ts";

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

test("[OPUS4-10] a cache whose every write is 0 is the last turn's read of 0, its one part of its value (pieces.cjs structurePass, spec 009 FR-016); that read names nothing", () => {
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
  // the last turn read B at 0, the cache's one part with its value, which the row takes (no At 0 group holds it apart
  // any more); the read names nothing, so the row keeps the cache's own
  const cache = loopRows(rec);
  expect([cache?.code, cache?.value, cache?.kids, cache?.flags]).toEqual([
    "DNSM.Acc.v",
    0,
    [],
    { unnamed: true },
  ]);
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
    // two reads: a call whose one row has its value would be that row (pieces.cjs structurePass)
    r: [
      ["Lv", 4],
      ["Tier", 1],
    ],
  });
  rec.writes.unshift({ path: "DNSM.Other.v", node: 3, v: 4, seq: 1, xi: 0 });
  return rec;
}

test("a turn with no step of its part opens the cache it read with that value", () => {
  expect(brief(loopRows(otherOf(4)))).toEqual([
    ["Lv", 4],
    ["Tier", 1],
  ]);
});

test("[R1-PATCH, A R2] a turn's read kept as text is the same number: it opens the cache that wrote it", () => {
  expect(brief(loopRows(otherOf("4")))).toEqual([
    ["Lv", 4],
    ["Tier", 1],
  ]);
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
  // each turn adds s.B (0) beside s.A, so a turn has two rows and no level is its one row (pieces.cjs structurePass);
  // ops: 0 is (t + s.A) + s.B, 1 is t + s.A, 2 is t, 3 is s.A, 4 is s.B
  const { ops } = instrument(
    "Blocks._customBlock_W = function () { t = t + s.A + s.B; };",
  );
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      {
        b: "W",
        v: 5,
        r: [[p, 2, 1]],
        x: [
          [2, 0],
          [3, 2],
          [1, 2],
          [4, 0],
          [0, 2],
          [2, 2],
          [3, 3],
          [1, 5],
          [4, 0],
          [0, 5],
        ],
        rx: [
          [p, 2, 1],
          ["B", 0, 3],
          ["Q", 3, 6],
          ["B", 0, 8],
        ],
      },
    ],
    [
      { path: p, node: 1, v: 2, seq: 1, xi: 5 },
      { path: p, node: 1, v: 5, seq: 2, xi: 10 },
    ],
    { root: 0 },
  );
  const build = buildTree(rec, 0, ops);
  // the total before the last turn is the bubble's first write, read in that turn
  const first = open(build, p);
  expect(brief(first)).toEqual([
    [p, 2],
    ["B", 0],
  ]);
  // inside the turn being walked the same entry opens once more, then the loop stops
  const again = build.expand(kidsOf(first)[0]?.id ?? "");
  expect(brief(again)).toEqual([
    [p, 2],
    ["B", 0],
  ]);
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
      // two reads: a call whose one row has its value would be that row (pieces.cjs structurePass)
      {
        b: "Part",
        v: 6,
        pxi: 6,
        r: [
          ["Lv", 6],
          ["Tier", 1],
        ],
      },
    ],
    [
      { path: "DNSM.Acc.v", node: 2, v: 6, seq: 1, xi: 4 },
      { path: "DNSM.Acc.v", node: 2, v: 12, seq: 2, xi: 8 },
    ],
    { root: 0 },
  );
  const second = kidsOf(open(buildTree(rec, 0, ops), "DNSM.Acc.v"))[1];
  expect(brief(second)).toEqual([
    ["Lv", 6],
    ["Tier", 1],
  ]);
});

/**
 * A loop whose second turn adds 2 and has a step `s.C * 2` of 2, where C is a cache of 1 that Nil wrote and that opens
 * to nothing; with `call`, the turn calls Part of 2; else it reads the cache Other wrote with 2.
 */
function nilStepOf(call: boolean) {
  // ops: 0 is t + s.A, 1 and 2 its leaves, 3 is s.C * 2, 4 its leaf
  const { ops } = instrument(
    "Blocks._customBlock_W = function () { t = t + s.A; u = s.C * 2; };",
  );
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Top", v: 1, r: [["DNSM.Acc.v", 4, 3]] },
      {
        b: "W",
        c: call ? [3] : [],
        r: [["DNSM.Nil.v", 1, 1]],
        x: [
          [1, 0],
          [2, 2],
          [0, 2],
          [1, 2],
          [2, 2],
          [0, 4],
          [4, 1],
          [3, 2],
        ],
        rx: [
          ["A", 2, 1],
          // the turn's first read of 2, so the one a turn with no call opens
          ...(call ? [] : [["DNSM.Other.v", 2, 3] as [string, number, number]]),
          ["A", 2, 4],
          ["DNSM.Nil.v", 1, 6],
        ],
      },
      // two reads: a call whose one row has its value would be that row (pieces.cjs structurePass)
      {
        b: "Part",
        v: 2,
        pxi: 7,
        r: [
          ["Lv", 2],
          ["Tier", 1],
        ],
      },
      { b: "Nil", v: 1 },
      {
        b: "Other",
        v: 2,
        r: [
          ["Lv", 2],
          ["Tier", 1],
        ],
      },
    ],
    [
      { path: "DNSM.Nil.v", node: 4, v: 1, seq: 1 },
      { path: "DNSM.Other.v", node: 5, v: 2, seq: 0 },
      { path: "DNSM.Acc.v", node: 2, v: 2, seq: 2, xi: 3 },
      { path: "DNSM.Acc.v", node: 2, v: 4, seq: 3, xi: 8 },
    ],
    { root: 0 },
  );
  return kidsOf(open(buildTree(rec, 0, ops), "DNSM.Acc.v"))[1];
}

test("a turn whose step is ×1 but for numbers of the code, with a cache that opens to nothing, opens the call of the turn", () => {
  expect(brief(nilStepOf(true))).toEqual([
    ["Lv", 2],
    ["Tier", 1],
  ]);
});

test("a turn whose step has only a cache that opens to nothing opens the other cache it read with the turn's value", () => {
  expect(brief(nilStepOf(false))).toEqual([
    ["Lv", 2],
    ["Tier", 1],
  ]);
});
