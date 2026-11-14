// The live game's actors in the calculator (spec 008 US12, FR-023): the map actors' fields the keeper read answer the
// game's code from the mosaic's `actors`, in place of what the helpers' init wrote and of the empty map actors. Without
// the actor, the number is unavailable (null). Every value and name is invented.
import { beforeAll, expect, test } from "vitest";
import { anchored, bootContext, lazyDnsmKeys } from "./boot.ts";
import type { Context } from "./boot.ts";
import { LIMITS } from "./engine.ts";
import { BASE, GAME, mosaicOf, PAK } from "./fixtures/fake-mosaic.ts";
import { createTreeEngine } from "./tree-engine.ts";
import { TREE_ROOTS } from "./tree-roots.ts";

const MAP = BASE.CurrentMap;
/** The map actors as the running game has them before they are read: empty places. */
const SCENE = {
  MapMonstersList: [{ $x: 1 }, { $x: 1 }],
  OtherPlayers: { $m: { [BASE.UserInfo[0] ?? ""]: { $x: 1 } } },
};
const MONSTER = {
  "map0._MonsterType": "mobA",
  "map0._MonsterHPtot": 4500,
  "map0._RespawnTime": 12,
};

let context: Context;
beforeAll(() => {
  context = bootContext(anchored(GAME), PAK, LIMITS);
});

function number(
  block: string,
  actors: object,
  attrs: object = SCENE,
): number | null {
  context.load(mosaicOf(attrs, {}, actors), lazyDnsmKeys(GAME));
  return context.number(block, [0, 0, 0]);
}

test("a helper's field the keeper read answers in place of what its init wrote", () => {
  expect(number("TreeHelperField", {})).toBe(7);
  expect(number("TreeHelperField", { map: MAP, "H0._GenINFO[3]": 11 })).toBe(
    11,
  );
});

test("a field read whole comes back in the shape it travels in", () => {
  expect(
    number("TreeHelperWhole", { map: MAP, "H0._Owned": { $m: { k: 4 } } }),
  ).toBe(4);
});

test("the map's first monster answers as a behavior of the game's own class", () => {
  expect(number("TreeMapMonster", { map: MAP, ...MONSTER })).toBe(4500);
});

test("the player's target answers its type, and with no target the game uses AFKtarget", () => {
  const aimed = { map: MAP, "target._MonsterType": "mobB" };
  expect(number("TreeTarget", aimed)).toBe(40);
  expect(number("TreeTarget", { ...aimed, "target._MonsterType": null })).toBe(
    BASE.AFKtarget.length,
  );
});

test("a missing actor gives null: the number is unavailable", () => {
  expect(number("TreeMapMonster", { map: MAP })).toBeNull();
  expect(number("TreeTarget", { map: MAP })).toBeNull();
  expect(number("TreeMapMonster", {})).toBeNull();
});

test("actors read on another map are not this map's: the map actors are missing, the helpers still answer", () => {
  const elsewhere = {
    ...MONSTER,
    map: MAP + 1,
    "target._MonsterType": null,
    "H0._GenINFO[3]": 11,
  };
  expect(number("TreeMapMonster", elsewhere)).toBeNull();
  expect(number("TreeTarget", elsewhere)).toBeNull();
  expect(number("TreeHelperField", elsewhere)).toBe(11);
});

test("a state with no place for the map actors still calculates the rest", () => {
  const actors = { map: MAP, ...MONSTER, "target._MonsterType": "mobB" };
  expect(number("TreeReads", actors, {})).toBe(8);
  expect(number("TreeReads", actors, { ...SCENE, UserInfo: null })).toBe(8);
  expect(number("TreeMapMonster", actors, {})).toBeNull();
});

test("a key that is no helper's field of the contract is left out, and the rest still answers", () => {
  const actors = {
    map: MAP,
    "H99._GenINFO[1]": 5,
    "H0._Nothing[2]": 5,
    "H0.__proto__": { polluted: 1 },
    "map0.__proto__": { polluted: 1 },
    "H0._GenINFO[3]": 11,
  };
  expect(number("TreeHelperField", actors)).toBe(11);
  expect(number("TreeHelperProto", actors)).toBe(0);
  expect(number("TreeMapMonster", actors)).toBeNull();
});

test("a mosaic with no actors at all calculates as before", () => {
  const { actors: _none, ...before } = JSON.parse(mosaicOf(SCENE)) as {
    actors: unknown;
  };
  context.load(JSON.stringify(before), lazyDnsmKeys(GAME));
  expect(context.number("TreeHelperField", [0, 0, 0])).toBe(7);
  expect(context.number("TreeMapMonster", [0, 0, 0])).toBeNull();
});

test("the tree worker records and calculates the live numbers over the same actors", () => {
  const trees = createTreeEngine(GAME, PAK, {
    ...TREE_ROOTS,
    monster: ["TreeMapMonster", [0, 0, 0]],
  });
  const mosaic = mosaicOf(SCENE, {}, { map: MAP, ...MONSTER });
  const root = trees.tree(
    { type: "number", id: "monster", character: 0 },
    mosaic,
  );
  expect(root === "unknownNumber" ? null : root.value).toBe(4500);
  expect(trees.values(["monster"], mosaic)).toEqual({ monster: 4500 });
  expect(trees.values(["monster"], mosaicOf(SCENE))).toEqual({ monster: null });
});
