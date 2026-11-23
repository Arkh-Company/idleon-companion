// The draft of a blueprint (spec 010, research R7, FR-004, FR-009): from the answer key of the invented roots, the pools,
// the sources and constants and their children in the game's order, with structured references; a name only with its
// proof, else a pending entry, as the system, the leaf and the descent. It never passes the lock, and its guide of the
// recorded steps goes only to TREES_OUT.
import { format } from "prettier";
import { afterEach, expect, test } from "vitest";
import { useGameNames } from "../names/names.ts";
import type { Blueprint } from "./blueprint.ts";
import { parseBlueprint } from "./blueprint.ts";
import { stepsGuide } from "./draft-steps.ts";
import { draftBlueprint, draftJson, gameList, talentClass } from "./draft.ts";
import type { DraftBlueprint, DraftNode } from "./draft.ts";
import {
  chainInput,
  inventedBlueprint,
  inventedRecorder,
  recorded,
} from "./lock-fixture.ts";
import { lockBlueprint } from "./lock.ts";
import { draftPlan, stepsPath } from "./real-trees-run.ts";
import { SYSTEMS } from "./systems.ts";

const ROOT = inventedBlueprint("decl-chain").root;
const draftOf = (block: string, ctx?: Parameters<typeof draftBlueprint>[5]) => {
  const { rec, key, ops } = recorded(block);
  return draftBlueprint("decl-draft", ROOT, key, rec, ops, ctx);
};
const sourceAt = (d: DraftBlueprint, pool: number, group: number) => {
  const s = d.pools[pool]?.groups[group]?.sources[0];
  if (!s) throw new Error("no source");
  return s;
};
const kids = (n: DraftNode): unknown =>
  n.children ? n.children.map((c) => [c.ref, kids(c)]) : null;

afterEach(() => {
  useGameNames(new Map());
});

test("the pools in the answer key's order; each source and constant in its own group, in order, by its reference", () => {
  const d = draftOf("TreeDeclChain");
  expect(
    d.pools.map((p) => [
      p.kind,
      p.weight ?? 1,
      p.groups.map((g) => [
        g.system,
        g.sources.map((s) => [s.ref ?? s.constant, s.weight]),
      ]),
    ]),
  ).toEqual([
    [
      "additive",
      0.01,
      [
        [null, [[{ call: "TreeDeclLuck", args: [] }, 1]]],
        [null, [[{ call: "TreeDeclTalent", args: [0] }, undefined]]],
        [null, [[{ call: "ArcadeBonus", args: [0] }, undefined]]],
        [null, [[{ call: "TreeDeclBest", args: [] }, undefined]]],
        [null, [[{ read: "TreeCapped" }, undefined]]],
        [null, [[2, 1]]],
      ],
    ],
    ["multi", 1, [[null, [[{ call: "TreeDeclSum", args: [] }, undefined]]]]],
    ["additive", 1, [[null, [[0.5, undefined]]]]],
    [
      "multi",
      1,
      [
        [null, [[{ read: "TreeStats.b" }, undefined]]],
        [null, [[1.2, undefined]]],
      ],
    ],
  ]);
  expect(sourceAt(d, 0, 5)).toMatchObject({ leaf: "fixedValue", constant: 2 });
});

test("each source's children, level by level, from its recorded expression down to the leaves; a curve is no child", () => {
  const d = draftOf("TreeDeclChain");
  expect(kids(sourceAt(d, 0, 0))).toEqual([[{ read: "TreeLevel" }, null]]);
  // the two-source term: its first call with its children, then its second source
  expect(kids(sourceAt(d, 0, 1))).toEqual([
    [
      { call: "TreeDeclTalent", args: [0] },
      [[{ read: "PlayerDATABASE[{character}].SkillLevels[0]" }, null]],
    ],
    [{ read: "TreeTwins[0]" }, null],
  ]);
  expect(kids(sourceAt(d, 0, 2))).toEqual([[{ read: "TreeBase" }, null]]);
  expect(kids(sourceAt(d, 1, 0))).toEqual([
    [{ read: "TreeList[0]" }, null],
    [{ read: "TreeList[1]" }, null],
    [{ read: "TreeList[2]" }, null],
  ]);
});

