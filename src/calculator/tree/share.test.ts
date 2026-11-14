// The weight of each row in its parent, by the parent's shape (spec 008, T017; the bench's Share S, share.cjs, accepted
// as the app's spec on 12/11): sum, product, product with 0, min/max cap, mixed, condition and unknown.
import { expect, test } from "vitest";
import type { CalcTreeNode } from "../tree-contract.ts";
import { kidShares, shares } from "./share.ts";
import type { ShareNode } from "./share.ts";

const LETTERS = "abcdefgh";
/** A parent with kids Ka, Kb… of `values`, and its formula written with their names and their numbers. */
function parent(
  values: number[],
  v: number,
  formula: string | null = null,
): ShareNode {
  const kids = values.map((x, i) => ({
    name: `K${LETTERS.charAt(i)}`,
    v: x,
    formula: null,
    kids: null,
  }));
  const numbers =
    formula === null
      ? null
      : `${values.reduce((s, x, i) => s.split(`K${LETTERS.charAt(i)}`).join(String(x)), formula)} = ${String(v)}`;
  return {
    name: "Parent",
    v,
    formula: formula === null || numbers === null ? null : [formula, numbers],
    kids,
  };
}
const rounded = (s: (number | null)[]) =>
  s.map((x) => (x === null ? null : +x.toFixed(4)));

test("a sum: each part over the total", () => {
  const s = shares(parent([3, 1], 4));
  expect([s.mode, rounded(s.shares)]).toEqual(["sum", [0.75, 0.25]]);
});

test("a sum with a negative part: the parts' sizes", () => {
  const s = shares(parent([5, -1], 4));
  expect([s.mode, rounded(s.shares)]).toEqual(["sum", [0.8333, 0.1667]]);
});

test("a product: each factor's log", () => {
  const s = shares(parent([4, 2], 8));
  expect([s.mode, rounded(s.shares)]).toEqual(["product", [0.6667, 0.3333]]);
});

test("a product with a 0: the 0 takes it all", () => {
  const s = shares(parent([0, 7], 0));
  expect([s.mode, rounded(s.shares)]).toEqual(["productZero", [1, 0]]);
});

test("a min cap: the side that does not win weighs nothing and is marked", () => {
  const s = shares(parent([10, 5], 5, "min(Ka, Kb)"));
  expect([s.mode, rounded(s.shares), s.binding]).toEqual([
    "cap",
    [0, 1],
    [false, true],
  ]);
});

test("a cap whose winning side cannot be taken out takes all the weight", () => {
  const s = shares(parent([2, 10], 1, "min(Ka, Kb) − 1"));
  expect([s.mode, rounded(s.shares), s.binding]).toEqual([
    "capZero",
    [1, 0],
    [true, false],
  ]);
});

test("a mixed formula: the log effect of removing each part", () => {
  const s = shares(parent([3, 1, 2], 8, "(Ka + Kb) × Kc"));
  expect([s.mode, rounded(s.shares)]).toEqual([
    "mixed",
    [0.5856, 0.1215, 0.2928],
  ]);
});

test("a product that closes over a subset: the others feed a sibling and weigh nothing here", () => {
  const s = shares(parent([4, 2, 3], 8));
  expect([s.mode, rounded(s.shares)]).toEqual([
    "product",
    [0.6667, 0.3333, null],
  ]);
});

test.each<[string, ShareNode, string]>([
  ["a formula that is a check", parent([1, 5], 5, "If Ka: Kb"), "condition"],
  ["kids that close nothing", parent([3, 1], 10), "unknown"],
  ["a parent without a number", { ...parent([3, 1], 4), v: null }, "unknown"],
])("%s has no share", (_name, n, mode) => {
  const s = shares(n);
  expect([s.mode, s.shares]).toEqual([mode, [null, null]]);
});

const row = (
  name: string,
  value: number | boolean | null,
  leaf: CalcTreeNode["leaf"] = null,
): CalcTreeNode => ({
  id: `root/${name}`,
  pieceKey: null,
  name,
  value,
  fmt: null,
  leaf,
  condition: null,
  why: null,
  formula: null,
  code: null,
  role: "piece",
  share: null,
  shareMode: null,
  flags: {},
  kids: [],
});

test("each kid gets its share and the parent's mode; a yes/no counts as 1 or 0", () => {
  const kids = kidShares(row("Total", 12), null, [
    row("Ka", 3),
    row("Kb", 4),
    row("Kc", true),
  ]);
  expect(kids.map((k) => [k.share?.toFixed(4), k.shareMode])).toEqual([
    ["0.4421", "product"],
    ["0.5579", "product"],
    ["0.0000", "product"],
  ]);
});

test.each<[string, number, number, CalcTreeNode["leaf"], string]>([
  ["the value over a fixed cap", 50, 10, "fixedValue", "overTheCap"],
  ["the cap a value did not reach", 5, 10, "fixedValue", "notReached"],
])("in a min, %s is marked", (_name, a, cap, leaf, mark) => {
  const kids = kidShares(
    row("Total", Math.min(a, cap)),
    [
      "min(Ka, Cap)",
      `min(${String(a)}, ${String(cap)}) = ${String(Math.min(a, cap))}`,
    ],
    [row("Ka", a), row("Cap", cap, leaf)],
  );
  const loser = kids.find((k) => k.share === 0);
  expect([loser?.cap, loser?.shareMode]).toEqual([mark, "cap"]);
  expect(kids.filter((k) => k.cap !== undefined)).toHaveLength(1);
});

test("outside a cap, a kid that does not move the parent is not marked", () => {
  const kids = kidShares(
    row("Total", 4),
    ["Ka × Kb ÷ 2", "4 × 2 ÷ 2 = 4"],
    [row("Ka", 4), row("Kb", 2)],
  );
  expect(kids.map((k) => [k.shareMode, k.cap])).toEqual([
    ["product", undefined],
    ["product", undefined],
  ]);
});
