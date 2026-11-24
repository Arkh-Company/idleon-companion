// A call's argument the game gives from the character's index (spec 010, research R5; Fase 4 r1): the game passes the
// current character as GetPlayersUsernames.indexOf(UserInfo[0]) (its Divinity("Bonus_Minor", …, god)). The draft
// writes `{character}` there, by the code at the call's place, never by a number equal to the index; the lock refuses
// the recipe that writes the index out. The invented game: TreeCharArg, TreeDeclOwn(its character) + TreeDeclRow(0).
import { expect, test, vi } from "vitest";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { draftBlueprint } from "./draft.ts";
import { stepsGuide } from "./draft-steps.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";
import type { RefArg } from "./refs.ts";

const ROOT = "TreeCharArg";

test("the draft writes {character} in the argument the game gave from the character's index, and only there", () => {
  const { rec, key, ops } = recorded(ROOT);
  expect(key.final).toBe(11);
  const ref = { call: ROOT, args: [0, 0, 0] };
  const d = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  const refs = d.pools[0]?.groups.map((g) => g.sources[0]?.ref);
  expect(refs).toEqual([
    { read: "TreeBase" },
    { call: "TreeDeclOwn", args: ["{character}"] },
    { call: "TreeDeclRow", args: [0] },
  ]);
  // the key and the name never carry the marked argument: the key is the call's other arguments, the name waits
  const own = d.pools[0]?.groups[1]?.sources[0];
  expect([own?.key, own?.nameProof]).toEqual(["tree-decl-own", undefined]);
  expect(d.pending).toContainEqual({
    where: "pools/0/groups/1/sources/0",
    kind: "name",
  });
  // the 0 written in the code is the agent's to decide, as before; the character's is not
  const waits = d.pending.filter((p) => p.kind === "descend");
  expect(waits.map((p) => p.where)).toEqual(["pools/0/groups/2/sources/0"]);
});

// a static name for the invented call by the character's index, as the real game's Divinity("Bonus_Minor", 8, 2) has
vi.mock(import("../names/names-table.ts"), async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    STATIC_NAMES: new Map([
      ...real.STATIC_NAMES,
      ["TreeDeclOwn(0)", { name: "Invented Own", proof: "invented" }],
    ]),
  };
});

test("the steps guide proposes no name proven by the character's index (Fase 4 r3)", () => {
  const { rec, key, ops } = recorded(ROOT);
  const guide = stepsGuide(key, rec, ops);
  expect(guide).toContain("TreeDeclOwn");
  expect(guide).not.toContain("prova: names TreeDeclOwn(0)");
});

const leaf = (read: string): BlueprintNode => ({
  key: read.toLowerCase().replace(/\W+/g, "-"),
  name: read,
  ref: { read },
  leaf: "level",
});
const blueprint = (own: RefArg, row: RefArg = 0): Blueprint => {
  const sources: BlueprintNode[] = [
    leaf("TreeBase"),
    {
      key: "own",
      name: "Own",
      ref: { call: "TreeDeclOwn", args: [own] },
      children: [leaf("TreeList[0]")],
    },
    {
      key: "row",
      name: "Row",
      ref: { call: "TreeDeclRow", args: [row] },
      leaf: "level",
    },
  ];
  return {
    id: "invented-char",
    root: { name: "Invented", ref: { call: ROOT, args: [0, 0, 0] } },
    pools: [
      {
        kind: "additive",
        groups: sources.map((s) => ({
          system: "luk-stats",
          sources: [s],
        })),
      },
    ],
  };
};

test("the lock refuses a recipe that writes out the character's index where the game gave it; {character} passes", () => {
  const input = { ...recorded(ROOT), character: 0, characterClass: 3 };
  const lock = (own: RefArg) =>
    lockBlueprint({ ...input, blueprint: blueprint(own) }).errors.map(
      lockMessage,
    );
  expect(lock("{character}")).toEqual([]);
  expect(lock(0)).toEqual([
    'índice do personagem por extenso: invented-char/0/luk-stats/own: o argumento 1 de TreeDeclOwn vem do personagem; a receita escreve "{character}"',
  ]);
});

test("the lock refuses a {character} where the game wrote a number, even one equal to the index (r3)", () => {
  const input = { ...recorded(ROOT), character: 0, characterClass: 3 };
  expect(
    lockBlueprint({
      ...input,
      blueprint: blueprint("{character}", "{character}"),
    }).errors.map(lockMessage),
  ).toEqual([
    "invented-char/0/luk-stats/row: o argumento 1 de TreeDeclRow não vem do personagem",
  ]);
});

test("a block one place gives the character's index and another a 0 written in the code: the place does not decide (r3)", () => {
  const { rec, key, ops } = recorded("TreeCharSplit");
  expect(key.final).toBe(6);
  const ref = { call: "TreeCharSplit", args: [0, 0, 0] };
  const d = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  // the draft keeps the recorded number, and its name waits, the static name of TreeDeclOwn(0) too
  const own = d.pools[0]?.groups[1]?.sources[0];
  expect(own?.ref).toEqual({ call: "TreeDeclOwn", args: [0] });
  expect(d.pending).toContainEqual({
    where: "pools/0/groups/1/sources/0",
    kind: "name",
  });
  // the lock refuses the number written there, with the reason, and {character} too
  const lock = (arg: RefArg) => {
    const sources: BlueprintNode[] = [
      leaf("TreeBase"),
      {
        key: "own",
        name: "Own",
        ref: { call: "TreeDeclOwn", args: [arg] },
        children: [leaf("TreeList[0]")],
      },
    ];
    const groups = sources.map((s) => ({ system: "luk-stats", sources: [s] }));
    return lockBlueprint({
      rec,
      key,
      ops,
      character: 0,
      characterClass: 3,
      blueprint: {
        id: "invented-split",
        root: { name: "Invented", ref },
        pools: [{ kind: "additive", groups }],
      },
    }).errors.map(lockMessage);
  };
  const unsure =
    "invented-split/0/luk-stats/own: o lugar não decide se o argumento 1 de TreeDeclOwn vem do personagem";
  expect(lock(0)).toContain(unsure);
  expect(lock("{character}")).toContain(unsure);
});

test("a block that passes on the parameter its caller gave from the character's index gets {character} there too (r2)", () => {
  const { rec, key, ops } = recorded("TreeCharPass");
  const ref = { call: "TreeCharPass", args: [0, 0, 0] };
  const d = draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
  const pass = d.pools[0]?.groups[1]?.sources[0];
  expect(pass?.ref).toEqual({ call: "TreeDeclPass", args: ["{character}"] });
  expect(pass?.children?.map((c) => c.ref)).toEqual([
    { read: "TreeBase" },
    { call: "TreeDeclOwn", args: ["{character}"] },
    { call: "TreeDeclRow", args: ["{character}"] },
  ]);
  expect(pass?.children?.[1]?.key).toBe("tree-decl-own");
});
