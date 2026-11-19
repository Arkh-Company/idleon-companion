// The values by piece of a tree (spec 008 FR-025): what a mark saves and what the arrows of "Changes" take as their base
// (spec 009 FR-013). Every walk is flat: a tree can be as deep as it has nodes. Every value and name is invented.
import { expect, test } from "vitest";
import { oldBoxKeys, pieceValues } from "./formula-tree-compare.ts";
import type { TreeNode } from "./formula-tree.ts";

const node = (over: Partial<TreeNode> = {}): TreeNode => ({
  id: "root",
  pieceKey: '[0,"Total"]',
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

const part = (
  name: string,
  value: number | boolean | null,
  kids: TreeNode[] = [],
) =>
  node({
    id: `root/${name}`,
    pieceKey: `[0,"${name}"]`,
    name,
    value,
    role: "piece",
    kids,
  });

const tree = (total: number, parts: TreeNode[]) =>
  node({ value: total, kids: parts });

test("a mark is only values by piece (FR-025)", () => {
  const values = pieceValues(tree(10, [part("Sword", 4)]));
  expect(values).toEqual({ '[0,"Total"]': 10, '[0,"Sword"]': 4 });
});

test("pieceValues keeps neither a row with no piece nor one unavailable", () => {
  const values = pieceValues(
    tree(10, [
      part("Leaf", 1),
      part("Gone", null),
      node({ id: "g", pieceKey: null, value: 3 }),
    ]),
  );
  expect(values).toEqual({ '[0,"Total"]': 10, '[0,"Leaf"]': 1 });
});

test("the values of a tree as deep as it has nodes are read without recursion", () => {
  let deep = part("Leaf", 2);
  for (let i = 0; i < 50_000; i++)
    deep = node({
      id: `d${String(i)}`,
      pieceKey: null,
      value: 1,
      kids: [deep],
    });
  expect(pieceValues(tree(10, [deep]))).toEqual({
    '[0,"Total"]': 10,
    '[0,"Leaf"]': 2,
  });
});

test.each<[string, number, string[], string[], [string, string][]]>([
  [
    "with the character first, as a mark keeps it",
    1,
    ['[0,"DNSM.Box"]'],
    ['[0,"DNSM.Box","Writer(1)",2]'],
    [['[0,"DNSM.Box"]', '[0,"DNSM.Box","Writer(1)",2]']],
  ],
  [
    "without the character, as the radar's shapes keep it",
    0,
    ['["DNSM.Box"]', '["DummyNumbersStatManager.Total"]'],
    [
      '["DNSM.Box","Writer(1)",2]',
      '["DummyNumbersStatManager.Total","Stamp(\\"X\\")",1]',
    ],
    [
      ['["DNSM.Box"]', '["DNSM.Box","Writer(1)",2]'],
      [
        '["DummyNumbersStatManager.Total"]',
        '["DummyNumbersStatManager.Total","Stamp(\\"X\\")",1]',
      ],
    ],
  ],
  [
    "a call of the same block, with 1 and with 3 arguments: no scratch box",
    0,
    ['["Holes","MonumentROGbonuses"]', '["Holes"]'],
    ['["Holes","MonumentROGbonuses",2,6]', '["Holes","Bravery",0]'],
    [],
  ],
  [
    "two pieces of the box now, or the old key still there: none",
    0,
    ['["DNSM.Twin"]', '["DNSM.Same"]'],
    [
      '["DNSM.Twin","W(1)",0]',
      '["DNSM.Twin","W(1)",1]',
      '["DNSM.Same"]',
      '["DNSM.Same","W(1)",0]',
    ],
    [],
  ],
])(
  "an old key of a scratch box (0.8.0) stands for the one piece of its box now: %s",
  (_case, at, old, now, pairs) => {
    expect([...oldBoxKeys(old, now, at)]).toEqual(pairs);
  },
);
