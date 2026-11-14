// The game's characters in the mosaic (spec 008 FR-020): their places, the active one's, their classes, and the
// picker's list sent only when it changes. Every name and class is invented.
import { expect, test, vi } from "vitest";
import {
  characterList,
  characterNumber,
  characterSender,
} from "./characters.ts";
import type { Characters } from "../shared/index.ts";
import { mosaicFor } from "./formula-fixture.ts";

test("the character's number is its place in the game's list of characters", () => {
  expect(characterNumber(mosaicFor("Other"))).toBe(1);
  expect(characterNumber(mosaicFor("Nobody"))).toBe(null);
  expect(characterNumber("not json")).toBe(null);
  expect(characterNumber(JSON.stringify({ attrs: {} }))).toBe(null);
});

test("the characters of the game's list, by place, with the active one; none without a reading", () => {
  expect(characterList(mosaicFor("Other"))).toEqual({
    names: ["Invented", "Other"],
    classes: [null, null],
    active: 1,
  });
  expect(characterList(mosaicFor("Nobody"))).toBe(null);
  expect(characterList("not json")).toBe(null);
});

test("the picker's list is sent when it changes, never again for the same list", () => {
  const send = vi.fn();
  const { tell } = characterSender(send);
  tell(mosaicFor("Invented"));
  tell(mosaicFor("Invented", 2)); // a new mosaic, the same list
  tell(mosaicFor("Other"));
  tell(null);
  tell(null);
  expect(send.mock.calls).toEqual([
    [{ names: ["Invented", "Other"], classes: [null, null], active: 0 }],
    [{ names: ["Invented", "Other"], classes: [null, null], active: 1 }],
    [null],
  ]);
});

const CLASSES = ["0", "Novice", "Star Seeker"];
/** The active one's class from the running game; another's from its copy in PlayerDATABASE. */
const withClasses = (active: unknown, other: unknown) => {
  const m = JSON.parse(mosaicFor("Invented")) as { attrs: object };
  Object.assign(m.attrs, {
    CharacterClass: active,
    PlayerDATABASE: {
      $m: {
        Invented: { $m: { CharacterClass: 9 } },
        Other: { $m: { CharacterClass: other } },
      },
    },
  });
  return JSON.stringify(m);
};

test("each character's class comes from the game's class names by its class number", () => {
  expect(characterList(withClasses(2, 1), CLASSES)?.classes).toEqual([
    "Star Seeker",
    "Novice",
  ]);
});

test.each<[string, unknown, unknown, readonly string[] | null]>([
  ["no class table", 1, 2, null],
  ["a class number outside the table", 7, -1, CLASSES],
  ["a class number that is no number", "1", { n: 1 }, CLASSES],
])("%s gives no class", (_name, active, other, classes) => {
  expect(characterList(withClasses(active, other), classes)?.classes).toEqual([
    null,
    null,
  ]);
});

test("the class table read after the list sends it again with the classes", () => {
  const send = vi.fn<(c: Characters) => void>();
  const sender = characterSender(send);
  sender.tables(CLASSES);
  sender.tell(withClasses(1, 2));
  sender.tables(["0", "Novice", "Star Seeker", "Other"]); // the same classes for these characters
  sender.tables(null);
  expect(send.mock.calls.map(([c]) => c?.classes)).toEqual([
    ["Novice", "Star Seeker"],
    [null, null],
  ]);
});

test("the same mosaic is read once: the Stats tells the trees several times per mosaic", () => {
  const read = vi.fn(characterList);
  const { tell } = characterSender(vi.fn(), read);
  const mosaic = mosaicFor("Invented");
  tell(mosaic);
  tell(mosaic);
  expect(read).toHaveBeenCalledOnce();
});

test("a new page gets the last list again", () => {
  const send = vi.fn();
  const sender = characterSender(send);
  sender.replay(); // nothing read yet: no list
  sender.tell(mosaicFor("Other"));
  sender.replay();
  expect(send.mock.calls).toEqual([
    [null],
    [{ names: ["Invented", "Other"], classes: [null, null], active: 1 }],
    [{ names: ["Invented", "Other"], classes: [null, null], active: 1 }],
  ]);
});
