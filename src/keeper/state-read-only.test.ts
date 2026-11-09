// Read-only proof of the state slices (FR-002, FR-003): state-list.js and state-slice.js run against a fake engine where
// every function and getter is a trap. In this test's realm on purpose: the scripts compare with the page's own prototypes.
import { join } from "node:path";
import { runInThisContext } from "node:vm";
import { expect, test } from "vitest";
import { STATE_EXCLUDED, STATE_SPLIT } from "../shared/index.ts";
import { loadReadSource } from "./read-source.ts";

let sprung = 0;
function spring(): never {
  sprung++;
  throw new Error("game code touched");
}
const fnTrap = () => new Proxy(() => undefined, { apply: spring });
const withAccessor = <T extends object>(o: T, key: PropertyKey): T =>
  Object.defineProperty(o, key, { enumerable: true, get: spring });

const mapOn = (proto: object, h: unknown): object =>
  Object.assign(Object.create(proto) as object, { h });
const stringMap = (h: unknown): object =>
  mapOn({ __class__: { __name__: "haxe.ds.StringMap" } }, h);

function game(attrs: Record<string, unknown> = {}) {
  return {
    gameAttributes: {
      h: { UserInfo: ["Hero"], CurrentMap: 7, ...attrs } as Record<
        string,
        unknown
      >,
    },
    getGameAttribute: fnTrap(),
  };
}
type Engine = ReturnType<typeof game>;

const footprint = (engine: object) => {
  const attrs = (engine as Partial<Engine>).gameAttributes;
  return [globalThis, engine, ...(attrs ? [attrs, attrs.h] : [])].map((o) =>
    Reflect.ownKeys(o).map(String),
  );
};

function run(file: string, engine: object, args: unknown[]): unknown {
  const before = footprint(engine);
  const fn = runInThisContext(
    loadReadSource(join(import.meta.dirname, file)),
  ) as (this: object, ...a: unknown[]) => unknown;
  sprung = 0;
  const out = fn.apply(engine, args);
  expect(sprung).toBe(0);
  expect(footprint(engine)).toEqual(before);
  return out;
}

interface Listed {
  char: string | null;
  map: number | null;
  top: string[];
  split: Record<string, string[]>;
}
interface Sliced {
  char: string | null;
  map: number | null;
  out: unknown[];
}
const list = (engine: Engine = game()) =>
  run("state-list.js", engine, []) as Listed;
const slice = (engine: Engine, paths: string[][]) =>
  run("state-slice.js", engine, [paths]) as Sliced;
const copy = (value: unknown) => slice(game({ V: value }), [["V"]]).out[0];
/** With `null` for the paths, the script copies its own `this`: how the objects of the `_vars` are read. */
const copySelf = (target: object) => run("state-slice.js", target, [null]);

const nest = (n: number, leaf: unknown = 1): unknown =>
  n === 0 ? leaf : { a: nest(n - 1, leaf) };

test("the list gives the character, the map and the keys", () => {
  expect(list(game({ Cards: [1], ChestMap: { a: 1 } }))).toEqual({
    char: "Hero",
    map: 7,
    top: ["UserInfo", "CurrentMap", "Cards", "ChestMap"],
    split: {},
  });
});

test("the list leaves out the excluded tables and the split maps", () => {
  const attrs: Record<string, unknown> = { Cards: 1 };
  for (const key of STATE_EXCLUDED) attrs[key] = [1];
  for (const key of STATE_SPLIT) attrs[key] = stringMap({ x: 1 });
  expect(list(game(attrs)).top).toEqual(["UserInfo", "CurrentMap", "Cards"]);
});

test("the list gives the children of each split map", () => {
  const out = list(
    game({
      PlayerDATABASE: stringMap({ Hero: { a: 1 }, Sidekick: { a: 2 } }),
      DNSM: stringMap({ CompanionBon: [1] }),
    }),
  );
  expect(out.split).toEqual({
    PlayerDATABASE: ["Hero", "Sidekick"],
    DNSM: ["CompanionBon"],
  });
});

test("a split key that is not a map is listed whole", () => {
  const out = list(game({ DNSM: 5 }));
  expect(out.top).toContain("DNSM");
  expect(out.split).toEqual({});
});

