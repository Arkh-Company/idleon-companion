// The farm measure (spec 008 FR-028, data-model "Medição de farm"; T047): XP, gold and items per hour of the active
// character, only from differences between readings, counted on a map that is not a town, paused in a town, never kept
// on disk. Every value, item and character name here is made up.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import type { FarmUpdate, StateSlice } from "../shared/index.ts";
import { farmTracker, isTown } from "./farm.ts";

const MIN = 60_000;
let t: number;
/** The active character of the slices. */
let who: string | null;
let sent: FarmUpdate[];
let farm: ReturnType<typeof farmTracker>;
beforeEach(() => {
  t = 0;
  who = "Aria";
  sent = [];
  farm = farmTracker({
    send: (f) => sent.push(f),
    now: () => t,
  });
});

type Pieces = Record<string, unknown>;
const slice = (pieces: Pieces): StateSlice => ({
  sentinel: { char: who, map: 5 },
  pieces: Object.entries(pieces).map(([top, value]) => ({
    path: [top],
    value,
  })),
  at: t,
  cycles: { fast: 1, all: 1 },
});
/** The time goes on in readings a second apart, as the reader sends them. */
function wait(ms: number, pieces: Pieces = {}): void {
  for (let i = 0; i < ms / 1000; i++) {
    t += 1000;
    farm.onState(slice(pieces));
  }
}
const state = (pieces: Pieces) => {
  farm.onState(slice(pieces));
};
const snap = () => farm.snapshot();

test("idle until a map that is not a town; a town first does not start it", () => {
  expect(snap().state).toBe("idle");
  farm.onMap(0, true);
  expect(snap().state).toBe("idle");
  farm.onMap(3, false);
  expect(snap()).toMatchObject({ state: "counting", minutes: 0 });
});

test("rates come from differences only: XP, gold and items per hour", () => {
  state({
    Exp0: [100, 5],
    ExpReq0: [1000, 50],
    Money: 1000,
    InventoryOrder: ["Ore", "Blank", "Log"],
    ItemQuantity: [10, 0, 2],
  });
  farm.onMap(3, false);
  wait(30 * MIN);
  // What was there before counting started is not a gain.
  expect(snap()).toMatchObject({
    minutes: 30,
    xpPerHour: 0,
    goldPerHour: 0,
    items: [],
  });
  state({
    Exp0: [400, 5],
    Money: 1500,
    InventoryOrder: ["Ore", "Gem", "Log"],
    ItemQuantity: [16, 1, 2],
  });
  expect(snap()).toEqual({
    state: "counting",
    minutes: 30,
    xpPerHour: 600,
    goldPerHour: 1000,
    items: [
      { name: "Ore", perHour: 12 },
      { name: "Gem", perHour: 2 },
    ],
  });
});

test("a level up counts what was left to the level and the new XP; XP is the skill that gained most", () => {
  state({ Exp0: [900, 10], ExpReq0: [1000, 50] });
  farm.onMap(3, false);
  wait(60 * MIN);
  state({ Exp0: [50, 30], ExpReq0: [1200, 50] });
  // 100 to the level, then 50; the second skill gained 20.
  expect(snap().xpPerHour).toBe(150);
});

test("gold spent and items moved out are not negative gains", () => {
  state({ Money: 1000, InventoryOrder: ["Ore"], ItemQuantity: [10] });
  farm.onMap(3, false);
  wait(60 * MIN);
  state({ Money: 200, InventoryOrder: ["Ore"], ItemQuantity: [2] });
  state({ Money: 500, InventoryOrder: ["Ore"], ItemQuantity: [5] });
  expect(snap()).toMatchObject({
    goldPerHour: 300,
    items: [{ name: "Ore", perHour: 3 }],
  });
});

test("an item moved to another slot is no gain", () => {
  state({ InventoryOrder: ["Ore", "Blank"], ItemQuantity: [10, 0] });
  farm.onMap(3, false);
  wait(60 * MIN);
  state({ InventoryOrder: ["Blank", "Ore"], ItemQuantity: [0, 10] });
  expect(snap().items).toEqual([]);
});

test("a town pauses: no time and no gain there; back on the same map it continues", () => {
  state({ Money: 0 });
  farm.onMap(3, false);
  wait(10 * MIN);
  state({ Money: 100 });
  farm.onMap(0, true);
  expect(snap()).toMatchObject({ state: "paused", minutes: 10 });
  // Gold from selling in town is not farmed.
  wait(20 * MIN, { Money: 900 });
  expect(snap()).toMatchObject({
    state: "paused",
    minutes: 10,
    goldPerHour: 600,
  });
  farm.onMap(3, false);
  wait(10 * MIN, { Money: 1100 });
  expect(snap()).toMatchObject({
    state: "counting",
    minutes: 20,
    goldPerHour: 900,
  });
});

