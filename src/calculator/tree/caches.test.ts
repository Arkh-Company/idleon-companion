// A cache read opens into what its writer computed for it (pieces.cjs cacheRows and entryRows at BASELINE-4): the turns
// of a loop as parts, the writer's step, the turn a factor was multiplied in, and the rule of each special cache.
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import type { Recording } from "../recording.ts";
import { buildTree } from "../tree-build.ts";
import { bootRecorder } from "../tree-record.ts";
import {
  brief,
  kidsOf,
  openPath as open,
  recordingOf,
} from "./tree-fixture.ts";

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
test("a cache filled in a loop opens into one part per turn, each with its turn's step or call", () => {
  const build = gameOf("TreeFillRead");
  const sum = open(build, "DNSM.TreeSum.v");
  expect(kidsOf(sum).map((k) => [k.code, k.value, k.fmt])).toEqual([
    ["TreePart(0)", 6, "+"],
    ["TreePart(1)", 6, "+"],
  ]);
  // the first turn's step adds the call to the running total; the second turn has no step of 6, so its call opens
  expect(brief(kidsOf(sum)[0])).toEqual([
    ["TreePart(0)", 6],
    [null, 0],
  ]);
  expect(brief(kidsOf(sum)[1])).toEqual([
    ["TreeTwins[1]", 3],
    [null, 2],
  ]);
});

test("a cache the writer reads inside its own loop, with nothing that gives it, is cut", () => {
  const build = gameOf("TreeFillRead");
  const zero = open(build, "DNSM.TreeSum.v", "TreePart(0)", null);
  const read = kidsOf(zero).find((k) => k.code === "DNSM.TreeSum.v");
  expect(build.expand(read?.id ?? "")?.flags.truncated).toBe(true);
});

test("a turn with a function beside the running total opens into it; a write that multiplies is a factor", () => {
  const scale = open(gameOf("TreeScaleRead"), "DNSM.TreeScale.v");
  expect(
    kidsOf(scale).map((k) => [k.name === "Multiplier", k.value, k.fmt]),
  ).toEqual([
    [false, 5, "+"],
    [false, 5, "+"],
    [true, 4, "x"],
  ]);
  const [, second, factor] = kidsOf(scale);
  expect(brief(kidsOf(second)[0])).toEqual([
    ["TreeTwins[1]", 3],
    [null, 1.5],
  ]);
  expect(brief(factor)).toEqual([["TreeBase", 4]]);
});

test("a cache the block computed in one of its own steps opens into that step", () => {
  expect(brief(open(gameOf("TreeOwnStep"), "DNSM.TreeOwn.v"))).toEqual([
    ["TreeBase", 4],
    [null, 1],
  ]);
});

test("[T3] a factor the block multiplied by a call opens into that turn, read by a call it made", () => {
  expect(
    brief(open(gameOf("TreeFactor"), "TreeFacRead()", "DNSM.TreeFac.v")),
  ).toEqual([
    ["DNSM.TreeFac.v", 5],
    ["TreeArg(1)", 4],
  ]);
});

test("[DEEP-1] a cache the block filled when it was empty opens into its turns when the block reads it back", () => {
  expect(
    kidsOf(open(gameOf("TreeFillOnce"), "DNSM.TreeOnce[0]")).map((k) => [
      k.code,
      k.value,
    ]),
  ).toEqual([
    ["TreePart(0)", 6],
    ["TreePart(1)", 6],
  ]);
});

/** Top reads a loop's cache with no writer recorded for the read; Fill writes it in two turns and reads it back. */
const BY_VALUE = recordingOf(
  [
    { b: "(root)", c: [1] },
    { b: "Top", v: 5, c: [2], r: [["DNSM.Acc.v", 5]] },
    {
      b: "Fill",
      v: 0,
      c: [3, 4],
      x: [
        [0, 1],
        [0, 1],
      ],
      r: [["DNSM.Acc.v", 0, 1]],
      rx: [
        ["DNSM.Acc.v", 0, 1],
        ["DNSM.Acc.v", 5, 2],
      ],
    },
    { b: "Part", a: [0], v: 0 },
    { b: "Part", a: [1], v: 5, pxi: 2, r: [["Lv", 5]] },
    { b: "(setup: game helpers)" },
  ],
  [
    { path: "DNSM.Acc.v", node: 2, v: 0, seq: 1, xi: 1 },
    { path: "DNSM.Acc.v", node: 2, v: 5, seq: 2, xi: 2 },
    { path: "DNSM.Acc.v", node: 5, v: 9, seq: 3 },
  ],
  { root: 0, setup: 5 },
);

test("a read with no writer recorded opens into the loop whose write has that very value", () => {
  expect(brief(open(buildTree(BY_VALUE, 0), "DNSM.Acc.v"))).toEqual([
    ["Lv", 5],
  ]);
});

test("a working value the call rewrites in its own loop is no part of the call", () => {
  // Fill is 0: it sits in the group of the parts at 0
  expect(brief(open(buildTree(BY_VALUE, 0), null, "Fill()"))).toEqual([
    ["Part(0)", 0],
    ["Part(1)", 5],
  ]);
});

/** Bub writes a bubble in two turns; its first turn's call reads the bubble back. */
const BUBBLE: Recording = recordingOf(
  [
    { b: "(root)", c: [1] },
    {
      b: "Bub",
      v: 30,
      c: [2, 3],
      x: [
        [0, 1],
        [0, 1],
        [0, 1],
      ],
      r: [["DNSM.AlchBubbles.a", 8, 1]],
    },
    { b: "Part", a: [1], v: 8, r: [["DNSM.AlchBubbles.a", 8, 1]] },
    { b: "Part", a: [2], v: 24, pxi: 2, r: [["Lv", 24]] },
  ],
  [
    { path: "DNSM.AlchBubbles.a", node: 1, v: 8, seq: 1, xi: 1 },
    { path: "DNSM.AlchBubbles.a", node: 1, v: 24, seq: 2, xi: 2 },
  ],
  { root: 0 },
);

test("[OPUS4-4] a bubble read by its own loop opens into the turn that wrote that value", () => {
  expect(brief(open(buildTree(BUBBLE, 0), "DNSM.AlchBubbles.a"))).toEqual([
    ["DNSM.AlchBubbles.a", 8],
  ]);
});

test("[OPUS4-4] inside that turn, the same bubble does not open its turn again", () => {
  const build = buildTree(BUBBLE, 0);
  const inner = kidsOf(open(build, "DNSM.AlchBubbles.a"))[0];
  expect(build.expand(inner?.id ?? "")?.flags.truncated).toBe(true);
});

test("[deep-2] a skill's rank opens into each character's level of the skill", () => {
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Top", v: 9, r: [["DNSM.skillLvRanks[0]", 2, 2]] },
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
      { path: "DNSM.skillLvRanks[0]", node: 2, v: 2, seq: 2, xi: 2 },
    ],
    { root: 0 },
  );
  const ranks = open(buildTree(rec, 0), "DNSM.skillLvRanks[0]");
  expect(kidsOf(ranks).map((k) => [k.code, k.value, k.leaf])).toEqual([
    ["PlayerDATABASE[0].Lv0[1]", 100, "level"],
    ["PlayerDATABASE[1].Lv0[1]", 120, "level"],
  ]);
});
