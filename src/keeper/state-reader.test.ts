// The plan and the rotation of the state reader: a fake `send`, fake timers and invented keys (FR-001, FR-002, FR-022).
// The slots and the first lap of 005 are in state-reader-slots.test.ts.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { StatePath } from "../shared/index.ts";
import {
  fastKeys,
  laneOf,
  setup,
  sliceReads,
  tick,
} from "./state-reader-fixture.ts";
import { pack, pieceBytes } from "./state-reader.ts";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const piece = (path: StatePath, bytes: number | null = null) => ({
  path,
  bytes,
});

test("pieces are grouped up to the limit, in order", () => {
  const [a, b, c] = [
    piece(["A"], 10_000),
    piece(["B"], 15_000),
    piece(["C"], 1),
  ];
  expect(pack([a, b, c], 25_000)).toEqual([[a, b], [c]]);
});

test("a piece larger than the limit goes alone", () => {
  const [a, big, c] = [
    piece(["A"], 10),
    piece(["B"], 25_001),
    piece(["C"], 10),
  ];
  expect(pack([a, big, c], 25_000)).toEqual([[a], [big], [c]]);
});

test("nothing to pack gives no group", () => {
  expect(pack([], 25_000)).toEqual([]);
});

test.each([
  ["a child of PlayerDATABASE", ["PlayerDATABASE", "A"], 25_000],
  ["PlayerDATABASE itself", ["PlayerDATABASE"], 2_000],
  ["a child of another map", ["DNSM", "A"], 2_000],
  ["a top key", ["Cards"], 2_000],
] as const)("unread, %s counts %d", (_name, path, bytes) => {
  expect(pieceBytes(piece([...path] as StatePath))).toBe(bytes);
});

test("a piece already read counts its measure, even zero", () => {
  expect(pieceBytes(piece(["PlayerDATABASE", "A"], 40))).toBe(40);
  expect(pieceBytes(piece(["Cards"], 0))).toBe(0);
});

test("the first cycle never groups a character, and a read one is grouped by its size", async () => {
  const { sent } = setup({
    top: ["Cards"],
    split: { PlayerDATABASE: ["Hero", "Mate", "Pal"] },
  });
  await tick(14);
  const others = sliceReads(sent)
    .map((s) => s.paths)
    .filter((p) => p.some((x) => x[1] === "Mate" || x[1] === "Pal"));
  expect(others.slice(0, 2)).toEqual([
    [["PlayerDATABASE", "Mate"]],
    [["PlayerDATABASE", "Pal"]],
  ]);
  expect(others[2]).toEqual([
    ["PlayerDATABASE", "Hero"],
    ["PlayerDATABASE", "Mate"],
    ["PlayerDATABASE", "Pal"],
  ]);
});

test("the slices are packed at the limit of 25,000 bytes", async () => {
  const { sent } = setup({ top: fastKeys(13) });
  await tick(3);
  expect(sliceReads(sent).map((s) => s.paths.length)).toEqual([12, 1]);
});

test("one read every 83 ms, on the engine, by value", async () => {
  const { sent } = setup();
  await vi.advanceTimersByTimeAsync(82);
  expect(sent).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(1);
  expect(sent.map((s) => s.source)).toEqual(["LIST"]);
  await tick(2);
  expect(sent).toHaveLength(3);
  expect(sent[1]).toEqual({
    source: "SLICE",
    paths: [["Cards"]],
    objectId: "O",
    sessionId: "S",
    returnByValue: true,
  });
});

test.each([
  ["slow", ["Cards"], "fast"],
  ["fast", ["ChestMap"], "slow"],
])("with no %s piece the other class takes its turn", async (_e, top, cls) => {
  const { sent } = setup({ top });
  await tick(9);
  const classes = sliceReads(sent).map((s) => laneOf(s.paths[0]));
  expect(classes.length).toBeGreaterThanOrEqual(4);
  expect(new Set(classes)).toEqual(new Set([cls]));
});

test("no second read starts while one is in flight", async () => {
  const h = setup();
  let open: () => void = () => undefined;
  h.h.gate = new Promise((r) => (open = r));
  await tick(3);
  expect(h.sent).toHaveLength(1);
  h.h.gate = null;
  open();
  await tick();
  expect(h.sent).toHaveLength(2);
});

test("the 1 s reader counts through the same turn", async () => {
  const h = setup();
  let open: () => void = () => undefined;
  const poll = h.turn(() => new Promise<void>((r) => (open = r)));
  await tick(2);
  expect(h.sent).toHaveLength(0);
  open();
  await poll;
  await vi.advanceTimersByTimeAsync(0);
  expect(h.sent).toHaveLength(1);
});

test("a round trip longer than 83 ms skips the next slot", async () => {
  const h = setup();
  h.h.latency = 100;
  await tick(); // the list leaves at 83 and answers at 183
  await tick(); // 166: skipped
  h.h.latency = 0;
  await vi.advanceTimersByTimeAsync(82); // 248
  expect(h.sent).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1); // 249
  expect(h.sent).toHaveLength(2);
});

test("no character: only the list, and no slice", async () => {
  const { sent, slices } = setup({ char: null });
  await tick(4);
  expect(sent.map((s) => s.source)).toEqual(["LIST", "LIST", "LIST", "LIST"]);
  expect(slices).toEqual([]);
});

