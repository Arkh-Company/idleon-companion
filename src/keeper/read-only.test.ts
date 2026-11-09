// Read-only proof (spec §7.2): read.js runs against a fake engine where every function throws when called.
import { join } from "node:path";
import { Script, runInNewContext } from "node:vm";
import { expect, test } from "vitest";
import { READ_CONTRACT } from "./read-contract-fixture.ts";
import { loadReadSource } from "./read-source.ts";

// Counted as well as thrown: read.js catches errors on the behavior paths, so a throw alone can go unseen.
let gameCalls = 0;

const trap = () =>
  new Proxy(() => undefined, {
    apply() {
      gameCalls++;
      throw new Error("game function called");
    },
  });

/** [PixelHelperActor index, ActorEvents number, field, value]. */
type Behavior = [number, number, string, unknown];

/** A PixelHelperActor list holding `rows`; the actors and scripts carry functions that must never be called. */
function actors(rows: Behavior[]): unknown[] {
  interface Actor {
    getValue: unknown;
    behaviors: {
      cache: { h: Record<string, { script: Record<string, unknown> }> };
    };
  }
  const list: Actor[] = [];
  for (const [n, id, field, value] of rows) {
    list[n] ??= { getValue: trap(), behaviors: { cache: { h: {} } } };
    const events = list[n].behaviors.cache.h;
    events[`ActorEvents_${String(id)}`] ??= { script: { fn: trap() } };
    const entry = events[`ActorEvents_${String(id)}`];
    if (entry) entry.script[field] = value;
  }
  return list;
}

const sparse = (values: Record<number, unknown>) => Object.assign([], values);

function engine(attrs: Record<string, unknown>, top: Record<string, unknown>) {
  const g = {
    CurrentMap: 264,
    MenuType: 3,
    MenuType2: 44,
    MenuType2TabSelected: 2,
    SkillTabSelected: 18,
    UserInfo: ["Tester"],
    AFKtarget: "w6d3",
    AttackSelected: 1,
    InventorySelected: 2,
    OptionsList: sparse({
      1: 4,
      3: 5,
      9: 77,
      12: 0,
      13: [1, 0, "Scripticus", 0],
      18: 0,
      19: 7,
    }),
    OptionsListAccount: sparse({ 489: 9 }),
    NONdummies: sparse({ 37: 6 }),
    Holes: [[3, 8]],
    // An array with a trap for a method: the reader walks it by index, with property reads only.
    GetPlayersUsernames: Object.assign(["Someone", "Tester"], {
      indexOf: trap(),
    }),
    PixelHelperActor: actors([
      [0, 29, "_TabIndex0to5", 2],
      [21, 510, "_GenINFO", sparse({ 16: 1, 51: 0, 59: 3 })],
    ]),
    NonCloudsave: [[0, 0, null, 0]],
    someFn: trap(),
    ...attrs,
  };
  return { gameAttributes: { h: g }, getGameAttribute: trap(), ...top };
}

function read(
  attrs: Record<string, unknown> = {},
  top: Record<string, unknown> = { scene: { name: "w1" } },
): Record<string, unknown> {
  const src = loadReadSource(join(import.meta.dirname, "read.js"));
  const fn = runInNewContext(src) as (this: unknown) => Record<string, unknown>;
  gameCalls = 0;
  const out = fn.call(engine(attrs, top));
  expect(gameCalls).toBe(0);
  return out;
}

/** The contract as behaviors whose every value is unique, and the keys they must produce. */
function contractGame() {
  const expected: Record<string, unknown> = {};
  const rows: Behavior[] = READ_CONTRACT.map(([n, id, field, indexes], row) => {
    if (indexes === null) {
      expected[`H${String(n)}.${field}`] = row;
      return [n, id, field, row];
    }
    const values: Record<number, number> = {};
    for (const i of indexes) {
      values[i] = n * 1000 + i;
      expected[`H${String(n)}.${field}[${String(i)}]`] = values[i];
    }
    return [n, id, field, sparse(values)];
  });
  return { rows, expected };
}

test("read.js calls no game function", () => {
  expect(read()).toEqual({
    map: 264,
    menu: 3,
    menu2: 44,
    menu2tab: 2,
    skillTab: 18,
    char: "Tester",
    afk: "w6d3",
    codexTab: 0,
    codexSel: "Scripticus",
    scene: "w1",
    attack: 1,
    bag: 2,
    ol1: 4,
    ol3: 5,
    ol18: 0,
    ol19: 7,
    ola489: 9,
    nd37: 6,
    hole: 8,
    behaviors: {
      "H0._TabIndex0to5": 2,
      "H0._MenuType2TabPage": null,
      "H0._AnvilTabSelected": null,
      "H21._GenINFO[16]": 1,
      "H21._GenINFO[51]": 0,
      "H21._GenINFO[59]": 3,
    },
  });
});

test("every behavior of the contract is read under its exact field name", () => {
  const { rows, expected } = contractGame();
  expect(read({ PixelHelperActor: actors(rows) }).behaviors).toEqual(expected);
});

test("a behavior under another casing of the field is not read", () => {
  const out = read({
    PixelHelperActor: actors([[2, 167, "_GenINFO", sparse({ 0: 1 })]]),
  });
  expect(out.behaviors).toEqual({ "H2._GeneralInfo[0]": null });
});

test("the Arcade's two fields are read", () => {
  const { behaviors } = read() as { behaviors: Record<string, unknown> };
  expect(behaviors["H21._GenINFO[51]"]).toBe(0);
  expect(behaviors["H21._GenINFO[59]"]).toBe(3);
});