test("a key named like a property of Object is still listed", () => {
  expect(list(game({ constructor: 5 })).top).toContain("constructor");
});

test.each([
  ["no UserInfo", { UserInfo: undefined }],
  ["an empty UserInfo", { UserInfo: [] }],
  ["a first item that is not text", { UserInfo: [3] }],
  ["a UserInfo that is not a list", { UserInfo: "Hero" }],
])("%s gives a null character in both scripts", (_name, attrs) => {
  expect(list(game(attrs)).char).toBeNull();
  expect(slice(game(attrs), []).char).toBeNull();
});

test("a map that is not a number reads as null in both scripts", () => {
  const attrs = { CurrentMap: "seven" };
  expect(list(game(attrs)).map).toBeNull();
  expect(slice(game(attrs), []).map).toBeNull();
});

test("an accessor on the sentinel's keys is never fired", () => {
  const engine = game();
  withAccessor(engine.gameAttributes.h, "UserInfo");
  withAccessor(engine.gameAttributes.h, "CurrentMap");
  expect(list(engine)).toMatchObject({ char: null, map: null });
  expect(slice(engine, [])).toMatchObject({ char: null, map: null });
});

test("an accessor on a top key is not listed", () => {
  const engine = game({ Cards: 1 });
  withAccessor(engine.gameAttributes.h, "Trapped");
  expect(list(engine).top).toEqual(["UserInfo", "CurrentMap", "Cards"]);
});

test("the slice answers the sentinel and one value per path", () => {
  expect(slice(game({ Cards: 3, Money: "x" }), [["Cards"], ["Money"]])).toEqual(
    { char: "Hero", map: 7, out: [3, "x"] },
  );
});

test.each([
  ["a number", 4.5],
  ["zero", 0],
  ["a text", "abc"],
  ["true", true],
  ["false", false],
  ["null", null],
  ["a list", [1, "a", [null]]],
  ["a plain object", { a: 1, b: { c: "x" } }],
])("%s is copied as it is", (_name, value) => {
  expect(copy(value)).toEqual(value);
});

test("an object with no prototype is copied", () => {
  const o = Object.assign(Object.create(null) as object, { a: 1 });
  expect(copy(o)).toEqual({ a: 1 });
});

test("a map becomes $m and $c", () => {
  expect(copy(stringMap({ a: 1, b: stringMap({ c: 2 }) }))).toEqual({
    $m: { a: 1, b: { $m: { c: 2 }, $c: "haxe.ds.StringMap" } },
    $c: "haxe.ds.StringMap",
  });
});

test.each([
  ["Infinity", Infinity, "Infinity"],
  ["minus Infinity", -Infinity, "-Infinity"],
  ["NaN", NaN, "NaN"],
])("%s becomes $n", (_name, value, text) => {
  expect(copy(value)).toEqual({ $n: text });
});

test("a String object becomes text, with no method of its own run", () => {
  const s = Object.assign(new String("hello"), {
    valueOf: fnTrap(),
    toString: fnTrap(),
  });
  withAccessor(s, Symbol.toStringTag);
  expect(copy(s)).toBe("hello");
});

test("undefined becomes null", () => {
  expect(copy([undefined])).toEqual([null]);
  expect(copy(undefined)).toBeNull();
});

test("a class instance becomes $x", () => {
  class Thing {
    x = 1;
  }
  expect(copy(new Thing())).toEqual({ $x: 1 });
});

test("a function becomes $x and is not called", () => {
  expect(copy([fnTrap()])).toEqual([{ $x: 1 }]);
});

test("a cycle becomes $x", () => {
  const o: Record<string, unknown> = { a: 1 };
  o.self = o;
  expect(copy(o)).toEqual({ a: 1, self: { $x: 1 } });
});

test("the same object twice is not a cycle", () => {
  const s = { a: 1 };
  expect(copy([s, s])).toEqual([{ a: 1 }, { a: 1 }]);
});

test("objects are copied to depth 14 and $x from then on", () => {
  expect(copy(nest(15))).toEqual(nest(15));
  expect(copy(nest(16))).toEqual(nest(15, { $x: 1 }));
});