test("a name only with its proof, else null and a pending name; the system, the leaf and the descent are pending too", () => {
  useGameNames(new Map([["GetTalentNumber(1, 1)", "Invented Talent"]]));
  const d = draftOf("TreeDeclDraft");
  expect(
    d.pools[0]?.groups.map((g) => [
      g.sources[0]?.name,
      g.sources[0]?.nameProof,
    ]),
  ).toEqual([
    [null, undefined],
    ["Invented Talent", { names: "GetTalentNumber(1, 1)" }],
  ]);
  expect(d.pending).toEqual([
    { where: "pools/0/groups/0", kind: "system" },
    { where: "pools/0/groups/0/sources/0", kind: "name" },
    { where: "pools/0/groups/0/sources/0", kind: "leaf" },
    { where: "pools/0/groups/1", kind: "system" },
    { where: "pools/0/groups/1/sources/0/children/0", kind: "name" },
    { where: "pools/0/groups/1/sources/0/children/0", kind: "leaf" },
  ]);
  // the second source of a two-source term waits for its system (its termPart)
  expect(draftOf("TreeDeclChain").pending).toContainEqual({
    where: "pools/0/groups/1/sources/0/children/1",
    kind: "system",
  });
  // a loop's level has no part the recording ties, and it reads the save: the descent is the agent's
  const expr = draftOf("TreeDeclExpr");
  expect(sourceAt(expr, 1, 0)).toMatchObject({
    ref: { call: "TreeLoop", args: [] },
  });
  expect(expr.pending).toContainEqual({
    where: "pools/1/groups/0/sources/0",
    kind: "descend",
  });
});

test("a talent source takes the class of its tab in the game's talent order; a star talent, or one in two places, none", () => {
  const order: unknown[] = Array.from({ length: 700 }, (_, i) => 1000 + i);
  order[16] = 1;
  expect(talentClass(order, 1)).toBe(2);
  const d = draftOf("TreeDeclDraft", { character: 0, talentOrder: order });
  expect(sourceAt(d, 0, 1).classes).toEqual([2]);
  expect(sourceAt(d, 0, 0).classes).toBeUndefined();
  const star = [...order];
  star[16] = 1016;
  star[620] = 1;
  expect(talentClass(star, 1)).toBe(null);
  const twice = [...order];
  twice[40] = 1;
  expect(talentClass(twice, 1)).toBe(null);
  expect(talentClass([], 1)).toBe(null);
});

test("the game's talent order is read as a list of the game's tables, in the recorder's context; none gives an empty list", () => {
  const { context } = inventedRecorder();
  expect(gameList(context, "CustomLists.ListTwo", 5_000)).toEqual([32]);
  expect(gameList(context, "CustomLists.NoSuchList", 5_000)).toEqual([]);
});

test("{character} stands for the tree's character; no character's index is written out", () => {
  const json = draftJson(draftOf("TreeDeclChain"));
  expect(json).toContain("PlayerDATABASE[{character}].SkillLevels[0]");
  expect(json).not.toMatch(/PlayerDATABASE\[\d+\]/);
});

