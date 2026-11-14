// The ⓘ of a cache read through the assembly (pieces.cjs cacheRows at BASELINE-4, LAST_WRITER_FORMULA): the writer's
// formula reaches the cache's row when the row opens, from each way the cache opens, and a read with an expression's
// value, or a bubble's value, takes it only as the bench does. Hand-written recordings with invented blocks.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { node as windowNode } from "../../renderer/formula-fixture.ts";
import { instrument } from "../instrument.ts";
import type { RecNode } from "../recording.ts";
import { buildTree } from "../tree-build.ts";
import { kidsOf, openPath as open, recordingOf } from "./tree-fixture.ts";

// ops: Top 0-2 (s.P + s.B), TopMin 3-6 (min(s.P, 20) + s.B), TopVal 7-9 (t + s.B), Cap 10-11 (t = min(s.A, 10)),
// Back 12-13 (u = min(s.P, 20)), Add 14-17 (t = t + min(s.A, 10)), Own 18-21 (d.Own = min(s.A, 10); return d.Own × 2)
const { ops } = instrument(
  [
    "Blocks._customBlock_Top = function () { return s.P + s.B; };",
    "Blocks._customBlock_TopMin = function () { return Math.min(s.P, 20) + s.B; };",
    "Blocks._customBlock_TopVal = function () { return t + s.B; };",
    "Blocks._customBlock_Cap = function () { t = Math.min(s.A, 10); };",
    "Blocks._customBlock_Back = function () { u = Math.min(s.P, 20); };",
    "Blocks._customBlock_Add = function () { t = t + Math.min(s.A, 10); };",
    "Blocks._customBlock_Own = function () { d.Own = Math.min(s.A, 10); return d.Own * 2; };",
  ].join(" "),
);
type Spec = Partial<RecNode> & Pick<RecNode, "b">;

/** Top reads cache `p` of `v` (its write `seq`) and B of 2: as a term, inside min(…, 20), or as a value with no source. */
const top = {
  plain: (p: string, v: number, seq = 1): Spec => ({
    b: "Top",
    v: v + 2,
    x: [
      [1, v],
      [2, 2],
      [0, v + 2],
    ],
    rx: [
      [p, v, 0],
      ["B", 2, 1],
    ],
    r: [
      [p, v, seq],
      ["B", 2],
    ],
  }),
  min: (p: string, v: number): Spec => ({
    b: "TopMin",
    v: Math.min(v, 20) + 2,
    x: [
      [5, v],
      [4, Math.min(v, 20)],
      [6, 2],
      [3, Math.min(v, 20) + 2],
    ],
    rx: [
      [p, v, 0],
      ["B", 2, 2],
    ],
    r: [
      [p, v, 1],
      ["B", 2],
    ],
  }),
  // Q has the value too, so the step's t is bound to no read and is named by the first read of that value
  val: (p: string, v: number): Spec => ({
    b: "TopVal",
    v: v + 2,
    x: [
      [8, v],
      [9, 2],
      [7, v + 2],
    ],
    rx: [
      [p, v, 0],
      ["Q", v, 0],
      ["B", 2, 1],
    ],
    r: [
      [p, v, 1],
      ["Q", v],
      ["B", 2],
    ],
  }),
};
/** The cache `p` read by `reader`, that `writer` wrote with `writes` (path, value, place in its step log). */
function cacheOf(
  reader: Spec,
  writer: Spec,
  p: string,
  writes: [v: number, xi: number][],
) {
  const rec = recordingOf(
    [{ b: "(root)", c: [1] }, reader, writer],
    writes.map(([v, xi], i) => ({ path: p, node: 2, v, seq: i + 1, xi })),
    { root: 0 },
  );
  return open(buildTree(rec, 0, ops), p);
}
/** A writer whose ⓘ is a rule of the game's code (pieces.cjs familyFormula, 5starCards), of value `v`. */
const rift = (v: number): Spec => ({
  b: "RiftStuff",
  a: ["5starCards"],
  v,
  r: [["Rift[0]", 50]],
});
const RIFT = (v: number) => ({
  rule: ["1 when the Rift level ≥ 45, else 0", `Rift level 50 → ${String(v)}`],
});
/** A writer that wrote 10 = min(A, 10) once, A of 12, and returned 0. */
const CAP: Spec = {
  b: "Cap",
  v: 0,
  x: [
    [11, 12],
    [10, 10],
  ],
  rx: [["A", 12, 0]],
  r: [["A", 12]],
};
const CAP_F = [
  ["min", "(", "A", ",", "10", ")"],
  [12, 10, 10],
];
const P = "DNSM.P.v";

test("a cache the writer returned opens into the writer, with the writer's ⓘ", () => {
  expect(cacheOf(top.plain(P, 1), rift(1), P, [[1, 0]])?.formula).toEqual(
    RIFT(1),
  );
});

