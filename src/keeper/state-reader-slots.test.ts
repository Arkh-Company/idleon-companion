// The 12 slots of a second, the first lap and the grouping by the catalog (005: FR-014, FR-018, FR-021, research R3, R9).
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ACTIONS_GROUP, CATALOG, groupOf } from "../shared/index.ts";
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
/** Cards and Spice too big to share a slice once measured, so the fast lane has 2 slices from the second read on. */
const hugeFast = (p: StatePath): unknown =>
  p[0] === "Cards" || p[0] === "Spice" ? HUGE : 1;
const lanes = (sent: Parameters<typeof sliceReads>[0]) =>
  sliceReads(sent).map((s) => laneOf(s.paths[0]));

test("after the first lap, 12 slots are 3 actions, 7 fast and 2 slow, in the pattern", async () => {
  const { keys, value } = hugeSlow(5);
  const { sent } = setup({ top: ["Gear", "Cards", "Spice", ...keys], value });
  await tick(5 + 12); // list, 3 slices of the first lap, list, then the slots
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
  await tick(4 + 12);
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
  const { sent, slices } = setup({
    top: [...slow, ...fastKeys(13), "Gear"],
  });
  await tick(6);
  expect(lanes(sent)).toEqual(["actions", "fast", "fast", "slow", "slow"]);
  expect(slices.map((s) => s.cycles.all)).toEqual([0, 0, 0, 0, 1]);
  await tick();
  expect(sent.at(-1)?.source).toBe("LIST");
});

test("a change of character after the first lap starts a new one", async () => {
  const { keys, value } = hugeSlow(2);
  const { game, sent, slices } = setup({
    top: ["Gear", "Cards", "Spice", ...keys],
    value: (p) => (p[0] === "Cards" || p[0] === "Spice" ? HUGE : value(p)),
  });
  await tick(4); // the list and the first lap of 3 slices: every piece is measured
  game.char = "Mate";
  await tick(); // the list sees Mate
  expect(sent.at(-1)?.source).toBe("LIST");
  await tick(5);
  expect(lanes(sent).slice(-5)).toEqual([
    "actions",
    "fast",
    "fast",
    "slow",
    "slow",
  ]);
  expect(slices.slice(-5).map((s) => s.cycles.all)).toEqual([0, 0, 0, 0, 1]);
});

