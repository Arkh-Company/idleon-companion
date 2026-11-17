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

test("a rule's ⓘ is compared by the numbers of its line of numbers", () => {
  const rule = app({ ...APP, formula: { rule: ["If Alpha: 10", "yes → 10"] } });
  const bench = (n: number): BenchRow => ({
    ...BENCH,
    formula: [`If Alpha: ${String(n)}`, `yes → ${String(n)}`],
  });
  expect(compareTrees(rule, bench(10), new Set())).toEqual([]);
  expect(compareTrees(rule, bench(11), new Set())).toEqual([
    { at: "0", field: "formula" },
  ]);
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

// spec 009: the app's first level is its pools and system groups; the bench's (008, with no mould) is the steps, with
// their groups at 0 and at ×1. The parity goes through both and pairs each bench row with the app's of its name and
// value, then compares row by row under it; the root's ⓘ is the pools' (FR-005), not compared.
const pool = (name: string, kids: CalcTreeNode[]): CalcTreeNode =>
  app({
    id: `root/${name}`,
    name,
    role: "pool",
    combine: "product",
    poolKind: "multi",
    kids,
  });
const group = (name: string, kids: CalcTreeNode[]): CalcTreeNode =>
  app({
    id: `root/x/${name}`,
    name,
    role: "system",
    combine: "sum",
    poolKind: null,
    kids,
  });
const [ALPHA = app(), BETA = app()] = Array.isArray(APP.kids) ? APP.kids : [];

test("through the pools and groups, the first level pairs by name and value, in any order", () => {
  const moulded = app({
    formula: [
      ["Multi pool 1", "×", "Multi pool 2"],
      [2, 5, 10],
    ],
    kids: [pool("Multi pool 1", [group("🃏 Cards", [BETA, ALPHA])])],
  });
  expect(compareTrees(moulded, BENCH, new Set())).toEqual([]);
});

test("the bench's groups at 0 and at ×1 of the first level go through as the app's pools do", () => {
  const zero = (name: string): CalcTreeNode =>
    app({ id: `root/${name}`, name, value: 0, leaf: "level" });
  const bench: BenchRow = {
    ...NO_FORMULA,
    v: 0,
    kids: [
      {
        name: "At 0 (2)",
        v: 0,
        kids: [
          { name: "Gamma", v: 0, kind: "Level" },
          { name: "Delta", v: 0, kind: "Level" },
        ],
      },
    ],
  };
  const moulded = app({
    value: 0,
    kids: [
      pool("Additive pool", [
        zero("Delta"),
        group("🃏 Cards", [zero("Gamma")]),
      ]),
    ],
  });
  expect(compareTrees(moulded, bench, new Set())).toEqual([]);
});

test("a bench row of the first level with no app row of its name and value is a difference of shape", () => {
  const moulded = app({ kids: [pool("Multi pool", [ALPHA])] });
  expect(compareTrees(moulded, NO_FORMULA, new Set())).toEqual([
    { at: "0/1", field: "shape" },
  ]);
});

test("below the root, the bench's groups at 0 and at ×1 go through too, and the app's parts pair in their places (FR-016)", () => {
  const part = (id: string, name: string, value: number): CalcTreeNode =>
    app({ id, name, value, leaf: "level" });
  const tree = app({
    kids: [
      pool("Multi pool", [
        app({
          ...ALPHA,
          kids: [
            part("root/Alpha/Zed", "Zed", 0),
            part("root/Alpha/Kept", "Kept", 2),
          ],
        }),
        BETA,
      ]),
    ],
  });
  const bench: BenchRow = {
    ...NO_FORMULA,
    kids: [
      {
        name: "Alpha",
        v: 2,
        kind: "Level",
        kids: [
          { name: "Kept", v: 2, kind: "Level" },
          {
            name: "At 0 (1)",
            v: 0,
            kids: [{ name: "Zed", v: 0, kind: "Level" }],
          },
        ],
      },
      { name: "Beta", v: 5, kind: "Condição", sub: "possui" },
    ],
  };
  expect(compareTrees(tree, bench, new Set())).toEqual([]);
});
