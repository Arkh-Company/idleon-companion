// The rows of a block with no formula of its own (spec 008, T017; pieces.cjs explainRaw and tidy, FR-014, FR-015a):
// a call that passes one value on is skipped down, the curve block is a branch of its constants, the parts at ×1 and
// the parts at 0 of a sum go into closed groups, and a Condition that is "no" stays in the list. Hand-written
// recordings with invented blocks and paths.
import { expect, test } from "vitest";
import type { CalcTreeNode } from "../tree-contract.ts";
import { buildTree } from "../tree-build.ts";
import { row, withShares } from "./rows.ts";
import { recordingOf } from "./tree-fixture.ts";

const kidsOf = (n: CalcTreeNode | null | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];
/** The root's first level of a block `Total` with these calls under it. */
function rootOf(
  calls: Parameters<typeof recordingOf>[0],
  total: Partial<Parameters<typeof recordingOf>[0][number]> = {},
) {
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Total", v: 0, c: calls.map((_, i) => i + 2), ...total },
      ...calls,
    ],
    [],
    { root: 0 },
  );
  return buildTree(rec, 0);
}

test("a call that only passes one value on opens into what it passes", () => {
  const rec = recordingOf(
    [
      { b: "(root)", c: [1] },
      { b: "Total", v: 5, c: [2] },
      { b: "Pass", v: 5, c: [3] },
      { b: "Inner", v: 5, r: [["Level", 5]] },
    ],
    [],
    { root: 0 },
  );
  const build = buildTree(rec, 0);
  const [pass] = kidsOf(build.root);
  expect(pass?.code).toBe("Pass()");
  expect(kidsOf(build.expand(pass?.id ?? "")).map((k) => k.code)).toEqual([
    "Level",
  ]);
});

test("the curve block is a branch of its constants by role and its input, with its formula", () => {
  const build = rootOf(
    [{ b: "ArbitraryCode5Inputs", a: ["decay", 40, 100, 25, 0], v: 8 }],
    { v: 8, r: [["Invented.level", 25]] },
  );
  const [curve] = kidsOf(build.root);
  expect(curve).toMatchObject({
    name: "Curve: 40 × 25 ÷ (25 + 100)",
    code: 'ArbitraryCode5Inputs("decay", 40, 100, 25, 0)',
    value: 8,
    formula: [
      [
        "40",
        "×",
        "Invented.level",
        "÷",
        "(",
        "Invented.level",
        "+",
        "100",
        ")",
      ],
      [40, 25, 25, 100, 8],
    ],
    maxReached: { share: 0.2, max: 40 },
    flags: {},
  });
  expect(kidsOf(curve).map((k) => [k.name, k.value, k.leaf, k.code])).toEqual([
    ["Max bonus of the curve", 40, "fixedValue", null],
    ["Level at half of the max", 100, "fixedValue", null],
    ["Game value", 25, "level", "Invented.level"],
  ]);
});

test("a curve's input read with no name weighs in the curve by its path, the term of its formula", () => {
  const [curve] = kidsOf(
    rootOf(
      [{ b: "ArbitraryCode5Inputs", a: ["decay", 40, 100, 25, 0], v: 8 }],
      { v: 8, r: [["Invented.level", 25]] },
    ).root,
  );
  expect(kidsOf(curve).map((k) => [k.share, k.shareMode])).toEqual([
    [0, "mixed"],
    [0, "mixed"],
    [1, "mixed"],
  ]);
});

test("a curve whose input no read holds uses the level it was given; a curve with no maximum has none", () => {
  const [curve] = kidsOf(
    rootOf([{ b: "ArbitraryCode5Inputs", a: ["add", 3, 0, 7], v: 21 }], {
      v: 21,
    }).root,
  );
  expect(curve?.maxReached).toBeUndefined();
  expect(curve?.formula?.[0]).toEqual(["3", "×", "Level the curve uses"]);
  expect(kidsOf(curve).map((k) => [k.name, k.leaf])).toEqual([
    ["Per-level bonus of the curve", "fixedValue"],
    ["Level the curve uses", "level"],
  ]);
});