test("a cache written once opens into the step with its value, with that step's ⓘ; none when that step reads the cache", () => {
  expect(cacheOf(top.plain(P, 10), CAP, P, [[10, 2]])?.formula).toEqual(CAP_F);
  const back: Spec = {
    b: "Back",
    v: 0,
    x: [
      [13, 10],
      [12, 10],
    ],
    rx: [[P, 10, 0]],
    r: [[P, 10, 1]],
  };
  expect(cacheOf(top.plain(P, 10), back, P, [[10, 0]])?.formula).toBeNull();
});

test("a read inside an expression of its value takes the writer's ⓘ only when it gives that value", () => {
  expect(cacheOf(top.min(P, 10), CAP, P, [[10, 2]])?.formula).toEqual(CAP_F);
  // the rule of the code ends with no "= 1"
  expect(cacheOf(top.min(P, 1), rift(1), P, [[1, 0]])?.formula).toBeNull();
});

test("a value with no source, named by a cache, takes the writer's ⓘ; by a bubble, never", () => {
  expect(
    cacheOf(top.val("DNSM.Other.z", 7), rift(7), "DNSM.Other.z", [[7, 0]])
      ?.formula,
  ).toEqual(RIFT(7));
  const bubble = "DNSM.AlchBubbles.z";
  const read = cacheOf(top.val(bubble, 7), rift(7), bubble, [[7, 0]]);
  expect([read?.code, read?.formula]).toEqual([bubble, null]);
});

const MIN_GAME_VALUE = (a: number) => [
  ["min", "(", "Game value", ",", "10", ")"],
  [a, 10, a],
];

test("a cache one turn of a loop made (the turn before was replaced) has that turn's step as its ⓘ", () => {
  const writer: Spec = {
    b: "Cap",
    x: [
      [11, 3],
      [10, 3],
      [11, 5],
      [10, 5],
    ],
    rx: [
      ["A", 3, 0],
      ["A", 5, 2],
    ],
  };
  const read = cacheOf(top.plain(P, 5, 2), writer, P, [
    [3, 2],
    [5, 4],
  ]);
  expect(read?.formula).toEqual(MIN_GAME_VALUE(5));
});

test("each part of a cache a loop added to has the ⓘ of what its turn added", () => {
  const writer: Spec = {
    b: "Add",
    x: [
      [15, 0],
      [17, 3],
      [16, 3],
      [14, 3],
      [15, 3],
      [17, 4],
      [16, 4],
      [14, 7],
    ],
    rx: [
      ["A", 3, 1],
      ["A", 4, 5],
    ],
  };
  const read = cacheOf(top.plain(P, 7, 2), writer, P, [
    [3, 4],
    [7, 8],
  ]);
  expect(kidsOf(read).map((k) => [k.value, k.formula])).toEqual([
    [3, MIN_GAME_VALUE(3)],
    [4, MIN_GAME_VALUE(4)],
  ]);
});

test("a cache the call being built computed in a step of its own has that step's ⓘ", () => {
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      {
        b: "Own",
        v: 20,
        x: [
          [19, 12],
          [18, 10],
          [21, 10],
          [20, 20],
        ],
        rx: [
          ["A", 12, 0],
          ["DNSM.Own.v", 10, 2],
        ],
        r: [
          ["A", 12],
          ["DNSM.Own.v", 10, 1],
        ],
      },
    ],
    [{ path: "DNSM.Own.v", node: 1, v: 10, seq: 1, xi: 2 }],
    { root: 0 },
  );
  expect(open(buildTree(rec, 0, ops), "DNSM.Own.v")?.formula).toEqual(CAP_F);
});

/** A skill's rank of `rank` (pieces.cjs cacheRows deep-2): two characters' levels, 100 and 120, total 220. */
function rankOf(rank: number) {
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Top", v: 9, r: [["DNSM.skillLvRanks[0]", rank, 2]] },
      {
        b: "RiftStuff",
        a: ["skillLvRanks"],
        x: [
          [0, 1],
          [0, 1],
        ],
        rx: [
          ["DNSM.skillLvRanksDN", 220, 1],
          ["P.Lv0[1]", 100, 1],
          ["Q.Lv0[1]", 120, 1],
        ],
      },
    ],
    [
      { path: "DNSM.skillLvRanksDN", node: 2, v: 220, seq: 1, xi: 1 },
      { path: "DNSM.skillLvRanks[0]", node: 2, v: rank, seq: 2, xi: 2 },
    ],
    { root: 0 },
  );
  return open(buildTree(rec, 0), "DNSM.skillLvRanks[0]")?.formula;
}
const LIMITS =
  "Number of limits (150, 200, 300, 400, 500, 750, 1000) that the account's total level of the skill reaches";

test("[deep-2] a skill's rank is a 1 per limit its total reaches, or the count when the 1s do not give it", () => {
  expect(rankOf(2)).toEqual({
    rule: [LIMITS, "1 + 1 + 0 + 0 + 0 + 0 + 0 = 2"],
  });
  expect(rankOf(3)).toEqual({
    rule: [LIMITS, "total 220 reaches 2 of 7 limits = 3"],
  });
  // the main lets it through to the window as it is
  const formula = rankOf(3) ?? null;
  expect(checkTree(windowNode({ formula }), 1)?.formula).toEqual(formula);
});
