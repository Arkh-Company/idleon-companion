// The `_vars` in the rotation: a fake reader of them over the fake game of the state reader's tests (FR-006).
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { classOf } from "../shared/index.ts";
import { setup, sliceReads, tick } from "./state-reader-fixture.ts";

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

test("each new formula rotation starts with one slice of the _vars alone", async () => {
  const vars = fakeVars();
  const { slices } = setup({}, vars);
  await tick(5);
  expect(slices.map((s) => s.pieces.map((p) => p.path))).toEqual([
    [["_vars"]],
    [["Cards"]],
    [["_vars"]],
    [["ChestMap"]],
  ]);
  expect(slices[0]?.pieces).toEqual([
    { path: ["_vars"], value: { TomePct: 7 } },
  ]);
  expect(vars.read).toHaveBeenCalledTimes(2);
});

test("the slice of the _vars carries the sentinel the game answered", async () => {
  vi.setSystemTime(1_000_000);
  const { slices } = setup({}, fakeVars());
  await tick(2);
  expect(slices[0]).toMatchObject({
    sentinel: { char: "Hero", map: 1 },
    at: 1_000_500,
  });
});

test("it takes a formula slot, and three formula then one other still holds", async () => {
  const { slices } = setup({}, fakeVars());
  await tick(5);
  // The reader puts the _vars in the fast pass, whatever the catalog says of them.
  expect(
    slices.map((s) => {
      const path = s.pieces[0]?.path ?? ["none"];
      return path[0] === "_vars" ? "fast" : classOf(path, "Hero");
    }),
  ).toEqual(["fast", "fast", "fast", "slow"]);
});

test("a formula rotation counts only with its _vars and its pieces read", async () => {
  const { slices } = setup({}, fakeVars());
  await tick(5);
  expect(slices.map((s) => s.cycles)).toEqual([
    { fast: 0, all: 0 },
    { fast: 1, all: 0 },
    { fast: 1, all: 0 },
    { fast: 1, all: 1 },
  ]);
});

test("a null from the reader emits an empty value", async () => {
  const { slices } = setup({}, fakeVars(null));
  await tick(2);
  expect(slices[0]?.pieces).toEqual([{ path: ["_vars"], value: {} }]);
});

test("the read is given the engine and runs inside the turn", async () => {
  const vars = fakeVars();
  const h = setup({}, vars);
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
  const { game, sent, slices } = setup({}, vars);
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
  const { reader, slices } = setup({}, vars);
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
