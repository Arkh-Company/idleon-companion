// A source that reads back an item of a working list the root filled by push (spec 010, part R; the game's PlayerHPmax
// and its PlayerHPmaxLIST): the draft goes down through the write that item's read saw, as the lock's parts do
// (level-parts.ts), to the parts of what was pushed. The invented game (fake-game.js, TreePushList) pushes
// 15 + TreeBase + CardBonusREAL(1) and 1 + TreeLevel / 100, and returns the product of the two items.
import { expect, test } from "vitest";
import type { Blueprint } from "./blueprint.ts";
import { draftJson } from "./draft-json.ts";
import { draftBlueprint, NO_CONTEXT } from "./draft.ts";
import type { DraftNode } from "./draft.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint } from "./lock.ts";

const ROOT = {
  name: "Invented",
  ref: { call: "TreePushList", args: [0, 0, 0] },
};
const draftOf = () => {
  const { rec, key, ops } = recorded("TreePushList");
  return draftBlueprint("invented-push", ROOT, key, rec, ops, NO_CONTEXT);
};
const refs = (n: DraftNode | undefined) => n?.children?.map((c) => c.ref);

test("an item of the root's own working list goes down to the parts of what was pushed, never a leaf", () => {
  const d = draftOf();
  const sources = d.pools.flatMap((p) => p.groups.flatMap((g) => g.sources));
  expect(sources.map((s) => s.ref)).toEqual([
    { read: "DummyNumbersStatManager.TreePushLIST[0]" },
    { read: "DummyNumbersStatManager.TreePushLIST[1]" },
  ]);
  expect(sources.map(refs)).toEqual([
    [{ read: "TreeBase" }, { call: "CardBonusREAL", args: [1] }],
    [{ read: "TreeLevel" }],
  ]);
});

test("filled where it is pending, the draft of the working list passes the lock", () => {
  const d = JSON.parse(draftJson(draftOf())) as {
    pending: { where: string; kind: string }[];
  };
  for (const p of d.pending) {
    const at = p.where
      .split("/")
      .reduce<Record<string, unknown>>(
        (o, k) => o[k] as Record<string, unknown>,
        d,
      );
    if (p.kind === "name") at.name = "Filled Name";
    else if (p.kind === "leaf") at.leaf = "rawBonus";
    else if ("sources" in at) at.system = p.where;
    else at.termPart = { system: "achievements" };
  }
  const blueprint = { ...d, pending: [] } as unknown as Blueprint;
  const lock = lockBlueprint({
    blueprint,
    ...recorded("TreePushList"),
    character: 0,
    characterClass: 3,
  });
  expect(lock.errors).toEqual([]);
});
