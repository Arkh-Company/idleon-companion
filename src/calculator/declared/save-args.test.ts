// A call's argument the game gives from the save (Fase 4 r1 of part N): the game passes a count of the save as an
// argument, as its ArcaneType("ArcaneMapMulti", MapBon[CurrentMap][i], 0) the map's kills, and the block below passes it
// on, as ArcaneType's Log2(t). The draft writes `*` there, by the code at the call's place, never by the number; the
// lock ties the call by its place with the `*`, refuses the recipe that writes the save's number out, and refuses two
// calls of one block the `*` makes equal. The invented game: TreeSaveArg, TreeDeclKills("Map", TreeList[2], 0).
import { expect, test } from "vitest";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { draftBlueprint } from "./draft.ts";
import { mosaicOf } from "../fixtures/fake-mosaic.ts";
import { LOG_CAP } from "../recording.ts";
import { inventedRecorder, recorded } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";
import type { RefArg } from "./refs.ts";
import { saveArgs } from "./save-args.ts";

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
const blueprint = (
  kills: RefArg,
  below: RefArg,
  row0: RefArg = 0,
): Blueprint => {
  const sources: BlueprintNode[] = [
    { key: "base", name: "Base", ref: { read: "TreeBase" }, leaf: "level" },
    {
      key: "kills",
      name: "Kills",
      ref: { call: "TreeDeclKills", args: ["Map", kills, 0] },
      children: [row(below)],
    },
    { ...row(row0), key: "row-0" },
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
  // the 0 the game set in its working map goes down through that write, a number of the code: no save's (group 5 of
  // part P, the recorded place decides)
  expect(lock("*", "*")).toEqual([]);
  expect(lock(3, "*")).toEqual([
    'argumento do save por extenso: invented-save/0/luk-stats/kills: o argumento 2 de TreeDeclKills vem do save; a receita escreve "*"',
  ]);
  expect(lock("*", 3)).toEqual([
    'argumento do save por extenso: invented-save/0/luk-stats/kills/row: o argumento 1 de TreeDeclRow vem do save; a receita escreve "*"',
  ]);
});

test("a {character} where the code wrote a number is refused, never let through by the index's number (r3)", () => {
  const input = { ...recorded("TreeSaveArg"), character: 0, characterClass: 3 };
  const errors = lockBlueprint({
    ...input,
    blueprint: blueprint("*", "*", "{character}"),
  }).errors.map(lockMessage);
  expect(errors).toEqual([
    "invented-save/0/luk-stats/row-0: o argumento 1 de TreeDeclRow não vem do personagem",
  ]);
});

/** One source of TreeDeclRow over `root`'s recording, with `arg`, as the lock's messages. */
const rowLock = (root: string, arg: RefArg, attrs: object = {}) => {
  const input = { ...recorded(root, attrs), character: 0, characterClass: 3 };
  const source = (s: BlueprintNode) => ({ system: "luk-stats", sources: [s] });
  return lockBlueprint({
    ...input,
    blueprint: {
      id: "invented-work",
      root: { name: "Invented", ref: { call: root, args: [0, 0, 0] } },
      pools: [
        {
          kind: "additive",
          groups: [
            source({
              key: "base",
              name: "Base",
              ref: { read: "TreeBase" },
              leaf: "level",
            }),
            source(row(arg)),
          ],
        },
      ],
    },
  }).errors.map(lockMessage);
};

test("an argument from a working map the call filled from a game table in a loop is no save's (group 5 of part P)", () => {
  // TreeWorkArg: DNSM.TreeQdl is ListTwo[0] + r for each turn r; the argument is its indexOf(33), 1
  expect(rowLock("TreeWorkArg", 1)).toEqual([]);
  expect(rowLock("TreeWorkArg", "*")).toEqual([
    "invented-work/0/luk-stats/row: o argumento 1 de TreeDeclRow está no código, não vem do save: a receita escreve o número",
  ]);
});