test("a change of character in the middle of the first lap restarts it", async () => {
  const slow = slowKeys(13);
  const { game, sent, slices } = setup({
    top: ["Gear", "Cards", "Spice", ...slow],
    value: hugeFast,
  });
  await tick(2); // the list and the actions
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

/** Four fast pieces too big to share a slice once measured, and a slow pass of two slices. */
const fourFastTwoSlow = () => {
  const fast = fastKeys(4);
  const { keys, value } = hugeSlow(2);
  return {
    top: [...fast, ...keys],
    value: (p: StatePath): unknown => (fast.includes(p[0]) ? HUGE : value(p)),
  };
};
const firstKeysAfter = (sent: Parameters<typeof sliceReads>[0], n: number) =>
  sliceReads(sent)
    .slice(n)
    .map((s) => s.paths[0]?.[0]);

test("a fast piece of the last slice is read on time when the slow pass ends before it", async () => {
  const { sent } = setup(fourFastTwoSlow());
  await tick(4); // the list, the first lap of 2 slices and the second list
  const before = sliceReads(sent).length;
  await tick(11 + 1 + 3); // slots 0 to 10, the list that the end of the slow pass asks for, slots 11 to 13
  expect(firstKeysAfter(sent, before)).toEqual([
    "Fast0", // slot 0, the spare of the actions
    "Fast1",
    "Slow0",
    "Fast2",
    "Fast3",
    "Fast0",
    "Fast1",
    "Fast2",
    "Fast3",
    "Fast0", // slot 9
    "Slow1", // the slow pass ends with the fast lane on its second slice
    "Fast1", // the fast lane goes on from there
    "Fast2",
    "Fast3",
  ]);
});

test("the end of a fast pass that began before the list does not raise the count of all", async () => {
  const { game, sent, slices } = setup(fourFastTwoSlow());
  await tick(4);
  const big = game.value;
  // Measured small from now on: the next list packs the slow pass in one slice, read right after the fast pass ends.
  game.value = (p) => (p[0].startsWith("Slow") ? 1 : big(p));
  await tick(11 + 1 + 3); // up to slot 1: Fast1, Fast2 and Fast3 close the pass begun before the list
  await tick(); // slot 2
  expect(sliceReads(sent).at(-1)?.paths[0]?.[0]).toBe("Slow0");
  expect(slices.at(-1)?.cycles.all).toBe(2);
});

test("a change of map right at the end of the slow pass sends the fast lane back to its start", async () => {
  const { game, sent } = setup(fourFastTwoSlow());
  await tick(4 + 10); // up to slot 9, with the fast lane on its second slice
  game.map = 2;
  await tick(); // Slow1 sees the new map as it ends the pass
  await tick(); // the list
  const before = sliceReads(sent).length;
  await tick();
  expect(firstKeysAfter(sent, before)).toEqual(["Fast0"]);
});

test("a new key in the fast lane starts it again from the first slice", async () => {
  const { game, sent } = setup(fourFastTwoSlow());
  await tick(4 + 11);
  game.top = [...game.top, "Fast4"];
  await tick(); // the list sees the new key
  const before = sliceReads(sent).length;
  await tick();
  expect(firstKeysAfter(sent, before)).toEqual(["Fast0"]);
});

test("the fast count rises when the actions and the other fast slices were all read", async () => {
  const { keys, value } = hugeSlow(5);
  const { slices } = setup({
    top: ["Gear", "Cards", "Spice", ...keys],
    value: (p) => (p[0] === "Cards" || p[0] === "Spice" ? HUGE : value(p)),
  });
  await tick(4);
  expect(slices.map((s) => s.cycles.fast)).toEqual([0, 1, 1]);
  await tick(5); // the list, then actions, fast, slow and fast
  expect(slices.slice(3).map((s) => s.cycles.fast)).toEqual([1, 1, 1, 2]);
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

test("the pieces of a group go side by side, and groups go in the catalog's order", async () => {
  const { sent } = setup({
    top: ["Spice", "ChestMap", "Research", "Cards", "Gear", "GearCache"],
  });
  await tick(5);
  expect(sliceReads(sent).map((s) => s.paths)).toEqual([
    [["Gear"], ["GearCache"]],
    [["Research"], ["Cards"], ["Spice"]],
    [["ChestMap"]],
  ]);
});

test("a group over the limit becomes successive slices, and the next group fills the last one", async () => {
  const keys = fastKeys(13);
  const { sent } = setup({ top: ["Spice", ...keys] });
  await tick(3);
  expect(sliceReads(sent).map((s) => s.paths.length)).toEqual([12, 2]);
  expect(sliceReads(sent)[1]?.paths).toEqual([["Fast12"], ["Spice"]]);
});

test("with the real catalog, a pass of the fast lane fits its 7 slots of a second", async () => {
  const fast = CATALOG.filter(
    (r) => r.reading === "rápida" && r.group !== ACTIONS_GROUP,
  );
  const name = (prefix: string) =>
    fast
      .filter((r) => r.name.startsWith(prefix))
      .map((r) => r.name.slice(prefix.length));
  const bytes = new Map(CATALOG.map((r) => [r.name, r.bytes]));
  const { sent } = setup(
    {
      top: fast.filter((r) => !r.name.includes(".")).map((r) => r.name),
      split: { DNSM: name("DNSM."), PlayerDATABASE: ["Hero"] },
      value: (p) => {
        const row = p.length === 3 ? `Personagem.${p[2]}` : p.join(".");
        return "x".repeat(Math.max((bytes.get(row) ?? 2) - 2, 0));
      },
    },
    undefined,
    CATALOG,
  );
  await tick(40); // the first lap measures every piece; then, more than 2 s of slots
  const secondList = sent.findIndex((s, i) => i > 0 && s.source === "LIST");
  const firstKeys = sent
    .slice(secondList)
    .flatMap((s) => s.paths.slice(0, 1))
    .filter((p) => {
      const group = groupOf(CATALOG, p, "Hero");
      return group !== null && group !== ACTIONS_GROUP;
    })
    .map((p) => p.join("."));
  expect(new Set(firstKeys).size).toBeGreaterThan(1);
  expect(new Set(firstKeys).size).toBeLessThanOrEqual(7);
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