test("no character and no map is not a failure", async () => {
  const h = setup();
  h.h.answer = () => ({
    result: { value: { char: null, map: null, top: [], split: {} } },
  });
  await tick(12);
  expect(h.onFailing).not.toHaveBeenCalled();
});

test("a character leaving during a slice gives no slice and lists again", async () => {
  const { game, sent, slices } = setup();
  await tick(2);
  expect(slices).toHaveLength(1);
  game.char = null;
  await tick(2);
  expect(slices).toHaveLength(1);
  expect(sent.map((s) => s.source)).toEqual(["LIST", "SLICE", "SLICE", "LIST"]);
});

test("each slice carries the sentinel the game answered and its time", async () => {
  vi.setSystemTime(1_000_000);
  const { game, slices } = setup({ value: () => "v" });
  await tick(2);
  expect(slices).toEqual([
    {
      sentinel: { char: "Hero", map: 1 },
      pieces: [{ path: ["Cards"], value: "v" }],
      at: 1_000_166,
      cycles: { fast: 1, all: 0 },
    },
  ]);
  game.map = 2;
  await tick();
  expect(slices[1]?.sentinel).toEqual({ char: "Hero", map: 2 });
});

test("the cycles rise with the last slice of a whole rotation", async () => {
  const { slices } = setup();
  await tick(5); // list, first lap of 2 slices, list, one slice
  expect(slices.map((s) => s.cycles)).toEqual([
    { fast: 1, all: 0 },
    { fast: 1, all: 1 },
    { fast: 2, all: 1 },
  ]);
});

test("a rotation counts only when its last slice is read", async () => {
  const { slices } = setup({ top: [...fastKeys(13), "ChestMap"] });
  await tick(3);
  expect(slices.map((s) => s.cycles.fast)).toEqual([0, 1]);
});

test("a whole rotation needs both classes", async () => {
  const { slices } = setup({
    top: ["Cards"],
    split: { PlayerDATABASE: ["Mate", "Pal"] },
  });
  await tick(3);
  expect(slices.map((s) => s.cycles.all)).toEqual([0, 0]);
  await tick();
  expect(slices.map((s) => s.cycles.all)).toEqual([0, 0, 1]);
});

test("the keys are listed again at the start of each whole rotation", async () => {
  const { game, sent } = setup();
  await tick(3);
  game.top = ["Research", "ChestMap"];
  await tick(2);
  expect(sent.map((s) => s.source)).toEqual([
    "LIST",
    "SLICE",
    "SLICE",
    "LIST",
    "SLICE",
  ]);
  expect(sent.at(-1)?.paths).toEqual([["Research"]]);
});

test("a change of map zeroes the fast count and keeps the whole one", async () => {
  const { game, slices } = setup();
  await tick(5); // the first lap, the second list and one slice: { 2, 1 }
  expect(slices.at(-1)?.cycles).toEqual({ fast: 2, all: 1 });
  game.map = 2;
  await tick();
  expect(slices.at(-1)?.cycles).toEqual({ fast: 0, all: 1 });
  await tick(3); // the slow slice ends the rotation, the list, one fast slice
  expect(slices.at(-1)?.cycles).toEqual({ fast: 1, all: 2 });
});

test("a change of map throws away the partial fast rotation", async () => {
  const keys = fastKeys(25);
  const { game, sent, slices } = setup({ top: [...keys, "ChestMap"] });
  await tick(2);
  game.map = 2;
  await tick(2);
  expect(sliceReads(sent).map((s) => s.paths.length)).toEqual([12, 12, 12]);
  expect(sent.at(-1)?.paths[0]).toEqual([keys[0]]);
  expect(slices.at(-1)?.cycles.fast).toBe(0);
});

test("a change of character zeroes both counts and lists again", async () => {
  const { game, sent, slices } = setup();
  await tick(4);
  game.char = "Mate";
  await tick();
  expect(slices.at(-1)).toMatchObject({
    sentinel: { char: "Mate" },
    cycles: { fast: 0, all: 0 },
  });
  await tick();
  expect(sent.at(-1)?.source).toBe("LIST");
});

test("a change of character seen by the list zeroes both counts", async () => {
  const { game, slices } = setup();
  await tick(3); // the first lap ends: the next read is the list
  game.char = "Mate";
  await tick(2);
  expect(slices.at(-1)?.cycles).toEqual({ fast: 1, all: 0 });
});

test("the class of a piece follows the character the list answered", async () => {
  const { sent } = setup({
    char: "Mate",
    top: ["ChestMap"],
    split: { PlayerDATABASE: ["Hero", "Mate"] },
  });
  await tick(2); // the fast reading comes first, and it has the subkey of Mate, not of Hero
  expect(sent.at(-1)?.paths).toEqual([["PlayerDATABASE", "Mate", "Skills"]]);
});

test("an engine of null reads nothing, and it is asked for at each slot", async () => {
  const h = setup();
  h.h.ref = null;
  await tick(4);
  expect(h.sent).toEqual([]);
  expect(h.onFailing).not.toHaveBeenCalled();
  h.h.ref = { sessionId: "T", objectId: "P", pausedMs: 1 };
  await tick();
  expect(h.sent[0]).toMatchObject({ objectId: "P", sessionId: "T" });
});
