// A list of calls of one block as a model child (spec 010, T205; data-model "Lista de chamadas"): `each: { calls, as }`
// repeats the model once per recorded call of the block in the level, `{as}` in the argument the loop's turn gives; each
// call is tied by its own place, never by value or order; two calls the place does not separate are refused. The
// invented game's TreeRibbons sums TreeRibbon(i + 1, 0) over eight turns (a long list, as T202's); TreeRibbonsTwin calls TreeRibbon(3, 0)
// in both of its turns.
import { expect, test } from "vitest";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { parseBlueprint } from "./blueprint.ts";
import { draftBlueprint } from "./draft.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";

const leaf = (key: string, read: string): BlueprintNode => ({
  key,
  name: key,
  ref: { read },
  leaf: "level",
});
const ribbons = (root: string): BlueprintNode => ({
  key: "ribbons",
  name: "Ribbons",
  ref: { call: root, args: [0, 0, 0] },
  each: { calls: "TreeRibbon", as: "lv" },
  children: [
    {
      key: "ribbon",
      name: "Ribbon",
      ref: { call: "TreeRibbon", args: ["{lv}", 0] },
      leaf: "level",
    },
  ],
});
const lock = (root: string, bp: Blueprint) =>
  lockBlueprint({
    ...recorded(root),
    blueprint: bp,
    character: 0,
    characterClass: 3,
  }).errors.map(lockMessage);

/** A pool whose one source is a call with the list below it. */
const nested = (root: string): Blueprint => ({
  id: "invented-calls",
  root: { name: "Invented", ref: { call: "TreeCallsPool", args: [0, 0, 0] } },
  pools: [
    {
      kind: "additive",
      groups: [
        {
          system: "cards",
          sources: [{ ...ribbons(root), ref: { call: root, args: [] } }],
        },
        { system: "stamps", sources: [leaf("capped", "TreeBase")] },
      ],
    },
  ],
});

test("the lock repeats the model once per recorded call of the block, each tied by its own call", () => {
  expect(lock("TreeCallsPool", nested("TreeRibbons"))).toEqual([]);
});

test("two calls of the block the place does not separate are refused with the reason", () => {
  expect(
    lock("TreeCallsTwinPool", {
      ...nested("TreeRibbonsTwin"),
      root: {
        name: "Invented",
        ref: { call: "TreeCallsTwinPool", args: [0, 0, 0] },
      },
    }),
  ).toContain(
    "invented-calls/0/cards/ribbons: duas voltas do laço de TreeRibbonsTwin() têm o mesmo item (TreeRibbon(3,0))",
  );
});

