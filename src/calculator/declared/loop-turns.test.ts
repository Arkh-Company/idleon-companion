// A source that sums a list in a loop (spec 010, T167; spec, Open Questions 23/11): one child per turn, one item a
// line. The draft writes a child per turn with that turn's item; the lock closes the level by summing the turns, each
// by its recorded place. Turns that do not part by their place are refused with the reason. The invented game
// (fake-game.js, TreeTurns*) sums TreeList's items × 2 over TreeCapped.
import { expect, test } from "vitest";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import type { Expr } from "../recorded/steps.ts";
import { draftBlueprint } from "./draft.ts";
import type { DraftNode } from "./draft.ts";
import { recorded } from "./lock-fixture.ts";
import type { LevelContext } from "./lock-levels.ts";
import { loopOpening } from "./loop-turns.ts";
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
  const refused = lock(
    "TreeTurnsBeforeRoot",
    call("turns", "TreeTurnsBefore", [], [item(0), item(1)]),
  ).errors;
  expect(refused.map((e) => e.kind)).toEqual(["openingRefused"]);
  expect(refused.map(lockMessage)).toEqual([
    "invented-turns/0/cards/turns: a volta 1 do laço de TreeTurnsBefore() não tem o item no seu lugar",
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

test("two turns with the same item are a line each, keyed by the number of its turn, in the draft and in the lock (T198)", () => {
  const same = draftOf("TreeTurnsSameRoot").pools[0]?.groups[0]?.sources[0];
  expect(same && shape(same)).toEqual([
    "TreeTurnsSame()",
    [
      ["TreeBase", []],
      ["TreeBase", []],
    ],
  ]);
  expect(same?.children?.map((c) => c.key)).toEqual([
    "tree-base-turn-1",
    "tree-base-turn-2",
  ]);
  const turns = (...keys: string[]) =>
    lock(
      "TreeTurnsSameRoot",
      call(
        "turns",
        "TreeTurnsSame",
        [],
        keys.map((k) => leaf(k, "TreeBase")),
      ),
    ).errors.map(lockMessage);
  expect(turns("tree-base-turn-1", "tree-base-turn-2")).toEqual([]);
  // a turn with no line is a part with no child, by its number; a key with no number of a turn ties to no turn
  expect(turns("tree-base-turn-1")).toEqual([
    "parte não declarada: invented-turns/0/cards/turns: TreeBase (volta 2)",
  ]);
  expect(turns("tree-base", "tree-base-turn-2")).toEqual([
    "fonte fora do gabarito: invented-turns/0/cards/turns/tree-base",
    "parte não declarada: invented-turns/0/cards/turns: TreeBase (volta 1)",
  ]);
});

test("a turn whose item is a part of an expression is refused as no call nor read", () => {
  expect(
    lock(
      "TreeTurnsMixedRoot",
      call("turns", "TreeTurnsMixed", [], [item(0)]),
    ).errors.map(lockMessage),
  ).toEqual([
    "invented-turns/0/cards/turns: o item da volta 1 do laço de TreeTurnsMixed() não é uma chamada nem uma leitura",
  ]);
});

test("a product in a loop, and a sum the call returns with a term after it, open by their own expression, not by turns", () => {
  const sources = (root: string) =>
    draftOf(root).pools[0]?.groups[0]?.sources.map(shape);
  // the product's last step is the last turn's: its call is the level's one part
  expect(sources("TreeTurnsProductRoot")).toEqual([
    ["TreeTurnsProduct()", [["TreeTurnItem(2)", [["TreeList[2]", []]]]]],
  ]);
  // the call returned `t + TreeBase`, a step of its own after the loop
  expect(sources("TreeTurnsThenRoot")).toEqual([
    [
      "TreeTurnsThen()",
      [
        ["TreeTurnItem(2)", [["TreeList[2]", []]]],
        ["TreeBase", []],
      ],
    ],
  ]);
});

test("a loop step that is the last step but not what the call returned does not open into turns", () => {
  // a two-source term's place (lock-parts.ts termExpr) can be the root's own last step, a sum in a loop of 3 turns,
  // when the root returned another value (20) after it
  const turn = (k: number): Expr => ({
    t: "op",
    o: "+",
    l: { t: "val", v: 0 },
    r: { t: "read", p: `TreeList[${String(k)}]`, v: k + 1 },
    v: 0,
  });
  const expr = turn(2);
  const scope = { id: 0, b: "TreeRoot", a: [], c: [], p: null, pxi: 0 };
  const ctx: LevelContext = {
    rec: {
      nodes: [scope],
      writes: [],
      spliced: [],
      bpStart: null,
      setup: null,
      root: null,
      builders: null,
      fromGame: [],
    },
    stepsOf: () => ({ steps: [{ v: 6, e: expr }], checks: [], stepAt: [2] }),
    turnOf: (_n, { from }) => ({
      steps: [],
      checks: [],
      exprOf: () => turn(from),
    }),
    character: 0,
    where: "invented",
  };
  const x: [number, number][] = [
    [7, 1],
    [7, 3],
    [7, 6],
  ];
  expect(loopOpening(expr, { ...scope, v: 6, x }, ctx)).toHaveLength(3);
  expect(loopOpening(expr, { ...scope, v: 20, x }, ctx)).toBeNull();
});
