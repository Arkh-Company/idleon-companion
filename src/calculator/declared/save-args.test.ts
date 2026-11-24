// A call's argument the game gives from the save (Fase 4 r1 of part N): the game passes a count of the save as an
// argument, as its ArcaneType("ArcaneMapMulti", MapBon[CurrentMap][i], 0) the map's kills, and the block below passes it
// on, as ArcaneType's Log2(t). The draft writes `*` there, by the code at the call's place, never by the number; the
// lock ties the call by its place with the `*`, refuses the recipe that writes the save's number out, and refuses two
// calls of one block the `*` makes equal. The invented game: TreeSaveArg, TreeDeclKills("Map", TreeList[2], 0).
import { expect, test } from "vitest";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { draftBlueprint } from "./draft.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";
import type { RefArg } from "./refs.ts";

const draftOf = (root: string) => {
  const { rec, key, ops } = recorded(root);
  const ref = { call: root, args: [0, 0, 0] };
  return draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
};

test("the draft writes * in the argument the game gave from the save, and in the parameter a block passes on", () => {
  const d = draftOf("TreeSaveArg");
  const sources = d.pools[0]?.groups.map((g) => g.sources[0]);
  expect(sources?.map((s) => s?.ref)).toEqual([
    { read: "TreeBase" },
    { call: "TreeDeclKills", args: ["Map", "*", 0] },
    { call: "TreeDeclRow", args: [0] },
  ]);
  const kills = sources?.[1];
  expect(kills?.children?.map((c) => c.ref)).toEqual([
    { call: "TreeDeclRow", args: ["*"] },
  ]);
  // the key and the name never carry the marked argument: the key is the call's other arguments, the name waits
  expect([kills?.key, kills?.nameProof]).toEqual([
    "tree-decl-kills-map-0",
    undefined,
  ]);
  expect(kills?.children?.[0]?.key).toBe("tree-decl-row");
  expect(d.pending).toContainEqual({
    where: "pools/0/groups/1/sources/0",
    kind: "name",
  });
});

const row = (arg: RefArg): BlueprintNode => ({
  key: "row",
  name: "Row",
  ref: { call: "TreeDeclRow", args: [arg] },
  leaf: "level",
});
const blueprint = (kills: RefArg, below: RefArg): Blueprint => {
  const sources: BlueprintNode[] = [
    { key: "base", name: "Base", ref: { read: "TreeBase" }, leaf: "level" },
    {
      key: "kills",
      name: "Kills",
      ref: { call: "TreeDeclKills", args: ["Map", kills, 0] },
      children: [row(below)],
    },
    { ...row(0), key: "row-0" },
  ];
  return {
    id: "invented-save",
    root: { name: "Invented", ref: { call: "TreeSaveArg", args: [0, 0, 0] } },
    pools: [
      {
        kind: "additive",
        groups: sources.map((s) => ({ system: "luk-stats", sources: [s] })),
      },
    ],
  };
};

test("the lock ties a call by its place with the *, and refuses a recipe that writes the save's number out", () => {
  const input = { ...recorded("TreeSaveArg"), character: 0, characterClass: 3 };
  expect(input.key.final).toBe(25);
  const lock = (kills: RefArg, below: RefArg) =>
    lockBlueprint({ ...input, blueprint: blueprint(kills, below) }).errors.map(
      lockMessage,
    );
  // the 0 the game set in its working map, the place does not decide (r2): the honest refusal
  const working =
    "invented-save/0/luk-stats/row-0: o lugar não decide se o argumento 1 de TreeDeclRow vem do save";
  expect(lock("*", "*")).toEqual([working]);
  expect(lock(3, "*")).toEqual([
    'argumento do save por extenso: invented-save/0/luk-stats/kills: o argumento 2 de TreeDeclKills vem do save; a receita escreve "*"',
    working,
  ]);
  expect(lock("*", 3)).toEqual([
    'argumento do save por extenso: invented-save/0/luk-stats/kills/row: o argumento 1 de TreeDeclRow vem do save; a receita escreve "*"',
    working,
  ]);
});

