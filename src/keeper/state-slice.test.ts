// The map actors' fields of the live-game trees (spec 008 US12, FR-023): state-slice.js reads them for the actors piece
// through behaviors.cache.h["ActorEvents_N"].script[field], own data properties only, against a fake engine where every
// function and getter is a trap. Every value and name is invented.
import { join } from "node:path";
import { runInThisContext } from "node:vm";
import { expect, test } from "vitest";
import { ACTORS_PIECE } from "../shared/index.ts";
import { HELPER_FIELDS, MONSTER_FIELDS } from "./actor-contract-fixture.ts";
import { loadReadSource } from "./read-source.ts";

let sprung = 0;
function spring(): never {
  sprung++;
  throw new Error("game code touched");
}
const fnTrap = () => new Proxy(() => undefined, { apply: spring });
const withAccessor = <T extends object>(o: T, key: PropertyKey): T =>
  Object.defineProperty(o, key, { enumerable: true, get: spring });

/** An actor with one behavior whose script holds `fields`, beside functions and a getter that must never run. */
function actor(id: number, fields: Record<string, unknown>) {
  const script = withAccessor({ ...fields, fn: fnTrap() }, "_Getter");
  return {
    getValue: fnTrap(),
    behaviors: {
      getBehavior: fnTrap(),
      cache: { h: { [`ActorEvents_${String(id)}`]: { script } } },
    },
  };
}

const map = (h: Record<string, unknown>) => ({ h });
const sparse = (values: Record<number, unknown>) => Object.assign([], values);

/** The contract's helpers, each value unique, and the keys the piece must give for them. */
function helpers() {
  const list: unknown[] = [];
  const expected: Record<string, unknown> = {};
  HELPER_FIELDS.forEach(([n, id, field, indexes], row) => {
    if (indexes === null) {
      list[n] = actor(id, { [field]: [row, `item${String(row)}`] });
      expected[`H${String(n)}.${field}`] = [row, `item${String(row)}`];
      return;
    }
    const values: Record<number, number> = {};
    for (const i of indexes) {
      values[i] = n * 1000 + i;
      expected[`H${String(n)}.${field}[${String(i)}]`] = values[i];
    }
    list[n] = actor(id, { [field]: sparse(values) });
  });
  return { list, expected };
}

const target = actor(1, { _MonsterType: "mobB" });
const monster = actor(1, {
  _MonsterType: "mobA",
  _MonsterHPtot: 4500,
  _RespawnTime: 12,
});

function game(attrs: Record<string, unknown>) {
  return {
    gameAttributes: {
      h: {
        UserInfo: ["Hero"],
        CurrentMap: 7,
        PixelHelperActor: helpers().list,
        MapMonstersList: [monster, actor(1, {})],
        OtherPlayers: map({ Hero: actor(20, { _TargetEnemy: target }) }),
        ...attrs,
      } as Record<string, unknown>,
    },
    getGameAttribute: fnTrap(),
  };
}

/** The actors piece of a slice, with no trap sprung. */
function actors(attrs: Record<string, unknown> = {}): Record<string, unknown> {
  const fn = runInThisContext(
    loadReadSource(join(import.meta.dirname, "state-slice.js")),
  ) as (this: object, paths: string[][]) => { out: unknown[] };
  sprung = 0;
  const out = fn.call(game(attrs), [[ACTORS_PIECE], ["CurrentMap"]]).out;
  expect(sprung).toBe(0);
  expect(out[1]).toBe(7);
  return out[0] as Record<string, unknown>;
}

test("the actors piece has every field of the contract, by property only, and the map it was read on", () => {
  const monsterValues = ["mobA", 4500, 12];
  expect(actors()).toEqual({
    map: 7,
    ...helpers().expected,
    ...Object.fromEntries(
      MONSTER_FIELDS.map((f, i) => [`map0.${f}`, monsterValues[i]]),
    ),
    "target._MonsterType": "mobB",
  });
});

test("an actor that is not there leaves its keys out; a player with no target has none", () => {
  const piece = actors({
    PixelHelperActor: [],
    MapMonstersList: [],
    OtherPlayers: map({ Hero: actor(20, { _TargetEnemy: null }) }),
  });
  expect(piece).toEqual({ map: 7, "target._MonsterType": null });
});

test("a target whose behavior cannot be read leaves the target out, and no player leaves it out too", () => {
  expect(
    actors({ OtherPlayers: map({ Hero: actor(20, { _TargetEnemy: {} }) }) }),
  ).not.toHaveProperty(["target._MonsterType"]);
  expect(actors({ OtherPlayers: map({}) })).not.toHaveProperty([
    "target._MonsterType",
  ]);
});

test("a field missing from a helper reads null, and a field that is no list gives null for its indexes", () => {
  const piece = actors({
    PixelHelperActor: sparse({
      0: actor(29, { _ScrollCircleINFO: 5 }),
      2: actor(167, {}),
    }),
  });
  expect(piece["H0._ScrollCircleINFO[43]"]).toBeNull();
  expect(piece["H2._BuffIDsOn"]).toBeNull();
});

test("a getter in the actor's path is never fired", () => {
  const helper = actor(29, {});
  withAccessor(helper, "behaviors");
  expect(
    actors({ PixelHelperActor: [helper], MapMonstersList: [] }),
  ).not.toHaveProperty(["H0._ScrollCircleINFO[43]"]);
});
