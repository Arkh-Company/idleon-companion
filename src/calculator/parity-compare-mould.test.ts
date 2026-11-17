// The parity of `just parity` against the bench with the spec 009 mould (FR-005, FR-016), on invented trees: the app's
// first level is its pools and system groups, and no level groups its parts at 0 or ×1, while the bench's (008) still
// does. Every name and number here is invented. The 008 cases are in parity-compare.test.ts.
import { expect, test } from "vitest";
import type { BenchRow } from "./parity-compare.ts";
import { compareTrees } from "./parity-compare.ts";
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

// Forge stats 2: (5 × x + 30 × y + 100) × (1 + m ÷ 100). The app's Additive pool holds the step's terms built again,
// the bench's factor is one branch of the expression's parts: they pair by value, and their leaves by value too.
const leafOf = (id: string, name: string, value: number): CalcTreeNode =>
  app({ id, name, value, leaf: "fixedValue" });
const FORGE = app({
  value: 12160,
  kids: [
    app({
      id: "root/Additive pool",
      name: "Additive pool",
      value: 760,
      role: "pool",
      combine: "sum",
      poolKind: "additive",
      kids: [
        app({
          id: "root/Additive pool/x",
          name: "Sum part x",
          value: 480,
          kids: [leafOf("a1", "× 5", 5), leafOf("a2", "X", 96)],
        }),
        app({
          id: "root/Additive pool/y",
          name: "Sum part y",
          value: 180,
          kids: [leafOf("b1", "× 30", 30), leafOf("b2", "Y", 6)],
        }),
        leafOf("root/Additive pool/c", "Fixed +100", 100),
      ],
    }),
    pool("Multi pool", [
      app({
        id: "root/Multi pool/M",
        name: "Multiplier",
        value: 16,
        kids: [leafOf("m1", "M", 1500)],
      }),
    ]),
  ],
});
const FORGE_BENCH: BenchRow = {
  name: "Forge stats 2",
  v: 12160,
  kids: [
    {
      name: "Sum of 2 sources",
      v: 760,
      kids: [
        { name: "× 5", v: 5, kind: "Valor fixo" },
        { name: "X", v: 96, kind: "Valor fixo" },
        { name: "× 30", v: 30, kind: "Valor fixo" },
        { name: "Y", v: 6, kind: "Valor fixo" },
        { name: "Base 100", v: 100, kind: "Valor fixo" },
      ],
    },
    {
      name: "Multiplier",
      v: 16,
      kids: [{ name: "M", v: 1500, kind: "Valor fixo" }],
    },
  ],
};

test("an Additive pool inside a product pairs with the bench's factor by value, and its leaves by value", () => {
  expect(compareTrees(FORGE, FORGE_BENCH, new Set())).toEqual([]);
  // a leaf of another value is a difference of shape at the factor
  const [sum, multi] = FORGE_BENCH.kids ?? [];
  const off: BenchRow = {
    ...FORGE_BENCH,
    kids: [
      {
        ...sum,
        kids: [...(sum?.kids ?? []).slice(0, 4), { name: "Base 99", v: 99 }],
      },
      multi ?? {},
    ],
  };
  expect(compareTrees(FORGE, off, new Set())).toEqual([
    { at: "0/0", field: "shape" },
  ]);
});

test("below the root, a level with the bench's group at 0 still checks the order of its other parts", () => {
  const part = (id: string, name: string, value: number): CalcTreeNode =>
    app({ id, name, value, leaf: "level" });
  const tree = app({
    kids: [
      pool("Multi pool", [
        app({
          ...ALPHA,
          kids: [
            part("a/Other", "Other", 3),
            part("a/Zed", "Zed", 0),
            part("a/Kept", "Kept", 2),
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
          { name: "Other", v: 3, kind: "Level" },
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
  expect(compareTrees(tree, bench, new Set())).toEqual([
    { at: "0/0", field: "shape" },
  ]);
});

// (1 + (a + b) ÷ 100) × m: the app's Additive pool of 1 + percent holds only the bonuses' terms; the bench's factor is
// the branch of the whole expression, with its constants 1 and 100 among its leaves (tree/shapes.test.ts).
const PCT = app({
  value: 3.6,
  kids: [
    app({
      id: "root/Additive pool",
      name: "Additive pool",
      value: 1.8,
      role: "pool",
      combine: "onePlusPercent",
      poolKind: "additive",
      kids: [leafOf("pa", "A", 30), leafOf("pb", "B", 50)],
    }),
    pool("Multi pool", [leafOf("root/Multi pool/M", "M", 2)]),
  ],
});
const pctBench = (b: number): BenchRow => ({
  name: "Invented speed",
  v: 3.6,
  kids: [
    {
      name: "Multiplier from 2 sources",
      v: 1.8,
      kids: [
        { name: "Base 1", v: 1, kind: "Valor fixo" },
        { name: "A", v: 30, kind: "Valor fixo" },
        { name: "B", v: b, kind: "Valor fixo" },
        { name: "Percent to number (÷ 100)", v: 100, kind: "Valor fixo" },
      ],
    },
    { name: "M", v: 2, kind: "Valor fixo" },
  ],
});

test("an Additive pool of 1 + percent pairs with the bench's factor, its 1 and its 100 being the bench's constants", () => {
  expect(compareTrees(PCT, pctBench(50), new Set())).toEqual([]);
  // a bonus of another value is a difference of shape at the factor
  expect(compareTrees(PCT, pctBench(49), new Set())).toEqual([
    { at: "0/0", field: "shape" },
  ]);
});

// The leaves of an Additive pool pair by name too: a bonus of another name is one difference of name at the pool, the
// reviewed names not counting inside it. Its constants (the app's "Fixed +N", the bench's "Base N" and the 1 and 100
// of 1 + percent) pair by value only.
test("a bonus of the Additive pool with another name, of the same value, is a difference of name at the pool", () => {
  const [sum, multi] = FORGE_BENCH.kids ?? [];
  const renamed: BenchRow = {
    ...FORGE_BENCH,
    kids: [
      {
        ...sum,
        kids: (sum?.kids ?? []).map((k) =>
          k.name === "X" ? { ...k, name: "Not X" } : k,
        ),
      },
      multi ?? {},
    ],
  };
  const expected = [{ at: "0/0", field: "name" }];
  expect(compareTrees(FORGE, renamed, new Set())).toEqual(expected);
  const reviewed = new Set(["Forge stats 2 › Sum of 2 sources › Not X"]);
  expect(compareTrees(FORGE, renamed, reviewed)).toEqual(expected);
});

test.each([1, 100])(
  "a bonus of %d in an Additive pool of 1 + percent pairs with its own leaf, not with a constant",
  (b) => {
    const pct = app({
      ...PCT,
      value: (1 + (30 + b) / 100) * 2,
      kids: [
        app({
          ...(Array.isArray(PCT.kids) ? PCT.kids[0] : undefined),
          value: 1 + (30 + b) / 100,
          kids: [leafOf("pa", "A", 30), leafOf("pb", "B", b)],
        }),
        pool("Multi pool", [leafOf("root/Multi pool/M", "M", 2)]),
      ],
    });
    const bench = pctBench(b);
    const [factor, m] = bench.kids ?? [];
    const fixed: BenchRow = {
      ...bench,
      v: (1 + (30 + b) / 100) * 2,
      kids: [{ ...factor, v: 1 + (30 + b) / 100 }, m ?? {}],
    };
    expect(compareTrees(pct, fixed, new Set())).toEqual([]);
  },
);