test("an argument from a working map another block wrote: the place does not decide, refused with the reason (group 5 of part P)", () => {
  expect(rowLock("TreeSaveElse", 0)).toEqual([
    "invented-work/0/luk-stats/row: o lugar não decide se o argumento 1 de TreeDeclRow vem do save",
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

test("an argument one place gives from the save and another writes in the code: the side of the ? : that ran decides (r2; group 5 of part P)", () => {
  const { rec, key, ops } = recorded("TreeSaveSplit");
  expect(key.final).toBe(20);
  const ref = { call: "TreeSaveSplit", args: [0, 0, 0] };
  const d = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  // the number written in the code ran (TreeBase is not over 100): the draft keeps it; its name waits for a proof
  const kills = d.pools[0]?.groups[1]?.sources[0];
  expect(kills?.ref).toEqual({ call: "TreeDeclKills", args: ["Map", 3, 0] });
  expect(d.pending).toContainEqual({
    where: "pools/0/groups/1/sources/0",
    kind: "name",
  });
  // the lock takes the number written there, and refuses the *: that side does not give the save's number
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
  expect(lock(3)).not.toContain(unsure);
  expect(lock("*")).toContain(
    "invented-split/0/luk-stats/kills: o argumento 2 de TreeDeclKills está no código, não vem do save: a receita escreve o número",
  );
});

test("the write of a working map's key the read saw is the last one before it, not an earlier one from the save (group 5 of part P)", () => {
  expect(rowLock("TreeWorkLast", 0)).toEqual([]);
});

test("a working map's key set inside a loop before the read, from its index, is no save's (group 5 of part P)", () => {
  expect(rowLock("TreeWorkLoop", 1)).toEqual([]);
});

test("a key set to 0 on every way, then from the save on the side of an if that ran: the save's number is refused (r1 of P and Q)", () => {
  const saveWritten =
    'argumento do save por extenso: invented-work/0/luk-stats/row: o argumento 1 de TreeDeclRow vem do save; a receita escreve "*"';
  // TreeCondOn on: the if ran, the read saw the save's TreeList[2], 3
  expect(rowLock("TreeWorkCond", 3, { TreeCondOn: 1 })).toEqual([saveWritten]);
  expect(rowLock("TreeWorkCond", "*", { TreeCondOn: 1 })).toEqual([]);
  // the if did not run: the read saw the 0 of the code
  expect(rowLock("TreeWorkCond", 0)).toEqual([]);
});

test("a key set from the save on an if's side in a turn before the last: the recorded write decides, never the last turn's side (r2 of P and Q)", () => {
  // TreeList [3, 0]: the first turn set TreeTurnK to the save's 3, the last one's if did not run
  const attrs = { TreeList: [3, 0] };
  expect(rowLock("TreeWorkTurn", 3, attrs)).toEqual([
    'argumento do save por extenso: invented-work/0/luk-stats/row: o argumento 1 de TreeDeclRow vem do save; a receita escreve "*"',
  ]);
  expect(rowLock("TreeWorkTurn", "*", attrs)).toEqual([]);
});

test("a working map's key read in a builder of the pass: its write is the pass's scratch, among the spliced ones (r2 of P and Q)", () => {
  const r = inventedRecorder();
  const rec = r.record(mosaicOf({ TreeCondOn: 1 }), [["TreeSaveArg", [0]]], {
    recompute: [],
    builders: [
      {
        cache: "TreeWhoCache",
        run: { block: "TreeWorkCond", args: [] },
        keepLive: true,
      },
    ],
  });
  const cond = rec.nodes.find((n) => n.b === "TreeWorkCond");
  const row = rec.nodes.find((n) => n.b === "TreeDeclRow" && n.p === cond?.id);
  if (!row) throw new Error("no TreeDeclRow in the pass");
  expect(rec.spliced.map((w) => w.path)).toContain("DNSM.TreeCond");
  expect(saveArgs(rec, r.ops, row)).toEqual({ save: [0], unsure: [] });
});

test("a caller whose step log the cap cut before the call's place: an older read is no proof, the place does not decide (r2 of P and Q)", () => {
  const { rec, ops } = recorded("TreeWorkCond", { TreeCondOn: 1 });
  const caller = rec.nodes.find((n) => n.b === "TreeWorkCond");
  const row = rec.nodes.find((n) => n.b === "TreeDeclRow");
  const zero = rec.writes.find((w) => w.path === "DNSM.TreeCond" && w.v === 0);
  if (!caller || !row || !zero) throw new Error("no TreeWorkCond");
  // the log full of reads at its first step, which saw the 0: the read right before the call fell past the cap
  const rx = Array.from(
    { length: LOG_CAP },
    (): [string, number, number, number] => ["DNSM.TreeCond", 0, 0, zero.seq],
  );
  const cut = {
    ...rec,
    nodes: rec.nodes.map((n) => (n === caller ? { ...n, rx } : n)),
  };
  expect(saveArgs(cut, ops, row)).toEqual({ save: [], unsure: [0] });
});

test("a key set to 0, then by a block called in between from the save: the place does not decide (r1 of P and Q)", () => {
  expect(rowLock("TreeWorkMid", 3)).toEqual([
    "invented-work/0/luk-stats/row: o lugar não decide se o argumento 1 de TreeDeclRow vem do save",
  ]);
});
