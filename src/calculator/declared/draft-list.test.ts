// A long list as one model child (spec 010, T202; spec, Open Questions 24/11): when a node's children are reads of one
// path that only change in one index, the draft writes `each` with one model child, never one child per item; the
// index comes from the recorded path, never from the value. The lock repeats the model once per part of the level its
// `[*]` matches. The invented game (fake-game.js, TreeLong*) sums a list of ten in a loop, below a source that doubles it.
import { expect, test } from "vitest";
import { parseBlueprint } from "./blueprint.ts";
import type { Blueprint } from "./blueprint.ts";
import { draftJson } from "./draft-json.ts";
import { modelName } from "./draft-list.ts";
import { draftBlueprint } from "./draft.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";
import { SYSTEMS } from "./systems.ts";

const LONG = { TreeLong: [5, 1, 4, 1, 5, 9, 2, 6, 5, 3] };
const ROOT = {
  name: "Invented",
  ref: { call: "TreeLongRoot", args: [0, 0, 0] },
};
const SOURCE = "pools/0/groups/1/sources/0";
const draftOf = () => {
  const { rec, key, ops } = recorded("TreeLongRoot", LONG);
  return draftBlueprint("invented-long", ROOT, key, rec, ops);
};
type Raw = Record<string, unknown> & { children?: Raw[] };
const lockOf = (blueprint: unknown) =>
  lockBlueprint({
    blueprint: blueprint as Blueprint,
    ...recorded("TreeLongRoot", LONG),
    character: 0,
    characterClass: 3,
  });
const loaded = (raw: unknown) => {
  const out = parseBlueprint(raw, {
    fileId: "invented-long",
    systemIds: new Set(SYSTEMS.map((s) => s.id)),
  });
  if (!out.ok) throw new Error(out.reason);
  return out;
};
type Filled = Raw & { pools: { groups: (Raw & { sources: Raw[] })[] }[] };
const listOf = (d: Filled): Raw | undefined =>
  d.pools[0]?.groups[1]?.sources[0]?.children?.[0];
/** The draft with every pending place filled, as the agent would. */
function filled(): Filled {
  const d = JSON.parse(draftJson(draftOf())) as Filled & {
    pending: { where: string; kind: string }[];
  };
  for (const p of d.pending) {
    const at = p.where.split("/").reduce<Raw>((o, k) => o[k] as Raw, d as Raw);
    if (p.kind === "name") at.name = "Filled";
    else if (p.kind === "leaf") at.leaf = "rawBonus";
    else if (p.kind === "system") at.system = "cards";
  }
  d.pools.forEach((pool) => {
    pool.groups.forEach((g, i) => {
      g.system = ["cards", "stamps"][i];
    });
  });
  return { ...d, pending: undefined };
}

test("a long list of reads of one path, only an index changing, is one model child with each; one pending each, never one per item", () => {
  const d = draftOf();
  const list = d.pools[0]?.groups[1]?.sources[0]?.children?.[0];
  expect(list?.ref).toEqual({ call: "TreeLongTurns", args: [] });
  expect(list?.each).toEqual({ list: "TreeLong[*]", as: "item" });
  expect(list?.children?.map((c) => c.ref)).toEqual([
    { read: "TreeLong[{item}]" },
  ]);
  expect(
    d.pending.filter((p) => p.where.startsWith(`${SOURCE}/children/0/`)),
  ).toEqual([
    { where: `${SOURCE}/children/0/children/0`, kind: "name" },
    { where: `${SOURCE}/children/0/children/0`, kind: "leaf" },
  ]);
});

test("the draft with a model loads as a draft, and the lock refuses it for its pending entries only", () => {
  const d = draftOf();
  const out = loaded(JSON.parse(draftJson(d)));
  expect(out.stage).toBe("draft");
  const lock = lockOf(out.blueprint);
  expect(new Set(lock.errors.map((e) => e.kind))).toEqual(new Set(["pending"]));
});

test("filled, the model passes the lock: one item per recorded index of the level, each by its place", () => {
  const lock = lockOf(loaded(filled()).blueprint);
  expect(lock.errors.map(lockMessage)).toEqual([]);
  const items = lock.closedAt.filter((w) => /\/tree-long-\d+$/.test(w));
  expect(items).toHaveLength(10);
  // a model whose list is not the level's: each part is undeclared, never tied by order
  const off = filled();
  const turns = listOf(off);
  if (!turns?.children?.[0]) throw new Error("no model");
  turns.each = { list: "TreeList[*]", as: "item" };
  turns.children[0].ref = { read: "TreeList[{item}]" };
  expect(
    lockOf(loaded(off).blueprint).errors.filter(
      (e) => e.kind === "undeclaredPart",
    ),
  ).toHaveLength(10);
});

test("a model child's name is the items' names with the index as {item}, only when it gives each item's own name", () => {
  const names = ["Stat, entry 0", "Stat, entry 7", "Stat, entry 12"];
  expect(modelName(names, [0, 7, 12])).toBe("Stat, entry {item}");
  expect(modelName(["Same", "Same"], [0, 1])).toBe("Same");
  // an index that is also in the name's text elsewhere, or a name of its own, gives none
  expect(
    modelName(["Lv 1 bonus 1", "Lv 2 bonus 1", "Lv 3 bonus 3"], [1, 2, 3]),
  ).toBe(null);
  expect(modelName(["Stat 0", "Other 1"], [0, 1])).toBe(null);
  expect(modelName(["Stat 0", null], [0, 1])).toBe(null);
});

test("each without combine outside a piece is a model child below a node, one model only", () => {
  const two = filled();
  const turns = listOf(two);
  const [model] = turns?.children ?? [];
  if (!turns || !model) throw new Error("no model");
  turns.children = [model, { ...model, key: "other" }];
  expect(
    parseBlueprint(two, {
      fileId: "invented-long",
      systemIds: new Set(SYSTEMS.map((s) => s.id)),
    }),
  ).toMatchObject({ ok: false, reason: expect.stringMatching(/filho-modelo/) });
});