test("in a product, two or more parts at ×1 go under one closed row at the end", () => {
  const build = rootOf(
    [
      { b: "One", a: [1], v: 1, x: [[0, 1]] },
      { b: "Big", v: 6, x: [[0, 6]] },
      { b: "One", a: [2], v: 1, x: [[0, 1]] },
    ],
    { v: 6 },
  );
  const kids = kidsOf(build.root);
  expect(kids.map((k) => [k.name, k.role, k.value])).toEqual([
    ["Game value", "piece", 6],
    ["At ×1 (2)", "atOne", 1],
  ]);
  expect(kids[1]).toMatchObject({ fmt: "x", flags: { closed: true } });
  expect(kidsOf(kids[1]).map((k) => [k.id, k.code])).toEqual([
    ["root/At ×1 (2)/Game value", "One(1)"],
    ["root/At ×1 (2)/Game value#2", "One(2)"],
  ]);
});

test("in a sum, parts at 1 each add 1 and stay in the list", () => {
  const kids = kidsOf(
    rootOf(
      [
        { b: "One", a: [1], v: 1, x: [[0, 1]] },
        { b: "Big", v: 6, x: [[0, 6]] },
        { b: "One", a: [2], v: 1, x: [[0, 1]] },
      ],
      { v: 8 },
    ).root,
  );
  expect(kids.map((k) => [k.code, k.role, k.shareMode])).toEqual([
    ["One(1)", "piece", "sum"],
    ["Big()", "piece", "sum"],
    ["One(2)", "piece", "sum"],
  ]);
});

test("one part at ×1 stays in the list", () => {
  const kids = kidsOf(
    rootOf(
      [
        { b: "One", v: 1, x: [[0, 1]] },
        { b: "Big", v: 6, x: [[0, 6]] },
      ],
      { v: 6 },
    ).root,
  );
  expect(kids.map((k) => k.role)).toEqual(["piece", "piece"]);
});

test("in a sum, the parts at 0 go under one closed row at the end; a Condition that is no stays", () => {
  const build = rootOf(
    [
      { b: "Some", v: 4, x: [[0, 4]] },
      { b: "Nothing", v: 0, x: [[0, 0]] },
      { b: "More", v: 3, x: [[0, 3]] },
    ],
    { v: 7, r: [["Invented thing unlocked", 0]] },
  );
  const kids = kidsOf(build.root);
  expect(kids.map((k) => [k.code ?? k.name, k.role, k.leaf])).toEqual([
    ["Some()", "piece", "rawBonus"],
    ["More()", "piece", "rawBonus"],
    ["Invented thing unlocked", "piece", "condition"],
    ["At 0 (1)", "atZero", null],
  ]);
  expect(kids[3]).toMatchObject({ value: 0, flags: { closed: true } });
  expect(kidsOf(kids[3]).map((k) => k.code)).toEqual(["Nothing()"]);
});

test("outside a sum, a part at 0 stays in the list", () => {
  const kids = kidsOf(
    rootOf(
      [
        { b: "Zero", v: 0, x: [[0, 0]] },
        { b: "Big", v: 6, x: [[0, 6]] },
      ],
      { v: 0 },
    ).root,
  );
  expect(kids.map((k) => [k.role, k.shareMode])).toEqual([
    ["piece", "productZero"],
    ["piece", "productZero"],
  ]);
});

test("a level under a min keeps the mark of the side that does not count now", () => {
  const rows = [10, 5].map((v, i) => ({
    node: row({ pieceKey: null, value: v, code: null, name: `K${String(i)}` }),
    open: null,
  }));
  const shared = withShares(
    { name: "Total", value: 5 },
    ["min(K0, K1)", "min(10, 5) = 5"],
    rows,
  );
  expect(shared.mode).toBe("cap");
  expect(shared.rows.map((r) => r.node.cap)).toEqual(["overTheCap", undefined]);
});