test("a pending leaf or descent never hides the save's number written out, at its node or below it (r2)", () => {
  const input = { ...recorded("TreeSaveArg"), character: 0, characterClass: 3 };
  const lock = (kills: RefArg, below: RefArg, kind: "leaf" | "descend") =>
    lockBlueprint({
      ...input,
      blueprint: {
        ...blueprint(kills, below),
        pending: [{ where: "pools/0/groups/1/sources/0", kind }],
      },
    }).errors.map(lockMessage);
  for (const kind of ["leaf", "descend"] as const)
    expect(lock(3, "*", kind)).toContain(
      'argumento do save por extenso: invented-save/0/luk-stats/kills: o argumento 2 de TreeDeclKills vem do save; a receita escreve "*"',
    );
  expect(lock("*", 3, "descend")).toContain(
    'argumento do save por extenso: invented-save/0/luk-stats/kills/row: o argumento 1 de TreeDeclRow vem do save; a receita escreve "*"',
  );
});

test("two calls of one block the * makes equal are refused with the reason, never tied by order", () => {
  const input = {
    ...recorded("TreeSaveTwice"),
    character: 0,
    characterClass: 3,
  };
  const kills = (key: string): BlueprintNode => ({
    key,
    name: "Kills",
    ref: { call: "TreeDeclKills", args: ["Map", "*", 0] },
    leaf: "level",
  });
  const bp: Blueprint = {
    id: "invented-twice",
    root: { name: "Invented", ref: { call: "TreeSaveTwice", args: [0, 0, 0] } },
    pools: [
      {
        kind: "additive",
        groups: [{ system: "luk-stats", sources: [kills("a"), kills("b")] }],
      },
    ],
  };
  expect(
    lockBlueprint({ ...input, blueprint: bp }).errors.map(lockMessage),
  ).toContain(
    'invented-twice/0/luk-stats/a: duas chamadas casam com TreeDeclKills("Map","*",0): TreeDeclKills("Map",1,0) e TreeDeclKills("Map",2,0); a ligação seria pela ordem',
  );
});

test("an argument one place gives from the save and another writes in the code: the place does not decide (r2)", () => {
  const { rec, key, ops } = recorded("TreeSaveSplit");
  expect(key.final).toBe(20);
  const ref = { call: "TreeSaveSplit", args: [0, 0, 0] };
  const d = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  // the draft keeps the recorded number, and its name waits
  const kills = d.pools[0]?.groups[1]?.sources[0];
  expect(kills?.ref).toEqual({ call: "TreeDeclKills", args: ["Map", 3, 0] });
  expect(d.pending).toContainEqual({
    where: "pools/0/groups/1/sources/0",
    kind: "name",
  });
  // the lock refuses the number written there, with the reason, and the * too
  const input = { rec, key, ops, character: 0, characterClass: 3 };
  const lock = (arg: RefArg) =>
    lockBlueprint({
      ...input,
      blueprint: {
        id: "invented-split",
        root: { name: "Invented", ref },
        pools: [
          {
            kind: "additive",
            groups: [
              {
                system: "luk-stats",
                sources: [
                  {
                    key: "base",
                    name: "Base",
                    ref: { read: "TreeBase" },
                    leaf: "level",
                  },
                ],
              },
              {
                system: "luk-stats",
                sources: [
                  {
                    key: "kills",
                    name: "Kills",
                    ref: { call: "TreeDeclKills", args: ["Map", arg, 0] },
                    children: [row(3)],
                  },
                ],
              },
            ],
          },
        ],
      },
    }).errors.map(lockMessage);
  const unsure =
    "invented-split/0/luk-stats/kills: o lugar não decide se o argumento 2 de TreeDeclKills vem do save";
  expect(lock(3)).toContain(unsure);
  expect(lock("*")).toContain(unsure);
});
