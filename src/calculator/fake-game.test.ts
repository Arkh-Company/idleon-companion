// The invented game has every case the formula trees need (spec 008, T003), each one booted and called by name.
import { beforeAll, expect, test } from "vitest";
import { anchored, bootContext, lazyDnsmKeys } from "./boot.ts";
import type { Context } from "./boot.ts";
import { LIMITS } from "./engine.ts";
import {
  BASE,
  CHARACTERS,
  GAME,
  mosaicOf,
  PAK,
  TREE_CASES,
} from "./fixtures/fake-mosaic.ts";

let context: Context;
beforeAll(() => {
  context = bootContext(anchored(GAME), PAK, LIMITS);
  context.load(mosaicOf(), lazyDnsmKeys(GAME));
});

test.each(TREE_CASES)(
  "$name: $block gives $value",
  ({ block, args, value }) => {
    expect(GAME).toContain(`Blocks._customBlock_${block} = function`);
    expect(context.number(block, args)).toBe(value);
  },
);

test("the two invented characters, one name a prefix of the other", () => {
  const [first, second] = CHARACTERS;
  expect(second.startsWith(first)).toBe(true);
  expect(Object.keys(BASE.PlayerDATABASE.$m)).toEqual([...CHARACTERS]);
});

test("each character has PlayerDATABASE keys of both kinds", () => {
  const sameName = ["CurrentMap", "AFKtarget"];
  const otherName = [
    "CardEquip",
    "CSetEq",
    "Prayers",
    "PldTraps",
    "PlayerAwayTime",
  ];
  for (const name of CHARACTERS) {
    const keys = Object.keys(BASE.PlayerDATABASE.$m[name].$m);
    expect(keys).toEqual(expect.arrayContaining([...sameName, ...otherName]));
  }
  for (const key of sameName) expect(BASE).toHaveProperty(key);
  for (const key of ["Cards", "PrayersActive", "PlacedTraps", "TimeAway"])
    expect(BASE).toHaveProperty(key);
});
