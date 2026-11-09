// The `_vars` in the rotation: a fake reader of them over the fake game of the state reader's tests (FR-006).
// They are of the slow reading (data-model of 005), so a test that wants them first has no fast piece.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { laneOf, setup, sliceReads, tick } from "./state-reader-fixture.ts";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const fakeVars = (value: Record<string, unknown> | null = { TomePct: 7 }) => ({
  read: vi.fn(() => Promise.resolve(value)),
  release: vi.fn(() => Promise.resolve()),
});

const SLOW_ONLY = { top: ["ChestMap"] };

test("each slow pass starts with one slice of the _vars alone", async () => {
  const vars = fakeVars();
  const { slices } = setup({}, vars);
  await tick(8); // list, the first lap of 3, list, then fast, fast and the slow slot
  expect(slices.map((s) => s.pieces.map((p) => p.path))).toEqual([
    [["Cards"]],
    [["_vars"]],
    [["ChestMap"]],
    [["Cards"]],
    [["Cards"]],
    [["_vars"]],
  ]);
  expect(slices[1]?.pieces).toEqual([
    { path: ["_vars"], value: { TomePct: 7 } },
  ]);
  expect(vars.read).toHaveBeenCalledTimes(2);
});

test("the slice of the _vars carries the sentinel the game answered", async () => {
  vi.setSystemTime(1_000_000);
  const { slices } = setup(SLOW_ONLY, fakeVars());
  await tick(2);
  expect(slices[0]).toMatchObject({
    sentinel: { char: "Hero", map: 1 },
    at: 1_000_166,
  });
});

test("it takes a slow slot, and the fast slots go on around it", async () => {
  const { slices } = setup({}, fakeVars());
  await tick(8);
  expect(
    slices.map((s) => {
      const path = s.pieces[0]?.path;
      return path?.[0] === "_vars" ? "vars" : laneOf(path);
    }),
  ).toEqual(["fast", "vars", "slow", "fast", "fast", "vars"]);
});

test("a whole rotation counts only with its _vars and its pieces read", async () => {
  const { slices } = setup({}, fakeVars());
  await tick(4);
  expect(slices.map((s) => s.cycles)).toEqual([
    { fast: 1, all: 0 },
    { fast: 1, all: 0 },
    { fast: 1, all: 1 },
  ]);
});

test("a null from the reader emits an empty value", async () => {
  const { slices } = setup(SLOW_ONLY, fakeVars(null));
  await tick(2);
  expect(slices[0]?.pieces).toEqual([{ path: ["_vars"], value: {} }]);
});

test("the read is given the engine and runs inside the turn", async () => {
  const vars = fakeVars();
  const h = setup(SLOW_ONLY, vars);
  await tick();
  let open: () => void = () => undefined;
  const poll = h.turn(() => new Promise<void>((r) => (open = r)));
  await tick(2);
  expect(vars.read).not.toHaveBeenCalled();
  open();
  await poll;
  await vi.advanceTimersByTimeAsync(0);
  expect(vars.read).toHaveBeenCalledWith(h.h.ref, expect.any(Function));
});

test("no character: the _vars are not read", async () => {
  const vars = fakeVars();
  const { game, sent, slices } = setup(SLOW_ONLY, vars);
  await tick();
  game.char = null;
  await tick();
  expect(sliceReads(sent)).toHaveLength(1);
  expect(vars.read).not.toHaveBeenCalled();
  expect(slices).toEqual([]);
});

test("stop() during the read of the _vars gives no slice and releases after it", async () => {
  let open: (v: Record<string, unknown>) => void = () => undefined;
  let isStopped: () => boolean = () => false;
  const vars = {
    read: vi.fn((_ref: unknown, stoppedNow: () => boolean) => {
      isStopped = stoppedNow;
      return new Promise<Record<string, unknown>>((r) => (open = r));
    }),
    release: vi.fn(() => Promise.resolve()),
  };
  const { reader, slices } = setup(SLOW_ONLY, vars);
  await tick(2);
  expect(vars.read).toHaveBeenCalledTimes(1);
  expect(isStopped()).toBe(false);
  const stopped = reader.stop();
  await vi.advanceTimersByTimeAsync(0);
  expect(isStopped()).toBe(true);
  expect(vars.release).not.toHaveBeenCalled();
  open({ TomePct: 7 });
  await stopped;
  expect(slices).toEqual([]);
  expect(vars.release).toHaveBeenCalledTimes(1);
});

test("stop() releases the holder of the engine in use", async () => {
  const vars = fakeVars();
  const h = setup({}, vars);
  await tick(2);
  await h.reader.stop();
  expect(vars.release).toHaveBeenCalledWith(h.h.ref);
  expect(vars.release).toHaveBeenCalledTimes(1);
});