test("another map restarts the count, from a town or straight from the map", () => {
  state({ Money: 0 });
  farm.onMap(3, false);
  wait(10 * MIN);
  state({ Money: 100 });
  farm.onMap(4, false);
  expect(snap()).toMatchObject({
    state: "counting",
    minutes: 0,
    goldPerHour: 0,
  });
  wait(10 * MIN);
  farm.onMap(0, true);
  farm.onMap(7, false);
  expect(snap()).toMatchObject({ state: "counting", minutes: 0 });
});

test("a character change, or none, goes back to idle and forgets the values", () => {
  state({ Money: 1000 });
  farm.onMap(3, false);
  wait(10 * MIN);
  who = "Bryn";
  state({ Money: 50 });
  expect(snap().state).toBe("idle");
  farm.onMap(3, false);
  // The other character's gold is the new start, not a loss or a gain.
  wait(60 * MIN, { Money: 150 });
  expect(snap().goldPerHour).toBe(100);
  who = null;
  state({});
  expect(snap().state).toBe("idle");
});

test("a closed game resets to idle, and the reset is sent", () => {
  farm.onMap(3, false);
  wait(MIN);
  farm.reset();
  expect(snap()).toEqual({
    state: "idle",
    minutes: 0,
    xpPerHour: 0,
    goldPerHour: 0,
    items: [],
  });
  expect(sent.at(-1)?.state).toBe("idle");
});

test("time stops when the readings stop: a gap longer than a few seconds is not counted", () => {
  farm.onMap(3, false);
  wait(MIN);
  t += 60 * MIN;
  state({});
  expect(snap().minutes).toBe(1);
});

test("what changed across a gap with no reading is no gain: the slice after it is the new start", () => {
  state({ Money: 0 });
  farm.onMap(3, false);
  wait(60 * MIN, { Money: 100 });
  expect(snap().goldPerHour).toBe(100);
  t += 60 * MIN;
  state({ Money: 5000 });
  expect(snap().goldPerHour).toBe(100);
  // A reading first after the gap, as when the reader comes back, does not close it.
  t += 60 * MIN;
  farm.onMap(3, false);
  state({ Money: 9000 });
  expect(snap().goldPerHour).toBe(100);
  // From there, the gains count again.
  wait(1000, { Money: 9100 });
  expect(snap().goldPerHour).toBeGreaterThan(100);
});

test("sends at once on a change of state, else at most every 10 s", () => {
  farm.onMap(3, false);
  expect(sent).toHaveLength(1);
  expect(sent[0]?.state).toBe("counting");
  wait(9000);
  expect(sent).toHaveLength(1);
  wait(1000);
  expect(sent).toHaveLength(2);
  farm.onMap(0, true);
  expect(sent.at(-1)?.state).toBe("paused");
  farm.replay();
  expect(sent.at(-1)).toEqual(snap());
});

test("items take the game's names when the table has them, else the game's id", () => {
  farm.tables({ maps: null, monsters: null, items: { Ore: "Copper Ore" } });
  state({ InventoryOrder: ["Ore", "Log"], ItemQuantity: [1, 1] });
  farm.onMap(3, false);
  wait(60 * MIN, { InventoryOrder: ["Ore", "Log"], ItemQuantity: [3, 2] });
  expect(snap().items).toEqual([
    { name: "Copper Ore", perHour: 2 },
    { name: "Log", perHour: 1 },
  ]);
});

test("pieces of the wrong shape are no gain and do not throw", () => {
  state({ Money: 10, Exp0: [1], InventoryOrder: ["Ore"], ItemQuantity: [1] });
  farm.onMap(3, false);
  wait(60 * MIN);
  state({
    Money: "lots",
    Exp0: ["x"],
    InventoryOrder: [1],
    ItemQuantity: null,
  });
  state({ Money: 20, Exp0: [2], InventoryOrder: ["Ore"], ItemQuantity: [2] });
  expect(snap()).toMatchObject({
    xpPerHour: 1,
    goldPerHour: 10,
    items: [{ name: "Ore", perHour: 1 }],
  });
});

// The game's own test of a town, on the scene's name (the map's MapName), proven on the captured readings of the screen
// catalog: the town of each world is its first map, 0, 50, 100…; every other scene is not a town.
test("a town is a scene whose name has Town, as the game tests it, proven on captured readings", () => {
  const file = join(
    import.meta.dirname,
    "../shared/screens/fixtures/captured-states.jsonl",
  );
  const towns = new Set<number>();
  const others = new Set<number>();
  for (const line of readFileSync(file, "utf8").trim().split("\n")) {
    const { reading } = JSON.parse(line) as {
      reading: { map: number; scene: string | null; char: string | null };
    };
    if (reading.scene === null || reading.char === null) continue;
    (isTown(reading.scene) ? towns : others).add(reading.map);
  }
  expect([...towns].toSorted((a, b) => a - b)).toEqual([
    0, 50, 100, 150, 200, 250, 300,
  ]);
  expect([...others].some((m) => towns.has(m))).toBe(false);
});

test("nothing of the farm goes to disk", () => {
  const source = readFileSync(join(import.meta.dirname, "farm.ts"), "utf8");
  expect(source).not.toMatch(/from "node:/);
  expect(source).not.toMatch(/saved-files/);
});
