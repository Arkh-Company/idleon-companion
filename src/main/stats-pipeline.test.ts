// From the keeper's slices to the window: the slices, the mosaic, the calculator's host and the tab's state, joined.
// The worker is a fake, and every number and character name here is invented.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { LinkMessage } from "../shared/index.ts";
import {
  ATTACHED,
  CALCULATED,
  CALCULATING,
  flush,
  NONE,
  piece,
  reading,
  RESOURCES,
  setup,
  UNAVAILABLE,
  vars,
} from "./stats-pipeline-fixture.ts";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test("slices of a whole rotation and a gameFiles end with a calc", async () => {
  const h = setup();
  h.open();
  h.files();
  h.rotation([vars, piece("Cards", "invented")]);
  await h.ready();

  expect(h.readFiles).toHaveBeenCalledExactlyOnceWith(RESOURCES);
  expect(JSON.parse(h.worker().calcs()[0] ?? "")).toMatchObject({
    attrs: { Cards: "invented" },
    vars: { A_friendBons: 1 },
  });
});

test("the worker is created with the host's options", async () => {
  const h = setup();
  await h.showing();
  expect(h.options).toEqual([
    {
      env: {},
      stdin: false,
      resourceLimits: { maxOldGenerationSizeMb: 1024 },
    },
  ]);
});

test("the result reaches the window as the ten rows", async () => {
  const h = setup();
  await h.showing();
  const last = h.last();
  expect(last?.state).toBe("ready");
  expect(last?.state === "ready" && last.rows).toHaveLength(10);
  expect(last?.state === "ready" && last.rows[2]).toEqual({
    label: "HP",
    text: "3",
  });
});

test("the first slices show Calculating", () => {
  const h = setup();
  h.open();
  h.slice();
  expect(h.sent).toEqual([CALCULATING]);
});

test("a state of the wrong shape is dropped", () => {
  const h = setup();
  h.open();
  h.p.message({
    type: "state",
    slice: { sentinel: { char: 1, map: 5 }, pieces: [], at: 1, cycles: {} },
  } as unknown as LinkMessage);
  expect(h.sent).toEqual([]);
});

test("a gameFiles outside a resources folder is dropped", async () => {
  const h = setup();
  h.open();
  h.p.message({ type: "gameFiles", resources: "C:\\invented\\elsewhere" });
  h.rotation();
  await flush();
  expect(h.workers).toEqual([]);
});

test("other messages are left alone", () => {
  const h = setup();
  h.p.message({ type: "release" });
  expect(h.sent).toEqual([]);
});

test("no slice counts before the reader is attached", () => {
  const h = setup();
  h.slice();
  expect(h.sent).toEqual([]);
});

test("a slice that arrives after the reader let go shows nothing", () => {
  const h = setup();
  h.open();
  h.p.status({ game: "running", reader: "released" });
  h.sent.length = 0;
  h.slice();
  expect(h.sent).toEqual([]);
});

test("the slices that come before the reading with the character are kept", async () => {
  const h = setup();
  h.p.status(ATTACHED);
  h.p.reading(reading(null));
  h.files();
  h.slice([vars, piece("Cards", "early")]);
  h.p.reading(reading());
  h.slice([], { formula: 1, all: 1 });
  await h.ready();
  expect(JSON.parse(h.worker().calcs()[0] ?? "")).toMatchObject({
    attrs: { Cards: "early" },
    vars: { A_friendBons: 1 },
  });
});

test.each<[string, (h: ReturnType<typeof setup>) => void]>([
  [
    "a reading with no character",
    (h) => {
      h.p.reading(reading(null));
    },
  ],
  [
    "a released reader",
    (h) => {
      h.p.status({ game: "running", reader: "released" });
    },
  ],
  [
    "a closed game",
    (h) => {
      h.p.status({ game: "closed", reader: "error" });
    },
  ],
  [
    "a closed game with the reader still attached",
    (h) => {
      h.p.status({ game: "closed", reader: "attached" });
    },
  ],
  [
    "a dropped link",
    (h) => {
      h.p.status({ game: "not-launched", reader: "error" });
    },
  ],
])("%s sends none and wipes the mosaic", async (_name, leave) => {
  const h = setup();
  await h.showing([vars, piece("Cards", "OLD-VALUE")]);
  const first = h.worker();

  leave(h);
  expect(h.last()).toEqual(NONE);
  expect(first.terminated).toBe(1);

  h.open();
  h.restartCycles();
  h.files();
  h.rotation();
  await h.ready();
  expect(h.worker().calcs().join()).not.toContain("OLD-VALUE");
});

test("a late result after the reader was released is not shown", async () => {
  const h = setup();
  h.open();
  h.files();
  h.rotation();
  await h.ready();
  const w = h.worker();

  h.p.status({ game: "running", reader: "released" });
  w.emit("message", { type: "result", numbers: CALCULATED });

  expect(h.last()).toEqual(NONE);
});

test("Reconnect calculates again without a new gameFiles", async () => {
  const h = setup();
  await h.showing();
  h.p.status({ game: "running", reader: "released" });

  h.p.status(ATTACHED);
  h.restartCycles();
  h.rotation();
  await h.ready();

  expect(h.workers).toHaveLength(2);
  expect(h.readFiles).toHaveBeenCalledTimes(2);
  expect(h.readFiles).toHaveBeenLastCalledWith(RESOURCES);
  expect(h.worker().calcs()).toHaveLength(1);
});

