// A turn whose item is a count (spec 010, T193; research R4): the turn's line takes the item's first call or read as
// its ref, the item's other references are termPart children, and the line closes by the item's recorded expression.
// The invented game (fake-game.js, TreeTurnsCount*) reads TreeLevel in each turn out of the item, before the item's
// step in one block and after it in the other: the item's place decides, never the turn's other reads. In a third,
// the item reads back a pass-through variable the turn wrote (T188): the line goes by what gave its write.
import { expect, test } from "vitest";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { draftBlueprint } from "./draft.ts";
import type { DraftNode } from "./draft.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";
import { refKey } from "./refs.ts";
import type { RefArg } from "./refs.ts";

type Shape = [string, Shape[]];
const shape = (n: DraftNode | BlueprintNode): Shape => [
  n.ref ? refKey(n.ref, 0) : "",
  (n.children ?? []).map(shape),
];
const BLOCKS = [
  "TreeTurnsCountBefore",
  "TreeTurnsCountAfter",
  "TreeTurnsCountPassage",
];

const line = (i: number, termPart = true): BlueprintNode => ({
  key: `item-${String(i)}`,
  name: "Item",
  ref: { call: "TreeTurnItem", args: [i] },
  children: [
    {
      key: "item",
      name: "Item",
      ref: { call: "TreeTurnItem", args: [i] },
      children: [
        {
          key: "list",
          name: "List",
          ref: { read: `TreeList[${String(i)}]` },
          leaf: "level",
        },
      ],
    },
    {
      key: "twin",
      name: "Twin",
      ref: { read: `TreeTwins[${String(i)}]` },
      leaf: "record",
      ...(termPart && { termPart: { system: "achievements" } }),
    },
  ],
});
const lock = (block: string, lines: BlueprintNode[]) => {
  const root = `${block}Root`;
  const bp: Blueprint = {
    id: "invented-turns",
    root: { name: "Invented", ref: { call: root, args: [0, 0, 0] } },
    pools: [
      {
        kind: "additive",
        groups: [
          {
            system: "cards",
            sources: [
              {
                key: "turns",
                name: "Turns",
                ref: { call: block, args: [] },
                children: lines,
              },
            ],
          },
          {
            system: "stamps",
            sources: [
              {
                key: "capped",
                name: "Capped",
                ref: { read: "TreeCapped" },
                leaf: "level",
              },
            ],
          },
        ],
      },
    ],
  };
  const out = lockBlueprint({
    blueprint: bp,
    ...recorded(root),
    character: 0,
    characterClass: 3,
  });
  return out.errors.map(lockMessage);
};

test.each(BLOCKS)(
  "the draft writes a turn whose item is a count as a line by its first call, its other read a termPart child (%s, T193)",
  (block) => {
    const { rec, key, ops } = recorded(`${block}Root`);
    const ref = { call: `${block}Root`, args: [0, 0, 0] };
    const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
    const turn = (i: number): Shape => [
      `TreeTurnItem(${String(i)})`,
      [
        [`TreeTurnItem(${String(i)})`, [[`TreeList[${String(i)}]`, []]]],
        [`TreeTwins[${String(i)}]`, []],
      ],
    ];
    expect(draft.pools[0]?.groups[0]?.sources.map(shape)).toEqual([
      [`${block}()`, [turn(0), turn(1)]],
    ]);
    // the other read of the item waits for its system, as a two-source term's
    for (const i of [0, 1])
      expect(draft.pending).toContainEqual({
        where: `pools/0/groups/0/sources/0/children/${String(i)}/children/1`,
        kind: "system",
      });
  },
);

test.each(BLOCKS)(
  "the lock closes a turn whose item is a count by the item's expression, its other read only a termPart child (%s, T193)",
  (block) => {
    expect(lock(block, [line(0), line(1)])).toEqual([]);
    expect(lock(block, [line(0, false), line(1)])).toEqual([
      "parte não declarada: invented-turns/0/cards/turns/item-0: TreeTwins[0]",
    ]);
  },
);

test("the lock checks a turn's count line's arguments at its first reference's call: the save's number is never written out (r1 of part U)", () => {
  // TreeTurnsCountSave: TreeTurnItemAt(i, TreeBase), its second argument from the save (TreeBase is 4)
  const at = (i: number, arg: RefArg): BlueprintNode => ({
    key: `item-${String(i)}`,
    name: "Item",
    ref: { call: "TreeTurnItemAt", args: [i, arg] },
    children: [
      {
        key: "item",
        name: "Item",
        ref: { call: "TreeTurnItemAt", args: [i, "*"] },
        children: [
          {
            key: "list",
            name: "List",
            ref: { read: `TreeList[${String(i)}]` },
            leaf: "level",
          },
        ],
      },
      {
        key: "twin",
        name: "Twin",
        ref: { read: `TreeTwins[${String(i)}]` },
        leaf: "record",
        termPart: { system: "achievements" },
      },
    ],
  });
  const block = "TreeTurnsCountSave";
  expect(lock(block, [at(0, "*"), at(1, "*")])).toEqual([]);
  expect(lock(block, [at(0, 4), at(1, "*")])).toEqual([
    'argumento do save por extenso: invented-turns/0/cards/turns/item-0: o argumento 2 de TreeTurnItemAt vem do save; a receita escreve "*"',
  ]);
});

test("a turn whose item is a bare number has no part: the call's other calls are no line of it (T193)", () => {
  const root = "TreeTurnsCountOneRoot";
  const { rec, key, ops } = recorded(root);
  const ref = { call: root, args: [0, 0, 0] };
  const draft = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  expect(draft.pools[0]?.groups[0]?.sources.map(shape)).toEqual([
    ["TreeTurnsCountOne()", []],
  ]);
  expect(draft.pending).toContainEqual({
    where: "pools/0/groups/0/sources/0",
    kind: "descend",
  });
});
