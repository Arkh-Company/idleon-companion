// A call's argument the game gives from the character's index (spec 010, research R5; Fase 4 r1): the game passes the
// current character as GetPlayersUsernames.indexOf(UserInfo[0]) (its Divinity("Bonus_Minor", …, god)). The draft
// writes `{character}` there, by the code at the call's place, never by a number equal to the index; the lock refuses
// the recipe that writes the index out. The invented game: TreeCharArg, TreeDeclOwn(its character) + TreeDeclRow(0).
import { expect, test } from "vitest";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { draftBlueprint } from "./draft.ts";
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

const leaf = (read: string): BlueprintNode => ({
  key: read.toLowerCase().replace(/\W+/g, "-"),
  name: read,
  ref: { read },
  leaf: "level",
});
const blueprint = (own: RefArg): Blueprint => {
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
      ref: { call: "TreeDeclRow", args: [0] },
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
