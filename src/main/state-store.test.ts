// The mosaic in memory (FR-022). Every value and character name here is made up (FR-021).
import { expect, test } from "vitest";
import { STATE_EXCLUDED, VARS_KEYS } from "../shared/index.ts";
import type { StatePath, StateSlice } from "../shared/index.ts";
import { createStateStore } from "./state-store.ts";

type Piece = StateSlice["pieces"][number];
interface Mosaic {
  attrs: Record<string, unknown>;
  vars: Record<string, unknown>;
  skipped: string[];
}

const WHOLE = { formula: 1, all: 1 };
const NONE = { formula: 0, all: 0 };

function setup() {
  const dues: Mosaic[] = [];
  const texts: string[] = [];
  const chars: (string | null)[] = [];
  const store = createStateStore({
    onDue: (json) => {
      texts.push(json);
      dues.push(JSON.parse(json) as Mosaic);
    },
    onCharacter: (c) => chars.push(c),
  });
  const add = (
    pieces: Piece[],
    cycles = NONE,
    sentinel: StateSlice["sentinel"] = { char: "Aria", map: 5 },
  ) => {
    store.add({ sentinel, pieces, at: 1, cycles });
  };
  return { store, add, dues, texts, chars };
}
const piece = (top: string, value: unknown): Piece => ({
  path: [top],
  value,
});

test("the newest value of a piece wins", () => {
  const h = setup();
  h.add([piece("Cards", 1)]);
  h.add([piece("Cards", 2)], WHOLE);
  expect(h.dues[0]?.attrs).toEqual({ Cards: 2 });
});

test("a two-item path lands in the $m of its split map", () => {
  const h = setup();
  h.add([]);
  h.add(
    [
      { path: ["PlayerDATABASE", "Aria"], value: 1 },
      { path: ["PlayerDATABASE", "Bruno"], value: 2 },
      { path: ["DNSM", "CompanionBon"], value: 3 },
    ],
    WHOLE,
  );
  expect(h.dues[0]?.attrs).toEqual({
    PlayerDATABASE: { $m: { Aria: 1, Bruno: 2 } },
    DNSM: { $m: { CompanionBon: 3 } },
  });
});

test("the _vars land in vars, and only the keys of the closed list", () => {
  const h = setup();
  h.add([]);
  h.add(
    [piece("_vars", { [VARS_KEYS[0] ?? ""]: 4, notOnTheList: "FAKE" })],
    WHOLE,
  );
  expect(h.dues[0]?.vars).toEqual({ [VARS_KEYS[0] ?? ""]: 4 });
  expect(h.dues[0]?.attrs).toEqual({});
});

test.each([[null], [7], ["x"], [[1]]])("a _vars of %j keeps nothing", (v) => {
  const h = setup();
  h.add([]);
  h.add([piece("_vars", v)], WHOLE);
  expect(h.dues[0]?.vars).toEqual({});
});

test("the excluded keys never enter the mosaic", () => {
  const h = setup();
  h.add([]);
  h.add([...STATE_EXCLUDED.map((k) => piece(k, 1)), piece("Cards", 1)], WHOLE);
  expect(Object.keys(h.dues[0]?.attrs ?? {})).toEqual(["Cards"]);
});

test("nothing is due before a whole rotation of both classes", () => {
  const h = setup();
  h.add([piece("Cards", 1)], { formula: 3, all: 0 });
  expect(h.texts).toEqual([]);
});

test("the map changing before the first whole rotation holds the first calculation", () => {
  const h = setup();
  h.add([]);
  h.add([piece("Cards", 1)], { formula: 0, all: 1 });
  expect(h.texts).toEqual([]);
  h.add([piece("Cards", 1)], { formula: 1, all: 1 });
  expect(h.texts).toHaveLength(1);
});

test("an app that joins a game already counting waits for a rotation it saw whole", () => {
  const h = setup();
  h.add([piece("Cards", 1)], { formula: 7, all: 3 });
  h.add([], { formula: 8, all: 4 }); // only closes the rotation it joined halfway through
  expect(h.texts).toEqual([]);
  h.add([], { formula: 9, all: 5 });
  expect(h.texts).toHaveLength(1);
});

test("a first slice with formula rotations already counted is a late join too", () => {
  const h = setup();
  h.add([piece("Cards", 1)], { formula: 2, all: 0 });
  h.add([], { formula: 3, all: 1 });
  expect(h.texts).toEqual([]);
  h.add([], { formula: 4, all: 2 });
  expect(h.texts).toHaveLength(1);
});

test("the first calculation is due once, as the JSON of attrs, vars and skipped", () => {
  const h = setup();
  h.add([]);
  h.add([piece("Cards", 1)], WHOLE);
  h.add([piece("Cards", 1)], WHOLE);
  expect(h.texts).toEqual([
    JSON.stringify({
      attrs: { Cards: 1 },
      vars: {},
      skipped: STATE_EXCLUDED,
    }),
  ]);
});

test("after the first, one is due only when a formula value changed and the rotation count rose", () => {
  const h = setup();
  h.add([]);
  h.add([piece("Cards", 1)], WHOLE);
  h.add([piece("Cards", 2)], WHOLE); // changed, no rise
  expect(h.texts).toHaveLength(1);
  h.add([], { formula: 2, all: 1 }); // a rise after the change
  expect(h.texts).toHaveLength(2);
  expect(h.dues[1]?.attrs).toEqual({ Cards: 2 });
  h.add([piece("Cards", 2)], { formula: 3, all: 1 }); // a rise, nothing changed
  expect(h.texts).toHaveLength(2);
});

