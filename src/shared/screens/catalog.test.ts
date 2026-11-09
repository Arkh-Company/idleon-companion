// The checks every rule of the screen catalog passes. Every rule here is invented.
import { expect, test } from "vitest";
import { KNOWN_WINDOWS, parseScreenCatalog, SCREEN_CATALOG } from "../index.ts";

const REFUSED = /^Invalid screen catalog/;
const good = { when: { menu2: 5 }, name: "Hall", proof: "foto:0001" };

test("the parts join in order", () => {
  const overlay = { ...good, when: { ol18: 1 }, name: "Curtain" };
  const second = { ...good, when: { menu2: 6 }, name: "Attic" };
  expect(
    parseScreenCatalog([
      { overlays: [overlay], screens: [good], unprovenWindows: [7] },
      { screens: [second], unprovenWindows: [8] },
    ]),
  ).toEqual({
    overlays: [overlay],
    screens: [good, second],
    unprovenWindows: [7, 8],
  });
});

test("no parts is an empty catalog", () => {
  expect(parseScreenCatalog([])).toEqual({
    overlays: [],
    screens: [],
    unprovenWindows: [],
  });
});

test.each([
  ["a photo proof", { ...good, proof: "foto:0446" }],
  ["a sprite proof", { ...good, proof: "sprite:Hall_tab2" }],
  ["tabs", { ...good, tabs: true }],
  ["a condition on a text", { ...good, when: { scene: "w1" } }],
  ["a reading field", { ...good, when: { menu2tab: 0 } }],
  ["a simple behavior", { ...good, when: { "H0._TabIndex0to5": 2 } }],
  ["an indexed behavior", { ...good, when: { "H27._GenINFO[124]": 1 } }],
])("a valid rule passes: %s", (_, rule) => {
  expect(parseScreenCatalog([{ screens: [rule] }]).screens).toEqual([rule]);
});

const noProof = { when: good.when, name: good.name };

test.each<[string, unknown]>([
  ["not an object", "Hall"],
  ["null", null],
  ["no proof", noProof],
  ["a proof that is not text", { ...good, proof: 1 }],
  ["a proof of another kind", { ...good, proof: "memo:0001" }],
  ["a proof with no kind", { ...good, proof: "0001" }],
  ["a photo proof with no id", { ...good, proof: "foto:" }],
  ["a sprite proof with no name", { ...good, proof: "sprite:" }],
  ["a proof with a space", { ...good, proof: "foto: 0001" }],
  ["a proof with a line after it", { ...good, proof: "foto:0001\n" }],
  ["no when", { name: good.name, proof: good.proof }],
  ["an empty when", { ...good, when: {} }],
  ["a when that is a list", { ...good, when: [1] }],
  ["a condition on null", { ...good, when: { menu2: null } }],
  ["a condition on a boolean", { ...good, when: { menu2: true } }],
  ["a condition on an object", { ...good, when: { menu2: { a: 1 } } }],
  ["no name", { when: good.when, proof: good.proof }],
  ["a name that is not text", { ...good, name: 1 }],
  ["an empty name", { ...good, name: "" }],
  ["a blank name", { ...good, name: "   " }],
  ["tabs that are not true", { ...good, tabs: false }],
  ["a misspelled field", { ...good, tab: true }],
  ["a text in a number field", { ...good, when: { menu2tab: "2" } }],
  ["a number in a text field", { ...good, when: { scene: 2 } }],
])("an invalid rule is refused: %s", (_, rule) => {
  expect(() => parseScreenCatalog([{ screens: [rule] }])).toThrow(REFUSED);
  expect(() => parseScreenCatalog([{ overlays: [rule] }])).toThrow(REFUSED);
});

test.each([
  "t",
  "char",
  "behaviors",
  "menu3",
  "toString",
  "constructor",
  "H1",
  "H1.",
  "H.x",
  "h1.x",
  "H1.x[]",
  "H1.x[a]",
  "H1.x[1][2]",
  "H1.x[1] ",
  " menu2",
  "H1.x\n",
])("a when key is refused: %j", (key) => {
  expect(() =>
    parseScreenCatalog([{ screens: [{ ...good, when: { [key]: 1 } }] }]),
  ).toThrow(REFUSED);
});

test("a when key that JSON writes as __proto__ is refused", () => {
  const rule: unknown = JSON.parse(
    '{ "when": { "__proto__": 1 }, "name": "Hall", "proof": "foto:0001" }',
  );
  expect(() => parseScreenCatalog([{ screens: [rule] }])).toThrow(REFUSED);
});

test("an invalid rule in a later part is refused", () => {
  expect(() =>
    parseScreenCatalog([{ screens: [good] }, { screens: [noProof] }]),
  ).toThrow(REFUSED);
});

test.each<[string, unknown]>([
  ["a part that is not an object", "rules"],
  ["a part that is null", null],
  ["a part that is a list", [good]],
  ["screens that are not a list", { screens: good }],
  ["overlays that are not a list", { overlays: good }],
  ["windows that are not a list", { unprovenWindows: 7 }],
  ["screens that are null", { screens: null }],
  ["a window that is text", { unprovenWindows: ["7"] }],
  ["a window that is a fraction", { unprovenWindows: [7.5] }],
])("an invalid part is refused: %s", (_, part) => {
  expect(() => parseScreenCatalog([part])).toThrow(REFUSED);
});

test("a number both unproven and in a rule is refused", () => {
  expect(() =>
    parseScreenCatalog([{ screens: [good], unprovenWindows: [5] }]),
  ).toThrow(REFUSED);
});

test("a number unproven in one part and in a rule of another is refused", () => {
  expect(() =>
    parseScreenCatalog([{ screens: [good] }, { unprovenWindows: [5] }]),
  ).toThrow(REFUSED);
  expect(() =>
    parseScreenCatalog([
      { unprovenWindows: [5] },
      { overlays: [{ ...good, when: { menu2: 5, ol18: 1 } }] },
    ]),
  ).toThrow(REFUSED);
});

test("an unproven number that no rule uses passes", () => {
  expect(
    parseScreenCatalog([{ screens: [good], unprovenWindows: [6] }])
      .unprovenWindows,
  ).toEqual([6]);
});

test("the known windows are the 108 of the game", () => {
  const game = Array.from({ length: 111 }, (_, n) => n).filter(
    (n) => ![22, 50, 51].includes(n),
  );
  expect(game).toHaveLength(108);
  expect([...KNOWN_WINDOWS].toSorted((a, b) => a - b)).toEqual(game);
});

test("the known windows are the rules' and the unproven ones", () => {
  const inRules = [...SCREEN_CATALOG.overlays, ...SCREEN_CATALOG.screens]
    .map((rule) => rule.when.menu2)
    .filter((n) => typeof n === "number");
  expect(KNOWN_WINDOWS).toEqual(
    new Set([...inRules, ...SCREEN_CATALOG.unprovenWindows]),
  );
});