test("the load takes each.calls only below a node, its model a call of that block with {as} in an argument", () => {
  const parse = (bp: Blueprint) =>
    parseBlueprint(bp, {
      fileId: "invented-calls",
      systemIds: new Set(["cards", "stamps"]),
    });
  expect(parse(nested("TreeRibbons"))).toMatchObject({ ok: true });
  const other = nested("TreeRibbons");
  const src = other.pools[0]?.groups[0]?.sources[0];
  if (!src?.children?.[0]) throw new Error("no model");
  const wrong = {
    ...other,
    pools: [
      {
        ...other.pools[0],
        groups: [
          {
            system: "cards",
            sources: [
              {
                ...src,
                children: [
                  {
                    ...src.children[0],
                    ref: { call: "TreeArg", args: ["{lv}"] },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  } as Blueprint;
  expect(parse(wrong)).toMatchObject({ ok: false });
});

test("the draft writes the calls of one block that differ in one argument as each.calls with its model", () => {
  const { rec, key, ops } = recorded("TreeCallsPool");
  const d = draftBlueprint(
    "invented-calls",
    { name: "I", ref: { call: "TreeCallsPool", args: [0, 0, 0] } },
    key,
    rec,
    ops,
  );
  const source = d.pools[0]?.groups[0]?.sources[0];
  expect(source?.each).toEqual({ calls: "TreeRibbon", as: "item" });
  expect(source?.children?.map((c) => c.ref)).toEqual([
    { call: "TreeRibbon", args: ["{item}", 0] },
  ]);
});

test("a list of calls beside another child of its level: the model is the child that calls the block", () => {
  const plus: Blueprint = {
    id: "invented-calls",
    root: {
      name: "Invented",
      ref: { call: "TreeCallsPlusPool", args: [0, 0, 0] },
    },
    pools: [
      {
        kind: "additive",
        groups: [
          {
            system: "cards",
            sources: [
              {
                ...ribbons("TreeRibbonsPlus"),
                ref: { call: "TreeRibbonsPlus", args: [] },
                children: [
                  ...(ribbons("TreeRibbonsPlus").children ?? []),
                  leaf("base", "TreeBase"),
                ],
              },
            ],
          },
          { system: "stamps", sources: [leaf("capped", "TreeCapped")] },
        ],
      },
    ],
  };
  expect(lock("TreeCallsPlusPool", plus)).toEqual([]);
  expect(
    parseBlueprint(plus, {
      fileId: "invented-calls",
      systemIds: new Set(["cards", "stamps"]),
    }),
  ).toMatchObject({ ok: true });
});

test("the model is the child with {as}: another call of the same block beside it is a child of its own", () => {
  const bp = nested("TreeRibbons");
  const src = bp.pools[0]?.groups[0]?.sources[0];
  if (!src?.children) throw new Error("no source");
  const withSibling = {
    ...bp,
    pools: [
      {
        ...bp.pools[0],
        groups: [
          {
            system: "cards",
            sources: [
              {
                ...src,
                children: [
                  ...src.children,
                  {
                    key: "fixed",
                    name: "Fixed",
                    ref: { call: "TreeRibbon", args: [9, 0] },
                    leaf: "level",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  } as Blueprint;
  expect(
    parseBlueprint(withSibling, {
      fileId: "invented-calls",
      systemIds: new Set(["cards", "stamps"]),
    }),
  ).toMatchObject({ ok: true });
});

test("a pending place below the model covers the same place below each of its calls", () => {
  const source: BlueprintNode = {
    key: "reads",
    name: "Reads",
    ref: { call: "TreeReadRibbons", args: [] },
    each: { calls: "TreeRibbonRead", as: "lv" },
    children: [
      {
        key: "ribbon",
        name: "Ribbon",
        ref: { call: "TreeRibbonRead", args: ["{lv}"] },
        children: [{ key: "base", name: "Base", ref: { read: "TreeBase" } }],
      },
    ],
  };
  const bp: Blueprint = {
    id: "invented-calls",
    root: {
      name: "Invented",
      ref: { call: "TreeReadCallsPool", args: [0, 0, 0] },
    },
    pools: [
      {
        kind: "additive",
        groups: [
          { system: "cards", sources: [source] },
          { system: "stamps", sources: [leaf("level", "TreeLevel")] },
        ],
      },
    ],
    pending: [
      {
        where: "pools/0/groups/0/sources/0/children/0/children/0",
        kind: "leaf",
      },
    ],
  };
  expect(
    lock("TreeReadCallsPool", bp).filter(
      (m) => !m.startsWith("receita com pendência"),
    ),
  ).toEqual([]);
});

/** A pool whose source `root` has the list of calls beside its TreeBase. */
const beside = (pool: string, root: string): Blueprint => ({
  id: "invented-calls",
  root: { name: "Invented", ref: { call: pool, args: [0, 0, 0] } },
  pools: [
    {
      kind: "additive",
      groups: [
        {
          system: "cards",
          sources: [
            {
              ...ribbons(root),
              ref: { call: root, args: [] },
              children: [
                ...(ribbons(root).children ?? []),
                leaf("base", "TreeBase"),
              ],
            },
          ],
        },
        { system: "stamps", sources: [leaf("capped", "TreeCapped")] },
      ],
    },
  ],
});

test("two identical calls in one place are two lines of the list: the same key, value and recorded descent tie alike", () => {
  expect(
    lock("TreeSamePool", beside("TreeSamePool", "TreeRibbonsSame")),
  ).toEqual([]);
  expect(
    lock("TreeTurnsPool", beside("TreeTurnsPool", "TreeRibbonsTurns")).filter(
      (m) => m.includes("duas chamadas"),
    ),
  ).toEqual([]);
});

test("two calls in one place with the same key and value but another recorded descent are refused with the reason", () => {
  const flips: Blueprint = {
    ...beside("TreeFlipPool", "TreeFlipSame"),
  };
  const src = flips.pools[0]?.groups[0]?.sources[0];
  if (!src?.children) throw new Error("no source");
  const model = src.children[0];
  if (!model) throw new Error("no model");
  const flipped = {
    ...flips,
    pools: [
      {
        ...flips.pools[0],
        groups: [
          {
            system: "cards",
            sources: [
              {
                ...src,
                each: { calls: "TreeFlip", as: "lv" },
                children: [
                  { ...model, ref: { call: "TreeFlip", args: ["{lv}", 0] } },
                  ...src.children.slice(1),
                ],
              },
            ],
          },
          ...(flips.pools[0]?.groups.slice(1) ?? []),
        ],
      },
    ],
  } as Blueprint;
  expect(lock("TreeFlipPool", flipped)).toContain(
    "invented-calls/0/cards/ribbons: duas chamadas TreeFlip(3,0) no nível, e o lugar não as separa",
  );
});

test("two identical calls whose reads saw another write's number are the same node by node: the path and the value", () => {
  const source: BlueprintNode = {
    key: "reads",
    name: "Reads",
    ref: { call: "TreeReadTwice", args: [] },
    each: { calls: "TreeRibbonRead", as: "lv" },
    children: [
      {
        key: "ribbon",
        name: "Ribbon",
        ref: { call: "TreeRibbonRead", args: ["{lv}"] },
        children: [leaf("base", "TreeBase")],
      },
      leaf("level", "TreeLevel"),
    ],
  };
  const bp: Blueprint = {
    id: "invented-calls",
    root: {
      name: "Invented",
      ref: { call: "TreeReadTwicePool", args: [0, 0, 0] },
    },
    pools: [
      {
        kind: "additive",
        groups: [
          { system: "cards", sources: [source] },
          { system: "stamps", sources: [leaf("capped", "TreeCapped")] },
        ],
      },
    ],
  };
  expect(
    lock("TreeReadTwicePool", bp).filter((m) => m.includes("duas chamadas")),
  ).toEqual([]);
});
