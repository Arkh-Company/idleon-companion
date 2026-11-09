// The 12 slots of a second, the first lap and the grouping by the catalog (005: FR-014, FR-018, FR-021, research R3, R9).
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { StatePath } from "../shared/index.ts";
import {
  actionKeys,
  fastKeys,
  laneOf,
  setup,
  sliceReads,
  slowKeys,
  tick,
} from "./state-reader-fixture.ts";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const HUGE = "x".repeat(25_001);
/** Slow pieces too big to share a slice once measured: their pass outlasts the 12 slots of a test. */
const hugeSlow = (n: number) => {
  const keys = slowKeys(n);
  return {
    keys,
    value: (p: StatePath): unknown => (keys.includes(p[0]) ? HUGE : 1),
  };
};
const lanes = (sent: Parameters<typeof sliceReads>[0]) =>
  sliceReads(sent).map((s) => laneOf(s.paths[0]));

test("after the first lap, 12 slots are 3 actions, 7 fast and 2 slow, in the pattern", async () => {
  const { keys, value } = hugeSlow(5);
  const { sent } = setup({ top: ["Gear", "Cards", "Spice", ...keys], value });
  await tick(6 + 12); // list, 4 slices of the first lap, list, then the slots
  const slots = lanes(sent).slice(-12);
  expect(slots).toEqual([
    "actions",
    "fast",
    "slow",
    "fast",
    "actions",
    "fast",
    "fast",
    "fast",
    "actions",
    "fast",
    "slow",
    "fast",
  ]);
  expect(slots.filter((l) => l === "actions")).toHaveLength(3);
  expect(slots.filter((l) => l === "fast")).toHaveLength(7);
  expect(slots.filter((l) => l === "slow")).toHaveLength(2);
});

test("with no actions piece their slots go to the other fast slices", async () => {
  const { keys, value } = hugeSlow(5);
  const { sent } = setup({ top: ["Cards", "Spice", ...keys], value });
  await tick(5 + 12);
  expect(lanes(sent).slice(-12)).toEqual([
    "fast",
    "fast",
    "slow",
    "fast",
    "fast",
    "fast",
    "fast",
    "fast",
    "fast",
    "fast",
    "slow",
    "fast",
  ]);
});

test("with only the actions piece and the slow ones, the fast slots go to the actions", async () => {
  const { keys, value } = hugeSlow(5);
  const { sent } = setup({ top: ["Gear", ...keys], value });
  await tick(4 + 12);
  expect(new Set(lanes(sent).slice(-12))).toEqual(new Set(["actions", "slow"]));
  expect(
    lanes(sent)
      .slice(-12)
      .filter((l) => l === "slow"),
  ).toHaveLength(2);
});

test("the first lap takes every slot: actions, then fast, then slow, and only then the count of all rises", async () => {
  const slow = slowKeys(13);
  const { sent, slices } = setup({ top: [...slow, "Spice", "Cards", "Gear"] });
  await tick(6);
  expect(lanes(sent)).toEqual(["actions", "fast", "fast", "slow", "slow"]);
  expect(slices.map((s) => s.cycles.all)).toEqual([0, 0, 0, 0, 1]);
  await tick();
  expect(sent.at(-1)?.source).toBe("LIST");
});

test("a change of character restarts the first lap", async () => {
  const slow = slowKeys(13);
  const { game, sent, slices } = setup({
    top: ["Gear", "Cards", "Spice", ...slow],
  });
  await tick(3); // the list, the actions and one fast slice
  game.char = "Mate";
  await tick(2); // the slice that sees Mate and then the list
  expect(sent.at(-1)?.source).toBe("LIST");
  const before = sliceReads(sent).length;
  await tick(5);
  expect(
    sliceReads(sent)
      .slice(before)
      .map((s) => laneOf(s.paths[0])),
  ).toEqual(["actions", "fast", "fast", "slow", "slow"]);
  expect(slices.at(-2)?.cycles.all).toBe(0);
  expect(slices.at(-1)?.cycles.all).toBe(1);
});

test("the fast count rises when the actions and the other fast slices were all read", async () => {
  const { keys, value } = hugeSlow(5);
  const { slices } = setup({ top: ["Gear", "Cards", "Spice", ...keys], value });
  await tick(5);
  expect(slices.map((s) => s.cycles.fast)).toEqual([0, 0, 1, 1]);
  await tick(5); // the list, then actions, fast, slow and fast
  expect(slices.slice(4).map((s) => s.cycles.fast)).toEqual([1, 1, 1, 2]);
});

