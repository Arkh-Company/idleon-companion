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

test.each([
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
