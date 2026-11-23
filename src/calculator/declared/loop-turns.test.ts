// A source that sums a list in a loop (spec 010, T167; spec, Open Questions 23/11): one child per turn, one item a
// line. The draft writes a child per turn with that turn's item; the lock closes the level by summing the turns, each
// by its recorded place. Turns that do not part by their place are refused with the reason. The invented game
// (fake-game.js, TreeTurns*) sums TreeList's items × 2 over TreeCapped.
import { expect, test } from "vitest";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { draftBlueprint } from "./draft.ts";
import type { DraftNode } from "./draft.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint, lockMessage } from "./lock.ts";
import { refKey } from "./refs.ts";

type Shape = [string, Shape[]];
const shape = (n: DraftNode | BlueprintNode): Shape => [
  n.ref ? refKey(n.ref, 0) : "",
  (n.children ?? []).map(shape),
];
const draftOf = (root: string) => {
  const { rec, key, ops } = recorded(root);
  const ref = { call: root, args: [0, 0, 0] };
  return draftBlueprint("invented", { name: "I", ref }, key, rec, ops);
};

const leaf = (key: string, read: string): BlueprintNode => ({
  key,
  name: key,
  ref: { read },
  leaf: "level",
});
const call = (
  key: string,
  block: string,
  args: number[],
  children: BlueprintNode[],
): BlueprintNode => ({
  key,
  name: key,
  ref: { call: block, args },
  children,
});
const item = (i: number) =>
  call(
    `item-${String(i)}`,
    "TreeTurnItem",
    [i],
    [leaf("list", `TreeList[${String(i)}]`)],
  );
const lock = (root: string, source: BlueprintNode) => {
  const bp: Blueprint = {
    id: "invented-turns",
    root: { name: "Invented", ref: { call: root, args: [0, 0, 0] } },
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
  return lockBlueprint({
    blueprint: bp,
    ...recorded(root),
    character: 0,
    characterClass: 3,
  });
};

test("the draft writes one child per turn of the loop, with the item of that turn", () => {
  const draft = draftOf("TreeTurnsRoot");
  expect(draft.pools[0]?.groups[0]?.sources.map(shape)).toEqual([
    [
      "TreeTurns()",
      [
        ["TreeTurnItem(0)", [["TreeList[0]", []]]],
        ["TreeTurnItem(1)", [["TreeList[1]", []]]],
        ["TreeTurnItem(2)", [["TreeList[2]", []]]],
      ],
    ],
  ]);
});

test("the lock closes the loop's level by summing its turns, each by its recorded place", () => {
  const ok = lock(
    "TreeTurnsRoot",
    call("turns", "TreeTurns", [], [item(0), item(1), item(2)]),
  );
  expect(ok.errors).toEqual([]);
  expect(ok.counts).toEqual({
    closed: 6,
    closedByRecorded: 0,
    leaves: 4,
    branches: 4,
  });
  // a turn with no child is a part with no child
  const missing = lock(
    "TreeTurnsRoot",
    call("turns", "TreeTurns", [], [item(0), item(2)]),
  );
  expect(missing.errors.map(lockMessage)).toEqual([
    "parte não declarada: invented-turns/0/cards/turns: TreeTurnItem(1)",
  ]);
});

test("turns that do not part by their place are refused with the reason, in the lock and in the draft", () => {
  expect(
    lock(
      "TreeTurnsBeforeRoot",
      call("turns", "TreeTurnsBefore", [], [item(0), item(1)]),
    ).errors.map(lockMessage),
  ).toEqual([
    "invented-turns/0/cards/turns: a volta 1 do laço de TreeTurnsBefore() não tem o item no seu lugar",
  ]);
  expect(
    lock(
      "TreeTurnsSameRoot",
      call("turns", "TreeTurnsSame", [], [leaf("base", "TreeBase")]),
    ).errors.map(lockMessage),
  ).toEqual([
    "invented-turns/0/cards/turns: duas voltas do laço de TreeTurnsSame() têm o mesmo item (TreeBase)",
  ]);
  const before = draftOf("TreeTurnsBeforeRoot");
  expect(before.pools[0]?.groups[0]?.sources.map(shape)).toEqual([
    ["TreeTurnsBefore()", []],
  ]);
  expect(before.pending).toContainEqual({
    where: "pools/0/groups/0/sources/0",
    kind: "descend",
  });
});
