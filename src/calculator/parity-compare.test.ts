// The comparison `just parity` runs against the bench (spec 008 T027, SC-002), on invented trees: each row by its place,
// in value, type, ⓘ and "?", the names outside the reviewed list, and the code × value check. Every name and number
// here is invented.
import { expect, test } from "vitest";
import type { BenchRow } from "./parity-compare.ts";
import {
  activeCharacter,
  codeValueConflicts,
  compareTrees,
  mosaicOfSnapshot,
  summary,
} from "./parity-compare.ts";
import type { CalcTreeNode } from "./tree-contract.ts";

const app = (over: Partial<CalcTreeNode> = {}): CalcTreeNode => ({
  id: "root",
  pieceKey: null,
  name: "Total",
  value: 10,
  fmt: null,
  leaf: null,
  condition: null,
  why: null,
  formula: null,
  code: null,
  role: "root",
  share: null,
  shareMode: null,
  flags: {},
  kids: [],
  ...over,
});

const APP = app({
  formula: [
    ["Alpha", "×", "Beta"],
    [2, 5, 10],
  ],
  kids: [
    app({ id: "root/Alpha", name: "Alpha", value: 2, leaf: "level" }),
    app({
      id: "root/Beta",
      name: "Beta",
      value: 5,
      leaf: "condition",
      condition: "owned",
    }),
  ],
});
const BENCH: BenchRow = {
  name: "Invented total",
  v: { $n: "10" },
  formula: ["Alpha × Beta", "2 × 5 = 10"],
  kids: [
    { name: "Alpha", v: 2, kind: "Level", kids: [] },
    { name: "Beta", v: 5, kind: "Condição", sub: "possui" },
  ],
};
const NO_FORMULA: BenchRow = Object.fromEntries(
  Object.entries(BENCH).filter(([k]) => k !== "formula"),
);

test("the same tree has no difference, the root's name aside", () => {
  expect(compareTrees(APP, BENCH, new Set())).toEqual([]);
});

test.each<[string, BenchRow, string]>([
  [
    "a value",
    {
      ...BENCH,
      kids: [{ name: "Alpha", v: 3, kind: "Level" }, BENCH.kids?.[1] ?? {}],
    },
    "value",
  ],
  [
    "a type",
    {
      ...BENCH,
      kids: [
        { name: "Alpha", v: 2, kind: "Quantidade" },
        BENCH.kids?.[1] ?? {},
      ],
    },
    "type",
  ],
  [
    "a subtype",
    {
      ...BENCH,
      kids: [
        BENCH.kids?.[0] ?? {},
        { name: "Beta", v: 5, kind: "Condição", sub: "limite" },
      ],
    },
    "type",
  ],
  [
    "a ?",
    {
      ...BENCH,
      kids: [{ name: "Alpha", v: 2, kind: "?" }, BENCH.kids?.[1] ?? {}],
    },
    "unknown",
  ],
  [
    "a ⓘ number",
    { ...BENCH, formula: ["Alpha × Beta", "2 × 5 = 11"] },
    "formula",
  ],
  ["a missing ⓘ", NO_FORMULA, "formula"],
  [
    "a name",
    {
      ...BENCH,
      kids: [{ name: "Gamma", v: 2, kind: "Level" }, BENCH.kids?.[1] ?? {}],
    },
    "name",
  ],
  [
    "the rows under a node",
    { ...BENCH, kids: [BENCH.kids?.[0] ?? {}] },
    "shape",
  ],
])(
  "%s that differs is one difference, with its place",
  (_name, bench, field) => {
    const found = compareTrees(APP, bench, new Set());
    expect(found.map((d) => d.field)).toEqual([field]);
    expect(found[0]?.at).toMatch(/^0(\/\d+)*$/);
  },
);

test("a name on the reviewed list is not compared", () => {
  const bench = {
    ...BENCH,
    kids: [{ name: "Gamma", v: 2, kind: "Level" }, BENCH.kids?.[1] ?? {}],
  };
  expect(compareTrees(APP, bench, new Set(["Invented total › Gamma"]))).toEqual(
    [],
  );
});

test("a bench tree with compaction is refused: the parity needs every row", () => {
  const bench = {
    ...BENCH,
    kids: [
      { name: "Alpha", v: 2, kind: "shown earlier", ref: "x" },
      BENCH.kids?.[1] ?? {},
    ],
  };
  expect(() => compareTrees(APP, bench, new Set())).toThrow("compaction");
});

test("the code × value check finds a piece that shows two values", () => {
  const kid = (v: number) =>
    app({ id: `root/K${String(v)}`, pieceKey: '[0,"Block",1]', value: v });
  expect(codeValueConflicts(app({ kids: [kid(1), kid(1)] }))).toEqual([]);
  expect(codeValueConflicts(app({ kids: [kid(1), kid(2)] }))).toEqual([
    '[0,"Block",1]',
  ]);
});

test("the snapshot becomes the app's mosaic, with the _vars beside it", () => {
  const snap = { attrs: { A: 1 }, skipped: ["B"] };
  expect(JSON.parse(mosaicOfSnapshot(snap, { V: 2 }))).toEqual({
    attrs: { A: 1 },
    vars: { V: 2 },
    skipped: ["B"],
  });
});

test("the active character is its place in the game's list, 0 when it cannot be read", () => {
  expect(
    activeCharacter({
      attrs: { UserInfo: ["Wrenna"], GetPlayersUsernames: ["Wren", "Wrenna"] },
    }),
  ).toBe(1);
  expect(activeCharacter({ attrs: {} })).toBe(0);
});

test("the summary says each difference by its field and its place, never by a name of the bench (FR-010a, FR-032)", () => {
  // A character's name can be a row's name in the bench's tree: the summary goes to registro.md.
  const bench: BenchRow = {
    ...BENCH,
    kids: [{ name: "Wrenna", v: 3, kind: "Level" }, BENCH.kids?.[1] ?? {}],
  };
  const text = summary(compareTrees(APP, bench, new Set()));
  expect(text).not.toContain("Wrenna");
  expect(text).not.toContain("Invented total");
  expect(text).toContain("value: 0/0");
  expect(text).toContain('{"value":1,"name":1}');
});