test("a new character stops the calculation of the old one", async () => {
  const h = setup();
  await h.showing();
  h.rotation([vars]); // one more calculation, still unanswered when the character changes
  await vi.advanceTimersByTimeAsync(5_000);
  const old = h.worker();

  h.p.reading(reading("Other"));
  h.restartCycles();
  h.rotation([vars], "Other");

  expect(old.terminated).toBe(1);
  expect(h.last()).toEqual(CALCULATING);
  old.emit("message", { type: "result", numbers: CALCULATED });
  expect(h.last()).toEqual(CALCULATING);
});

test("a failed calculator shows unavailable and the rest goes on", async () => {
  const h = setup();
  h.open();
  h.files();
  h.rotation();
  await flush();

  h.worker().emit("message", { type: "failed" });
  expect(h.last()).toEqual(UNAVAILABLE);

  h.rotation();
  h.p.reading(reading());
  h.p.status(ATTACHED);
  expect(h.last()).toEqual(UNAVAILABLE);
  expect(h.workers).toHaveLength(1);
});

test("after a failure, a new gameFiles starts over", async () => {
  const h = setup();
  await h.failing();

  h.files();
  expect(h.last()).toEqual(NONE);
  h.restartCycles();
  h.rotation();
  expect(h.last()).toEqual(CALCULATING);
  await h.ready();
  expect(h.workers).toHaveLength(2);
  expect(h.worker().calcs()).toHaveLength(1);
});

test("a failed calculator stays unavailable through a release and a Reconnect", async () => {
  const h = setup();
  await h.failing();

  h.p.status({ game: "running", reader: "released" });
  expect(h.last()).toEqual(NONE);
  h.p.status(ATTACHED);
  h.restartCycles();
  h.rotation();

  expect(h.last()).toEqual(UNAVAILABLE);
  expect(h.workers).toHaveLength(1);
});

test("30 s without a slice, with a character and the reader attached, is unavailable", async () => {
  const h = setup();
  h.open();

  await vi.advanceTimersByTimeAsync(29_999);
  expect(h.sent).toEqual([]);
  await vi.advanceTimersByTimeAsync(1);
  expect(h.last()).toEqual(UNAVAILABLE);
});

test("each slice gives the reading another 30 s", async () => {
  const h = setup();
  h.open();
  await vi.advanceTimersByTimeAsync(20_000);
  h.slice();
  await vi.advanceTimersByTimeAsync(29_999);
  expect(h.last()).toEqual(CALCULATING);
  await vi.advanceTimersByTimeAsync(1);
  expect(h.last()).toEqual(UNAVAILABLE);
});

test("the status and the reading repeating do not stop the stall", async () => {
  const h = setup();
  h.open();
  for (let i = 0; i < 30; i++) {
    await vi.advanceTimersByTimeAsync(1_000);
    h.p.status(ATTACHED);
    h.p.reading(reading());
  }
  expect(h.last()).toEqual(UNAVAILABLE);
});

test.each<[string, (h: ReturnType<typeof setup>) => void]>([
  [
    "no character",
    (h) => {
      h.p.reading(reading(null));
    },
  ],
  [
    "a reader not attached",
    (h) => {
      h.p.status({ game: "running", reader: "released" });
    },
  ],
])("with %s no stall is reported", async (_name, leave) => {
  const h = setup();
  h.open();
  leave(h);
  h.sent.length = 0;
  await vi.advanceTimersByTimeAsync(40_000);
  expect(h.sent).toEqual([]);
});

test("a slice after a stall goes back to the numbers", async () => {
  const h = setup();
  await h.showing();
  const shown = h.last();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(h.last()).toEqual(UNAVAILABLE);

  h.slice();
  expect(h.last()).toEqual(shown);
});

test("a slice after a stall goes back to Calculating when no number came yet", async () => {
  const h = setup();
  h.open();
  await vi.advanceTimersByTimeAsync(30_000);

  h.slice();
  expect(h.last()).toEqual(CALCULATING);
});

test("a slice after a stall does not hide a failed calculator", async () => {
  const h = setup();
  await h.failing();
  await vi.advanceTimersByTimeAsync(30_000);

  h.slice();
  expect(h.last()).toEqual(UNAVAILABLE);
});

test("an error sending the rows becomes unavailable and is not thrown to the host", async () => {
  const h = setup();
  h.open();
  h.files();
  h.rotation();
  await h.ready();
  h.send.mockImplementationOnce(() => {
    throw new Error("window gone");
  });

  expect(() => {
    h.answer();
  }).not.toThrow();
  expect(h.last()).toEqual(UNAVAILABLE);
  expect(h.worker().terminated).toBe(1);
});

test("an error sending unavailable is not thrown to the host either", async () => {
  const h = setup();
  h.open();
  h.files();
  h.rotation();
  await flush();
  h.send.mockImplementation(() => {
    throw new Error("window gone");
  });

  expect(() => {
    h.worker().emit("message", { type: "failed" });
  }).not.toThrow();
});

test("an error sending to the window does not reach the link", () => {
  const h = setup();
  h.open();
  h.send.mockImplementation(() => {
    throw new Error("window gone");
  });

  expect(() => {
    h.slice();
  }).not.toThrow();
});

test("replay repeats the last value", async () => {
  const h = setup();
  await h.showing();
  const shown = h.last();
  h.sent.length = 0;
  h.p.replay();
  expect(h.sent).toEqual([shown]);
});
