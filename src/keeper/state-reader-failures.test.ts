// What the state reader does when a read fails, a callback throws or the reader stops (FR-002).
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { setup, sliceReads, tick } from "./state-reader-fixture.ts";
import { oneAtATime } from "./state-reader.ts";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test.each<[string, () => unknown]>([
  [
    "a rejected read",
    () => {
      throw new Error("gone");
    },
  ],
  ["an exception in the script", () => ({ result: {}, exceptionDetails: {} })],
  ["no answer", () => ({ result: {} })],
  ["a map that is not a number", () => ({ result: { value: { char: "H" } } })],
])("%s is skipped and the next slot goes on", async (_name, bad) => {
  const h = setup();
  await tick();
  h.h.answer = bad;
  await tick();
  h.h.answer = null;
  await tick();
  expect(h.slices).toHaveLength(1);
  expect(h.sent[1]?.paths).toEqual(h.sent[2]?.paths);
});

test("a slice with fewer values than paths is a failed read", async () => {
  const h = setup();
  await tick();
  h.h.answer = () => ({ result: { value: { char: "Hero", map: 1, out: [] } } });
  await tick();
  expect(h.slices).toEqual([]);
});

test("a list with keys of the wrong shape is a failed read", async () => {
  const h = setup();
  h.h.answer = () => ({
    result: { value: { char: "Hero", map: 1, top: "x", split: {} } },
  });
  await tick();
  expect(h.sent.map((s) => s.source)).toEqual(["LIST"]);
  h.h.answer = null;
  await tick();
  expect(h.sent.at(-1)?.source).toBe("LIST");
});

test("only the tenth failure in a row calls onFailing, once, with no argument", async () => {
  const h = setup();
  h.h.answer = () => {
    throw new Error("gone");
  };
  await tick(9);
  expect(h.onFailing).not.toHaveBeenCalled();
  await tick();
  expect(h.onFailing).toHaveBeenCalledTimes(1);
  expect(h.onFailing.mock.calls[0]).toEqual([]);
  await tick(15);
  expect(h.onFailing).toHaveBeenCalledTimes(1);
});

test("a good read starts the count of failures again", async () => {
  const h = setup();
  const fail = () => {
    throw new Error("gone");
  };
  h.h.answer = fail;
  await tick(9);
  h.h.answer = null;
  await tick();
  h.h.answer = fail;
  await tick(9);
  expect(h.onFailing).not.toHaveBeenCalled();
});

test("a callback that throws does not stop the reader or count as a failure", async () => {
  const h = setup();
  h.h.onSlice = () => {
    throw new Error("the caller's problem");
  };
  await tick(14);
  expect(sliceReads(h.sent).length).toBeGreaterThan(10);
  expect(h.onFailing).not.toHaveBeenCalled();
});

test("stop during a read resolves after it and starts no other", async () => {
  const h = setup();
  await tick();
  let open: () => void = () => undefined;
  h.h.gate = new Promise((r) => (open = r));
  await tick();
  let done = false;
  const stopped = h.reader.stop().then(() => (done = true));
  await tick(3);
  expect(done).toBe(false);
  open();
  await stopped;
  await tick(4);
  expect(done).toBe(true);
  expect(h.sent).toHaveLength(2);
  expect(h.slices).toEqual([]);
});

test("stop with nothing in flight resolves and reads no more", async () => {
  const h = setup();
  await h.reader.stop();
  await tick(4);
  expect(h.sent).toEqual([]);
});

test("a stop while a slot waits for its turn starts no read", async () => {
  const h = setup();
  let open: () => void = () => undefined;
  const poll = h.turn(() => new Promise<void>((r) => (open = r)));
  await tick();
  const stopped = h.reader.stop();
  open();
  await Promise.all([poll, stopped]);
  expect(h.sent).toEqual([]);
});

test("an engine lost while a slot waits for its turn is not read, and is no failure", async () => {
  const h = setup();
  let open: () => void = () => undefined;
  const poll = h.turn(() => new Promise<void>((r) => (open = r)));
  await tick();
  h.h.ref = null;
  open();
  await poll;
  await tick(12);
  expect(h.sent).toEqual([]);
  expect(h.onFailing).not.toHaveBeenCalled();
});

test("oneAtATime runs one after the other, even past a rejection", async () => {
  const turn = oneAtATime();
  const order: string[] = [];
  let open: () => void = () => undefined;
  const first = turn(
    () =>
      new Promise<void>((r) => {
        order.push("first");
        open = r;
      }),
  ).then(() => {
    throw new Error("first failed");
  });
  const failing = turn(() => Promise.reject(new Error("no")));
  const third = turn(() => {
    order.push("third");
    return Promise.resolve(3);
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(order).toEqual(["first"]);
  open();
  await expect(first).rejects.toThrow("first failed");
  await expect(failing).rejects.toThrow("no");
  expect(await third).toBe(3);
  expect(order).toEqual(["first", "third"]);
});