test.each([
  ["no list of actors", undefined],
  ["an empty list of actors", []],
  ["an actor without behaviors", [{}]],
  ["an actor without its events", [{ behaviors: { cache: { h: {} } } }]],
  [
    "an event without a script",
    [{ behaviors: { cache: { h: { ActorEvents_29: {} } } } }],
  ],
])("%s gives no key and no error", (_name, PixelHelperActor) => {
  expect(read({ PixelHelperActor }).behaviors).toEqual({});
});

test("a missing behavior does not stop the others", () => {
  const out = read({ PixelHelperActor: actors([[5, 232, "_GenINFO", []]]) });
  expect(Object.keys(out.behaviors as object)).toEqual([
    "H5._GenINFO[1]",
    "H5._GenINFO[17]",
    "H5._GenINFO[72]",
  ]);
});

test.each([
  ["an object", {}],
  ["an array", [1]],
  ["a function", trap()],
  ["a missing value", undefined],
])("%s as a behavior value reads as null", (_name, value) => {
  const out = read({
    PixelHelperActor: actors([
      [0, 29, "_TabIndex0to5", value],
      [2, 167, "_GeneralInfo", sparse({ 0: value })],
    ]),
  });
  expect(out.behaviors).toMatchObject({
    "H0._TabIndex0to5": null,
    "H2._GeneralInfo[0]": null,
  });
});

test.each([
  ["a number", 4],
  ["a text", "x"],
  ["a boolean", false],
])("%s as a behavior value is kept", (_name, value) => {
  const out = read({
    PixelHelperActor: actors([[0, 29, "_TabIndex0to5", value]]),
  });
  expect(out.behaviors).toMatchObject({ "H0._TabIndex0to5": value });
});

test("the cave follows the character's place in the usernames", () => {
  const first = { UserInfo: ["Someone"] };
  expect(read(first).hole).toBe(3);
  expect(read().hole).toBe(8);
});

test("the usernames never appear in the reading", () => {
  expect(JSON.stringify(read())).not.toContain("Someone");
});

test.each([
  ["a character not in the usernames", { UserInfo: ["Nobody"] }],
  ["no character", { UserInfo: undefined }],
  ["a character that is not text", { UserInfo: [undefined], Holes: [[1]] }],
  ["no cave for that character", { Holes: [[3]] }],
  ["a cave that is not a number", { Holes: [[3, {}]] }],
  ["no first list of caves", { Holes: [] }],
])("%s reads the cave as null", (_name, attrs) => {
  expect(read(attrs).hole).toBeNull();
});

test("an empty username never matches an absent character", () => {
  const out = read({
    UserInfo: [],
    GetPlayersUsernames: [undefined],
    Holes: [[3]],
  });
  expect(out.hole).toBeNull();
});

test("every absent global reads as null", () => {
  const absent = {
    AttackSelected: undefined,
    InventorySelected: undefined,
    OptionsList: undefined,
    OptionsListAccount: undefined,
    NONdummies: undefined,
    Holes: undefined,
    GetPlayersUsernames: undefined,
    PixelHelperActor: undefined,
  };
  const out = read(absent, {});
  expect(out).toMatchObject({
    scene: null,
    attack: null,
    bag: null,
    ol1: null,
    ol3: null,
    ol18: null,
    ol19: null,
    ola489: null,
    nd37: null,
    hole: null,
  });
  expect(out.behaviors).toEqual({});
});

test("a global of the wrong type reads as null", () => {
  const out = read(
    { AttackSelected: "1", InventorySelected: {} },
    { scene: { name: 3 } },
  );
  expect(out).toMatchObject({ scene: null, attack: null, bag: null });
});

test("what the contract leaves out is never read", () => {
  const out = read({
    PixelHelperActor: actors([
      [0, 29, "_NPCtalkingTo", "Someone"],
      [18, 1, "x", 1],
      [21, 510, "_GenINFO", sparse({ 1: 5 })],
    ]),
    MenuType2: 35,
  });
  const behaviors = Object.keys(out.behaviors as object);
  expect(behaviors).not.toContain("H0._NPCtalkingTo");
  expect(behaviors.filter((k) => k.startsWith("ARC."))).toEqual([]);
  expect(behaviors.filter((k) => k.startsWith("H18"))).toEqual([]);
  for (const key of ["npc", "caixas38", "otherPlayer", "ol9"])
    expect(out).not.toHaveProperty(key);
  expect(JSON.stringify(out)).not.toContain("Someone");
});

test("no AFK target reads as null", () => {
  expect(read({ AFKtarget: undefined }).afk).toBeNull();
});

test("the Friends tab selects the friend's name", () => {
  const out = read({
    OptionsList: Object.assign([], { 12: 5 }),
    NonCloudsave: [[0, 0, "Bob", 0]],
  });
  expect(out.codexSel).toBe("Bob");
});

test("outside a character the character is null", () => {
  expect(read({ UserInfo: undefined }).char).toBeNull();
});

test("an empty UserInfo reads the character as null", () => {
  expect(read({ UserInfo: [] }).char).toBeNull();
});

test("a short OptionsList reads the Codex tab as null", () => {
  expect(read({ MenuType: 0, OptionsList: [] }).codexTab).toBeNull();
});

test("the reading has no probe section", () => {
  expect(read()).not.toHaveProperty("probe");
});

test("the loader drops whole-line comments and the final semicolon", () => {
  const src = loadReadSource(join(import.meta.dirname, "read.js"));
  expect(src.startsWith("(function")).toBe(true);
  expect(src).not.toMatch(/^\s*\/\//m);
  // Runtime.callFunctionOn wraps the declaration in parentheses, where a `;` is a syntax error.
  expect(src.endsWith(")")).toBe(true);
  expect(() => new Script(`(${src})`)).not.toThrow();
});