test("a change only in an other value is not due", () => {
  const h = setup();
  h.add([]);
  h.add([piece("ChestMap", 1)], WHOLE);
  h.add([piece("ChestMap", 2)], { formula: 2, all: 2 });
  expect(h.texts).toHaveLength(1);
});

test("the active character's own piece is a formula value", () => {
  const h = setup();
  const own = (value: number): Piece => ({
    path: ["PlayerDATABASE", "Aria"],
    value,
  });
  h.add([]);
  h.add([own(1)], WHOLE);
  h.add([own(2)], { formula: 2, all: 1 });
  expect(h.texts).toHaveLength(2);
});

test("a new character wipes the pieces and vars and is told", () => {
  const h = setup();
  const bruno = { char: "Bruno", map: 5 };
  h.add([]);
  h.add([piece("Cards", "of Aria"), piece("_vars", { TomePct: 9 })], WHOLE);
  h.add([piece("Money", "of Bruno")], NONE, bruno);
  h.add([], WHOLE, bruno);
  expect(h.chars).toEqual(["Aria", "Bruno"]);
  expect(h.dues).toHaveLength(2);
  expect(h.dues[1]?.attrs).toEqual({ Money: "of Bruno" });
  expect(h.dues[1]?.vars).toEqual({});
});

test("a new map keeps the pieces, tells nothing, and waits for the rotation count to rise", () => {
  const h = setup();
  h.add([]);
  h.add([piece("Cards", 1), piece("Money", 1)], WHOLE);
  h.add([piece("Cards", 2)], { formula: 0, all: 1 }, { char: "Aria", map: 6 });
  expect(h.texts).toHaveLength(1);
  expect(h.chars).toEqual(["Aria"]);
  h.add([], { formula: 1, all: 1 }, { char: "Aria", map: 6 });
  expect(h.texts).toHaveLength(2);
  expect(h.dues[1]?.attrs).toEqual({ Cards: 2, Money: 1 });
});

test("no character is a wipe, and its pieces are not kept", () => {
  const h = setup();
  h.add([]);
  h.add([piece("Cards", "of Aria")], WHOLE);
  h.add([piece("Money", "ghost")], WHOLE, { char: null, map: 0 });
  expect(h.chars).toEqual(["Aria", null]);
  expect(h.texts).toHaveLength(1);
  h.add([piece("Skills", 1)], WHOLE);
  expect(h.chars).toEqual(["Aria", null, "Aria"]);
  expect(h.texts).toHaveLength(1); // the counts on that slice are not of this mosaic
  h.add([], { formula: 2, all: 3 });
  expect(h.dues[1]?.attrs).toEqual({ Skills: 1 });
});

test("clear wipes and tells nothing, and the same character starts over", () => {
  const h = setup();
  h.add([]);
  h.add([piece("Cards", "of Aria"), piece("_vars", { TomePct: 9 })], WHOLE);
  h.store.clear();
  expect(h.chars).toEqual(["Aria"]);
  h.add([piece("Money", 1)], WHOLE);
  expect(h.chars).toEqual(["Aria", "Aria"]);
  expect(h.texts).toHaveLength(1); // the counts on that slice are not of this mosaic
  h.add([], { formula: 2, all: 3 });
  expect(h.dues[1]?.attrs).toEqual({ Money: 1 });
  expect(h.dues[1]?.vars).toEqual({});
});

test("after clear with high counts, nothing is due on the next slice", () => {
  const h = setup();
  h.add([]);
  h.add([piece("Cards", 1)], { formula: 9, all: 4 });
  expect(h.texts).toHaveLength(1);
  h.store.clear();
  h.add([piece("Cards", 1)], { formula: 10, all: 5 });
  expect(h.texts).toHaveLength(1);
});

const HOSTILE: StatePath[] = [
  ["__proto__"],
  ["__proto__", "x"],
  ["x", "__proto__"],
  ["constructor", "x"],
  ["PlayerDATABASE", "__proto__"],
];

test.each(HOSTILE)("a path %j pollutes no prototype", (...path) => {
  const before = Object.getOwnPropertyNames(Object.prototype);
  const h = setup();
  h.add([]);
  h.add([{ path, value: { polluted: true } }, piece("Cards", 1)], WHOLE);
  expect(Object.getOwnPropertyNames(Object.prototype)).toEqual(before);
  expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  expect(h.dues[0]?.attrs.Cards).toBe(1);
  expect(h.texts[0]).not.toContain("polluted");
});

test("a __proto__ piece cannot shadow a split map of the mosaic", () => {
  const h = setup();
  h.add([]);
  h.add(
    [
      { path: ["__proto__"], value: { PlayerDATABASE: 1 } },
      { path: ["PlayerDATABASE", "Aria"], value: 2 },
    ],
    WHOLE,
  );
  expect(h.dues[0]?.attrs).toEqual({
    PlayerDATABASE: { $m: { Aria: 2 } },
  });
});

test("a two-item path outside the split maps, or a split map sent whole, is dropped", () => {
  const h = setup();
  h.add([]);
  h.add(
    [
      piece("Cards", 5),
      { path: ["Cards", "x"], value: 6 },
      piece("PlayerDATABASE", 7),
      { path: ["PlayerDATABASE", "Aria"], value: 8 },
    ],
    WHOLE,
  );
  expect(h.dues[0]?.attrs).toEqual({
    Cards: 5,
    PlayerDATABASE: { $m: { Aria: 8 } },
  });
});