test("a missing path gives null in its place and no error", () => {
  expect(
    slice(game({ Cards: 3 }), [["Nope"], ["Cards"], ["Nope", "x"]]).out,
  ).toEqual([null, 3, null]);
});

test("a two-item path reads the child of the map", () => {
  const engine = game({ DNSM: stringMap({ CompanionBon: [9], Other: 1 }) });
  expect(
    slice(engine, [
      ["DNSM", "CompanionBon"],
      ["DNSM", "Missing"],
    ]).out,
  ).toEqual([[9], null]);
});

test("a two-item path into something that is not a map gives null", () => {
  expect(slice(game({ Cards: 3 }), [["Cards", "x"]]).out).toEqual([null]);
});

test("an accessor on a game object's property is skipped", () => {
  expect(copy(withAccessor({ a: 1 }, "secret"))).toEqual({ a: 1 });
});

test("an accessor for a map's h makes it a class instance", () => {
  const m = mapOn({ __class__: { __name__: "x" } }, null);
  Object.defineProperty(m, "h", { enumerable: true, get: spring });
  expect(copy(m)).toEqual({ $x: 1 });
});

test("an accessor for __class__ gives no class name", () => {
  const proto = withAccessor({}, "__class__");
  expect(copy(mapOn(proto, { a: 1 }))).toEqual({ $m: { a: 1 }, $c: null });
});

test("an accessor for __name__ gives no class name", () => {
  const proto = { __class__: withAccessor({}, "__name__") };
  expect(copy(mapOn(proto, { a: 1 }))).toEqual({ $m: { a: 1 }, $c: null });
});

test("a __class__ inherited from further up gives no class name", () => {
  const proto = Object.create({
    __class__: { __name__: "haxe.ds.StringMap" },
  }) as object;
  expect(copy(mapOn(proto, { a: 1 }))).toEqual({ $m: { a: 1 }, $c: null });
});

test("a toJSON is never run, accessor or function", () => {
  expect(copy(withAccessor({ a: 1 }, "toJSON"))).toEqual({ a: 1 });
  expect(copy({ a: 1, toJSON: fnTrap() })).toEqual({ a: 1, toJSON: { $x: 1 } });
});

test("a Symbol.toStringTag accessor is never read", () => {
  expect(copy(withAccessor({ a: 1 }, Symbol.toStringTag))).toEqual({ a: 1 });
});

test.each([
  ["a plain object", { a: 1, b: [2, { c: "x" }] }],
  ["a list", [1, "a", null]],
])("with null, the script copies its this: %s", (_name, target) => {
  expect(copySelf(target)).toEqual(target);
});

test("with null, a map of this becomes $m and $c", () => {
  expect(copySelf(stringMap({ a: 1 }))).toEqual({
    $m: { a: 1 },
    $c: "haxe.ds.StringMap",
  });
});

test("copying this fires no accessor, on it or inside it", () => {
  const inner = withAccessor({ b: 2 }, "trapped");
  expect(copySelf(withAccessor({ a: 1, inner }, "trapped"))).toEqual({
    a: 1,
    inner: { b: 2 },
  });
  expect(copySelf([withAccessor({ b: 2 }, "trapped")])).toEqual([{ b: 2 }]);
});

test("copying this calls no function, not even a toJSON", () => {
  expect(copySelf({ a: 1, f: fnTrap(), toJSON: fnTrap() })).toEqual({
    a: 1,
    f: { $x: 1 },
    toJSON: { $x: 1 },
  });
  expect(copySelf(fnTrap())).toEqual({ $x: 1 });
});

test("copying this leaves nothing on what it copies", () => {
  const inner = { b: 2 };
  const target = { a: inner };
  copySelf(target);
  expect(Reflect.ownKeys(target)).toEqual(["a"]);
  expect(Reflect.ownKeys(inner)).toEqual(["b"]);
});

test("the slice writes nothing on what it copies", () => {
  const value = { a: 1 };
  const inner = { b: 2 };
  const map = stringMap(inner);
  copy([value, map]);
  expect(Reflect.ownKeys(value)).toEqual(["a"]);
  expect(Reflect.ownKeys(inner)).toEqual(["b"]);
  expect(Reflect.ownKeys(map)).toEqual(["h"]);
});
