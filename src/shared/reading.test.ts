// The shape check of a reading, used by the keeper on read.js's value and by the app on each link message.
import { expect, test } from "vitest";
import { toReading } from "./index.ts";

const base = {
  map: 264,
  menu: 3,
  menu2: 0,
  menu2tab: 0,
  skillTab: 18,
  char: "Darkhe",
  afk: "w6d3",
  codexTab: 0,
  codexSel: "Scripticus",
  scene: "w1",
  attack: 2,
  bag: 1,
  ol1: 0,
  ol3: 0,
  ol18: 1,
  ol19: -1,
  ola489: 0.2,
  nd37: 0,
  hole: -1,
  behaviors: {
    "H0._TabIndex0to5": 1,
    "H3._GenINFO[8]": "text",
    "H5._GenINFO[1]": true,
    "H6._GenINFO[2]": null,
  },
};

test("toReading keeps a well-formed value and stamps the time", () => {
  expect(toReading(base, 7)).toEqual({ t: 7, ...base });
});

test("toReading accepts the nullable fields as null", () => {
  const empty = { ...base, char: null, afk: null, codexTab: null };
  expect(toReading({ ...empty, codexSel: null }, 7)).toEqual({
    t: 7,
    ...empty,
    codexSel: null,
  });
  expect(toReading({ ...base, codexSel: 4 }, 7)?.codexSel).toBe(4);
});

const NUMBER_OR_NULL = [
  "attack",
  "bag",
  "ol1",
  "ol3",
  "ol18",
  "ol19",
  "ola489",
  "nd37",
  "hole",
];

test.each(["scene", ...NUMBER_OR_NULL])("toReading accepts %s as null", (f) => {
  const value = { ...base, [f]: null };
  expect(toReading(value, 7)).toEqual({ t: 7, ...value });
});

test("toReading accepts an empty behaviors", () => {
  expect(toReading({ ...base, behaviors: {} }, 7)?.behaviors).toEqual({});
});

test.each(NUMBER_OR_NULL)("toReading refuses text in %s", (f) => {
  expect(toReading({ ...base, [f]: "0" }, 7)).toBeNull();
});

test.each([
  ["a scene that is a number", { ...base, scene: 1 }],
  ["no scene", { ...base, scene: undefined }],
  ["no behaviors", { ...base, behaviors: undefined }],
  ["behaviors as an array", { ...base, behaviors: [] }],
  ["behaviors as null", { ...base, behaviors: null }],
  ["an object as a behavior value", { ...base, behaviors: { a: {} } }],
  ["an array as a behavior value", { ...base, behaviors: { a: [1] } }],
  ["a missing number", { ...base, map: undefined }],
  ["a number field with text", { ...base, menu2tab: "0" }],
  ["a character that is not text", { ...base, char: 1 }],
  ["an AFK target that is not text", { ...base, afk: {} }],
  ["a Codex tab that is not a number", { ...base, codexTab: "2" }],
  ["a Codex selection that is an object", { ...base, codexSel: {} }],
  ["no object at all", null],
])("toReading refuses %s", (_name, value) => {
  expect(toReading(value, 7)).toBeNull();
});