test("a call's argument equal to the character's index is not decided by its value: the node waits for its descent, and the guide shows the argument", () => {
  // TreeDeclPass(0) passes its character, 0, to TreeDeclOwn
  const { rec, key, ops } = recorded("TreeDeclPass");
  const d = draftBlueprint("decl-draft", ROOT, key, rec, ops);
  expect(sourceAt(d, 0, 1).ref).toEqual({ call: "TreeDeclOwn", args: [0] });
  const wait = { where: "pools/0/groups/1/sources/0", kind: "descend" };
  expect(d.pending).toContainEqual(wait);
  expect(stepsGuide(key, rec, ops)).toMatch(
    /TreeDeclOwn\(0\)[^\n]*\n(?:[^\n]*\n)*?\s+argumento 1 = 0: o índice do personagem\? se for, a receita escreve "\{character\}"/,
  );
  // another character's draft has no such argument
  const other = draftBlueprint("decl-draft", ROOT, key, rec, ops, {
    character: 1,
    talentOrder: [],
  });
  expect(other.pending).not.toContainEqual(wait);
});

test("the draft loads in the draft stage, and the lock refuses it for its pending entries", () => {
  const d = draftOf("TreeDeclChain");
  const out = parseBlueprint(JSON.parse(draftJson(d)), {
    fileId: "decl-draft",
    systemIds: new Set(SYSTEMS.map((s) => s.id)),
  });
  if (!out.ok) throw new Error(out.reason);
  expect(out.stage).toBe("draft");
  const lock = lockBlueprint({ ...chainInput(), blueprint: out.blueprint });
  expect(lock.ok).toBe(false);
  expect(new Set(lock.errors.map((e) => e.kind))).toEqual(new Set(["pending"]));
  expect(lock.errors).toHaveLength(d.pending.length);
});

test("filled where it is pending, the draft passes the lock: its order and its parts are the answer key's", () => {
  const d = JSON.parse(draftJson(draftOf("TreeDeclChain"))) as {
    pending: { where: string; kind: string }[];
  };
  for (const p of d.pending) {
    const at = p.where
      .split("/")
      .reduce<Record<string, unknown>>(
        (o, k) => o[k] as Record<string, unknown>,
        d,
      );
    // an argument equal to the character's index that is not the character: kept as it is
    if (p.kind === "descend") continue;
    if (p.kind === "name") at.name = "Filled Name";
    else if (p.kind === "leaf") at.leaf = "rawBonus";
    else if ("sources" in at) at.system = p.where;
    else at.termPart = { system: "achievements" };
  }
  const blueprint = { ...d, pending: [] } as unknown as Blueprint;
  expect(lockBlueprint({ ...chainInput(), blueprint }).errors).toEqual([]);
});

test("a number with a blueprint written gets no draft: only a sketch is drafted, never written over", () => {
  const stages = new Map([
    ["a", "sketch"],
    ["b", "complete"],
    ["c", "draft"],
  ] as const);
  expect(draftPlan(["a", "b", "c", "d"], stages)).toEqual(["a"]);
});

test("the guide of the steps goes only to TREES_OUT, with the recorded values; the draft has no value, count or expression", () => {
  expect(stepsPath("C:/out", "stats-drop-rate")).toMatch(
    /out[\\/]draft[\\/]stats-drop-rate\.steps\.txt$/,
  );
  expect(() => stepsPath("C:/out", "../x")).toThrow();
  const { rec, key, ops } = recorded("TreeDeclChain");
  const guide = stepsGuide(key, rec, ops);
  expect(guide).toContain("TreeDeclLuck()");
  expect(guide).toContain("TreeLevel = 25");
  // the best of every character reads the others too, each by `*`
  expect(guide).toContain("PlayerDATABASE[*].SkillLevels[1]");
  expect(guide).not.toMatch(/PlayerDATABASE\[\d+\]/);
  const json = draftJson(draftBlueprint("decl-draft", ROOT, key, rec, ops));
  expect(json).not.toContain(String(key.final));
  expect(json).not.toContain(String(key.pools[0]?.value));
  expect(json).not.toMatch(/"(t|e|v|o|steps|value)":|\s[-+*/]\s|Math\./);
});

test("the draft's JSON is already as prettier leaves it", async () => {
  for (const block of ["TreeDeclChain", "TreeDeclDraft"]) {
    const json = draftJson(draftOf(block));
    expect(await format(json, { parser: "json" })).toBe(json);
  }
});
