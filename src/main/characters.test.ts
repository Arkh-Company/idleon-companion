// The game's characters in the mosaic (spec 008 FR-020): their places, the active one's, and the picker's list sent only
// when it changes. Every name is invented.
import { expect, test, vi } from "vitest";
import {
  characterList,
  characterNumber,
  characterSender,
} from "./characters.ts";
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
    active: 1,
  });
  expect(characterList(mosaicFor("Nobody"))).toBe(null);
  expect(characterList("not json")).toBe(null);
});

test("the picker's list is sent when it changes, never again for the same list", () => {
  const send = vi.fn();
  const tell = characterSender(send);
  tell(mosaicFor("Invented"));
  tell(mosaicFor("Invented", 2)); // a new mosaic, the same list
  tell(mosaicFor("Other"));
  tell(null);
  tell(null);
  expect(send.mock.calls).toEqual([
    [{ names: ["Invented", "Other"], active: 0 }],
    [{ names: ["Invented", "Other"], active: 1 }],
    [null],
  ]);
});

test("the same mosaic is read once: the Stats tells the trees several times per mosaic", () => {
  const read = vi.fn(characterList);
  const tell = characterSender(vi.fn(), read);
  const mosaic = mosaicFor("Invented");
  tell(mosaic);
  tell(mosaic);
  expect(read).toHaveBeenCalledOnce();
});
