// The state of the invented game (fake-game.js) as a mosaic, for the calculator's tests. Every name and number is made
// up: the two characters are invented, and one name is a prefix of the other (FR-010).
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const GAME = readFileSync(
  join(import.meta.dirname, "fake-game.js"),
  "utf8",
);
export const PAK = new Uint8Array([7, 8, 9]);

/** The active character first. */
export const CHARACTERS = ["Wren", "Wrenna"] as const;

/** One character's keys in `PlayerDATABASE`: the same name as in the state, and the other names (research R5). */
const player = (map: number, card: string, prayer: number) => ({
  $m: {
    CurrentMap: map,
    AFKtarget: "mushA",
    CardEquip: [card],
    CSetEq: ["setA"],
    Prayers: [prayer, prayer + 1],
    PldTraps: [[map, 0]],
    PlayerAwayTime: 100 + map,
  },
});

export const BASE = {
  AFKtarget: "mushA",
  Base: { $m: { hp: 500, acc: 7 }, $c: "haxe.ds.StringMap" },
  Damage: [120, 80],
  Stats: { STR: 11, AGI: 12, WIS: 13, LUK: 14, Drop_Rarity: 2.5 },
  AfkRate: 1.5,
  DNSM: {
    $m: {
      CompanionBon: { $m: { b1: 3 } },
      ShinyBonusS: { $m: { s1: 4 } },
      GameCache: { $m: { v: 5 } },
    },
  },
  // The tree cases (fake-game.js, "The cases of the formula trees").
  TreeStats: { $m: { a: 3, b: 5 } },
  TreeBase: 4,
  TreeList: [1, 2, 3],
  TreeCapped: 80,
  TreeLevel: 25,
  TreeOwned: 0,
  TreeLabel: "Plain label",
  TreeTwins: [3, 3],
  TreeFlagOn: 1,
  TreeBig: { $m: { k1: 1, k2: 7 } },
  // The active character's own keys, as the game keeps them outside PlayerDATABASE.
  UserInfo: [CHARACTERS[0]],
  CurrentMap: 3,
  Cards: [[], [], ["cardA"], ["setA"]],
  PrayersActive: [1, 2],
  PlacedTraps: [[3, 0]],
  TimeAway: { Player: 103 },
  ObolEquippedOrder: [["obolA"], ["obolB"]],
  PlayerDATABASE: {
    $m: {
      [CHARACTERS[0]]: player(3, "cardA", 1),
      [CHARACTERS[1]]: player(7, "cardB", 4),
    },
  },
};

export const mosaicOf = (attrs: object = {}, vars: object = {}): string =>
  JSON.stringify({ attrs: { ...BASE, ...attrs }, vars, skipped: [] });

/** Each tree case of the invented game: its block, its exact arguments and the value it gives over `mosaicOf()`. */
export const TREE_CASES: {
  name: string;
  block: string;
  args: (string | number)[];
  value: number;
}[] = [
  { name: "state reads", block: "TreeReads", args: [0, 0, 0], value: 8 },
  {
    name: "a cache written by a helper",
    block: "TreeCacheRead",
    args: [0, 0, 0],
    value: 9,
  },
  {
    name: "the helper's cache, read by its writer",
    block: "TreeCacheFill",
    args: [0, 0, 0],
    value: 8,
  },
  { name: "a loop", block: "TreeLoop", args: [0, 0, 0], value: 6 },
  {
    name: "a text value and the character's name",
    block: "TreeTextValue",
    args: [0, 0, 0],
    value: 15,
  },
  {
    name: "a string literal in the code",
    block: "TreeStringLiteral",
    args: [0, 0, 0],
    value: 1,
  },
  {
    name: "a block called twice",
    block: "TreeTwice",
    args: [0, 0, 0],
    value: 16,
  },
  {
    name: "a call with several sources",
    block: "TreeSources",
    args: [0, 0, 0],
    value: 52,
  },
  { name: "a min cap", block: "TreeMinCap", args: [0, 0, 0], value: 50 },
  {
    name: "a decay curve with a maximum",
    block: "TreeDecay",
    args: [0, 0, 0],
    value: 8,
  },
  { name: "a ×1 multiplier", block: "TreeTimesOne", args: [0, 0, 0], value: 4 },
  {
    name: "a Condition that is no",
    block: "TreeConditionNo",
    args: [0, 0, 0],
    value: 4,
  },
  {
    name: "a map actor with _MonsterHPtot",
    block: "TreeMapActor",
    args: [0, 0, 0],
    value: 0,
  },
  {
    name: "the active character's keys",
    block: "TreeCharacter",
    args: [0, 0, 0],
    value: 6,
  },
  {
    name: "a search of the game",
    block: "TreeSearch",
    args: [0, 0, 0],
    value: 5,
  },
  {
    name: "a cache from the running game",
    block: "TreeGameCache",
    args: [0, 0, 0],
    value: 5,
  },
  {
    name: "a character's key and name",
    block: "TreePlayer",
    args: [0, 0, 0],
    value: 4,
  },
];
