// A list of calls of one block as a model child (spec 010, T205; data-model "Lista de chamadas"): `each: { calls, as }`
// repeats the model once per recorded call of the block in the level, `{as}` in the argument the loop's turn gives; each
// call is tied by its own place, never by value or order; two calls the place does not separate are refused. The
// invented game's TreeRibbons sums TreeRibbon(TreeList[i], 0) over three turns; TreeRibbonsTwin calls TreeRibbon(3, 0)
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
    "invented-calls/0/cards/ribbons: duas chamadas TreeRibbon(3,0) no nível, e o lugar não as separa",
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