test("a change of map restarts the pass of the actions too", async () => {
  const keys = actionKeys(25); // 3 slices: the map changes in the second one
  const { game, sent, slices } = setup({ top: [...keys, "Cards", "ChestMap"] });
  await tick(2);
  game.map = 2;
  await tick(2);
  expect(sliceReads(sent).map((s) => s.paths[0]?.[0])).toEqual([
    "Act0",
    "Act12",
    "Act0",
  ]);
  expect(slices.at(-1)?.cycles.fast).toBe(0);
});

test("after a change of map, the fast count waits for the actions to be read again", async () => {
  const { keys, value } = hugeSlow(5);
  const { game, slices } = setup({ top: ["Gear", "Cards", ...keys], value });
  await tick(5); // the first lap and the second list
  game.map = 2;
  await tick(5); // slots 0 to 4: actions (they see the map), fast, slow, fast, actions
  expect(slices.slice(-5).map((s) => s.cycles.fast)).toEqual([0, 0, 0, 0, 1]);
});

test("the pieces of a group travel together, and groups go in the catalog's order", async () => {
  const { sent } = setup({
    top: ["Spice", "ChestMap", "Research", "Cards", "Gear", "GearCache"],
  });
  await tick(5);
  expect(sliceReads(sent).map((s) => s.paths)).toEqual([
    [["Gear"], ["GearCache"]],
    [["Research"], ["Cards"]],
    [["Spice"]],
    [["ChestMap"]],
  ]);
});

test("a group over the limit becomes successive slices", async () => {
  const keys = fastKeys(13);
  const { sent } = setup({ top: ["Spice", ...keys] });
  await tick(4);
  expect(sliceReads(sent).map((s) => s.paths.length)).toEqual([12, 1, 1]);
  expect(sliceReads(sent)[2]?.paths).toEqual([["Spice"]]);
});

test("a piece over the limit goes alone once measured", async () => {
  const { sent } = setup({
    top: ["Fast0", "Fast1", "ChestMap"],
    value: (p) => (p[0] === "Fast0" ? HUGE : 1),
  });
  await tick(6); // list, the first lap of 2 slices, list, 2 slices
  expect(sliceReads(sent).map((s) => s.paths)).toEqual([
    [["Fast0"], ["Fast1"]],
    [["ChestMap"]],
    [["Fast0"]],
    [["Fast1"]],
  ]);
});

test("a fast subkey of the character travels as a path of three", async () => {
  const { sent } = setup({
    top: [],
    split: { PlayerDATABASE: ["Hero", "Mate"] },
  });
  await tick(2);
  expect(sent.at(-1)?.paths).toEqual([["PlayerDATABASE", "Hero", "Skills"]]);
});

test("the slow subkeys are not read apart from the whole character", async () => {
  const { sent } = setup({
    top: [],
    split: { PlayerDATABASE: ["Hero", "Mate"] },
  });
  await tick(4);
  const read = sliceReads(sent).flatMap((s) => s.paths);
  expect(read).toEqual([
    ["PlayerDATABASE", "Hero", "Skills"],
    ["PlayerDATABASE", "Hero"],
    ["PlayerDATABASE", "Mate"],
  ]);
});

test("no subkey is read for a character the list does not give", async () => {
  const { sent } = setup({ top: ["Cards"] });
  await tick(3);
  expect(sliceReads(sent).flatMap((s) => s.paths)).toEqual([["Cards"]]);
});

test("a piece the catalog does not know is read as slow", async () => {
  const { sent, slices, onFailing } = setup({
    top: ["Cards", "NeverCataloged"],
  });
  await tick(3);
  expect(sliceReads(sent).map((s) => s.paths)).toEqual([
    [["Cards"]],
    [["NeverCataloged"]],
  ]);
  expect(slices.at(-1)?.cycles.all).toBe(1);
  expect(onFailing).not.toHaveBeenCalled();
});

test("reads never overlap, even when each takes longer than a slot", async () => {
  const h = setup({ top: ["Gear", "Cards", ...slowKeys(3)] });
  h.h.latency = 200;
  await tick(12);
  expect(h.sent).toHaveLength(4); // starts at 83, 332, 581 and 830 ms: the slots between them are skipped
});
