// The ⓘ of a branch through the assembly (spec 008, T017): a lazy branch gets it when it opens, a branch built with its
// level at once, and the shares of its parts are read through it. Hand-written recordings with invented blocks.
import { expect, test } from "vitest";
import { instrument } from "../instrument.ts";
import { buildTree } from "../tree-build.ts";
import { kidsOf, recordingOf } from "./tree-fixture.ts";

test("a branch gets its ⓘ when it opens, its parts by the game's path, and its parts weigh through it", () => {
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Top", v: 7, c: [2] },
      { b: "Mid", v: 7, c: [3, 4] },
      { b: "A", v: 3, r: [["Level", 3]] },
      { b: "B", v: 4, r: [["Level", 4]] },
    ],
    [],
    { root: 0 },
  );
  const build = buildTree(rec, 0);
  const [mid] = kidsOf(build.root);
  expect([mid?.code, mid?.formula]).toEqual(["Mid()", null]);
  const open = build.expand(mid?.id ?? "");
  expect(open?.formula).toEqual([
    ["A()", "+", "B()"],
    [3, 4, 7],
  ]);
  expect(kidsOf(open).map((k) => [k.code, k.share, k.shareMode])).toEqual([
    ["A()", 3 / 7, "sum"],
    ["B()", 4 / 7, "sum"],
  ]);
  // the root's ⓘ is not its parts' (the bench's root has its own rules)
  expect(build.root.formula).toBeNull();
});

test("a branch built with its level has its ⓘ at once", () => {
  const { ops } = instrument(
    "Blocks._customBlock_Top = function () { return s.A * 2 + s.B; };",
  );
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      {
        b: "Top",
        v: 7,
        r: [
          ["A", 3],
          ["B", 1],
        ],
        rx: [
          ["A", 3, 0],
          ["B", 1, 2],
        ],
        x: [
          [2, 3],
          [1, 6],
          [3, 1],
          [0, 7],
        ],
      },
    ],
    [],
    { root: 0 },
  );
  const [part] = kidsOf(buildTree(rec, 0, ops).root);
  expect([part?.value, part?.formula]).toEqual([
    6,
    [
      ["A", "×", "2"],
      [3, 2, 6],
    ],
  ]);
});

test("a part weighs through the ⓘ: 1 + a part ÷ 100", () => {
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Top", v: 9, c: [2, 3] },
      { b: "Mid", v: 1.5, c: [4] },
      { b: "Other", v: 6, r: [["Level", 6]] },
      { b: "A", v: 50, r: [["Level", 50]] },
    ],
    [],
    { root: 0 },
  );
  const build = buildTree(rec, 0);
  const mid = kidsOf(build.root).find((k) => k.code === "Mid()");
  const open = build.expand(mid?.id ?? "");
  expect(open?.formula).toEqual([
    ["1", "+", "A()", "÷", "100"],
    [1, 50, 100, 1.5],
  ]);
  expect(kidsOf(open).map((k) => [k.code, k.share])).toEqual([["A()", 1]]);
});

test("a curve with the branch's value gives the branch its ⓘ", () => {
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Top", v: 9, c: [2, 5] },
      { b: "Mid", v: 4, c: [3, 4] },
      { b: "ArbitraryCode5Inputs", a: ["bigBase", 4, 0, 10], v: 4 },
      { b: "Other", v: 3, r: [["Level", 3]] },
      { b: "Side", v: 5, r: [["Level", 5]] },
    ],
    [],
    { root: 0 },
  );
  const build = buildTree(rec, 0);
  const mid = kidsOf(build.root).find((k) => k.code === "Mid()");
  expect(build.expand(mid?.id ?? "")?.formula).toEqual([
    ["4", "+", "0", "×", "Level the curve uses"],
    [4, 0, 10, 4],
  ]);
});

test("a call's ⓘ is its last step, its parts found among its rows", () => {
  const { ops } = instrument(
    "Blocks._customBlock_Mid = function () { return s.A / 4; };",
  );
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Top", v: 7, c: [2, 3] },
      {
        b: "Mid",
        v: 2,
        r: [["A", 8]],
        rx: [["A", 8, 0]],
        x: [
          [1, 8],
          [0, 2],
        ],
      },
      { b: "Side", v: 5, r: [["Level", 5]] },
    ],
    [],
    { root: 0 },
  );
  const build = buildTree(rec, 0, ops);
  const mid = kidsOf(build.root).find((k) => k.code === "Mid()");
  expect(build.expand(mid?.id ?? "")?.formula).toEqual([
    ["A", "÷", "4"],
    [8, 4, 2],
  ]);
});

test("the expression around a call with the call's value, when nothing else gives one", () => {
  const { ops } = instrument(
    "Blocks._customBlock_Top = function () { return Math.max(Blocks._customBlock_Calc(), 1) * s.B; };",
  );
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      {
        b: "Top",
        v: 10,
        c: [2],
        r: [["B", 2]],
        rx: [["B", 2, 2]],
        x: [
          [2, 5],
          [1, 5],
          [3, 2],
          [0, 10],
        ],
      },
      // its read with another value: a call whose one row has its value would be that row (pieces.cjs structurePass)
      { b: "Calc", v: 5, r: [["X", 4]] },
    ],
    [],
    { root: 0 },
  );
  const build = buildTree(rec, 0, ops);
  const calc = kidsOf(build.root).find((k) => k.code === "Calc()");
  expect(build.expand(calc?.id ?? "")?.formula).toEqual([
    ["max", "(", "Calc()", ",", "1", ")"],
    [5, 1, 5],
  ]);
});
