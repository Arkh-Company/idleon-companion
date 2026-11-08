// startReader against a scripted fake CDP (runs on the CI): a failed reading or a throwing callback never takes the
// engine again and never ends the keeper (spec §3, §7.1).
import { expect, test } from "vitest";
import { READ_NULLS } from "../shared/index.ts";
import type { Reading, Status } from "../shared/index.ts";
import type { Cdp, CdpMessage } from "./cdp.ts";
import { startReader } from "./reader.ts";

const events: CdpMessage[] = [
  {
    sessionId: "S",
    method: "Debugger.scriptParsed",
    params: { url: "file:///x/static/game/N.js", scriptId: "1" },
  },
  {
    sessionId: "S",
    method: "Debugger.paused",
    params: { callFrames: [{ callFrameId: "F" }], hitBreakpoints: ["B"] },
  },
];

const value = (map: number) => ({
  map,
  menu: 3,
  menu2: 0,
  menu2tab: 0,
  skillTab: 0,
  char: "Tester",
  afk: null,
  codexTab: 2,
  ...READ_NULLS,
});

/** A game whose map changes on every read; `read` can replace the answer to Runtime.callFunctionOn. */
function fakeCdp(read?: () => unknown) {
  const sent: string[] = [];
  let map = 0;
  const answers: Record<string, () => unknown> = {
    "Target.getTargets": () => ({
      targetInfos: [{ targetId: "T", type: "page" }],
    }),
    "Target.attachToTarget": () => ({ sessionId: "S" }),
    "Debugger.getScriptSource": () => ({
      scriptSource: "var E={getGameAttribute:function(e){return 1}};",
    }),
    "Debugger.setBreakpoint": () => ({ breakpointId: "B" }),
    "Debugger.evaluateOnCallFrame": () => ({ result: { objectId: "O" } }),
    "Runtime.callFunctionOn":
      read ?? (() => ({ result: { value: value(map++) } })),
  };
  const cdp: Cdp = {
    send(method) {
      sent.push(method);
      return Promise.resolve().then(() => answers[method]?.() ?? {});
    },
    waitFor(pred) {
      const m = events.find(pred);
      return m ? Promise.resolve(m) : new Promise<CdpMessage>(() => undefined);
    },
    close() {
      // nothing to close
    },
  };
  return { cdp, sent };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const attached = (statuses: Status[]) =>
  statuses.filter((s) => s.reader === "attached").length;

test("a throwing onReading neither stops the reader nor takes the engine again", async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (e: unknown) => unhandled.push(e);
  process.on("unhandledRejection", onUnhandled);
  const readings: Reading[] = [];
  const statuses: Status[] = [];
  const { cdp } = fakeCdp();
  const r = startReader(
    cdp,
    () => "(function () {})",
    (x) => {
      readings.push(x);
      if (readings.length === 1) throw new Error("caller bug");
    },
    (s) => statuses.push(s),
    { pollMs: 5, retryMs: 5 },
  );
  try {
    for (let i = 0; i < 100 && readings.length < 3; i++) await sleep(10);
  } finally {
    void r.stop();
    await sleep(20);
    process.off("unhandledRejection", onUnhandled);
  }
  expect(readings.length).toBeGreaterThanOrEqual(2);
  expect(readings[1]?.map).not.toBe(readings[0]?.map);
  expect(attached(statuses)).toBe(1);
  expect(unhandled).toEqual([]);
});

test("onRead fires on every good reading, also when it did not change", async () => {
  const readings: Reading[] = [];
  const reads: number[] = [];
  const { cdp } = fakeCdp(() => ({ result: { value: value(264) } }));
  const r = startReader(
    cdp,
    () => "(function () {})",
    (x) => readings.push(x),
    () => undefined,
    { pollMs: 5, retryMs: 5, onRead: (t) => reads.push(t) },
  );
  try {
    for (let i = 0; i < 100 && reads.length < 3; i++) await sleep(10);
  } finally {
    void r.stop();
  }
  expect(readings).toHaveLength(1);
  expect(reads.length).toBeGreaterThanOrEqual(3);
  expect(reads[0]).toBe(readings[0]?.t);
});

test("an exception inside read.js keeps the engine reference", async () => {
  const readings: Reading[] = [];
  const statuses: Status[] = [];
  let reads = 0;
  const { cdp, sent } = fakeCdp(() => {
    reads++;
    return { result: {}, exceptionDetails: { text: "Uncaught" } };
  });
  const r = startReader(
    cdp,
    () => "(function () {})",
    (x) => readings.push(x),
    (s) => statuses.push(s),
    { pollMs: 5, retryMs: 5 },
  );
  try {
    for (let i = 0; i < 100 && reads < 5; i++) await sleep(10);
  } finally {
    void r.stop();
  }
  expect(reads).toBeGreaterThanOrEqual(5);
  expect(attached(statuses)).toBe(1);
  expect(readings).toEqual([]);
  expect(sent.filter((m) => m === "Target.attachToTarget")).toHaveLength(1);
});

/** A read.js that fails `fails` times (an exception inside the game), then reads well. */
function failingThenGood(fails: number) {
  let reads = 0;
  const read = () => {
    reads++;
    return reads <= fails
      ? {
          result: {},
          exceptionDetails: {
            text: "Uncaught",
            exception: { description: "TypeError: x is undefined" },
          },
        }
      : { result: { value: value(0) } };
  };
  return { read, reads: () => reads };
}

test("ten failed readings in a row warn once, without taking the engine again", async () => {
  const statuses: Status[] = [];
  const f = failingThenGood(Infinity);
  let readsAtWarning = 0;
  const { cdp, sent } = fakeCdp(f.read);
  const r = startReader(
    cdp,
    () => "(function () {})",
    () => undefined,
    (s) => {
      statuses.push(s);
      if (s.message) readsAtWarning = f.reads();
    },
    { pollMs: 2, retryMs: 2 },
  );
  try {
    for (let i = 0; i < 100 && f.reads() < 25; i++) await sleep(10);
  } finally {
    void r.stop();
  }
  expect(statuses.filter((s) => s.message)).toEqual([
    {
      game: "running",
      reader: "attached",
      message: "Reading failed: TypeError: x is undefined",
    },
  ]);
  expect(readsAtWarning).toBe(10);
  expect(sent.filter((m) => m === "Target.attachToTarget")).toHaveLength(1);
});

test("a reading of the wrong shape counts as a failed reading", async () => {
  const statuses: Status[] = [];
  const { cdp } = fakeCdp(() => ({ result: { value: { map: "x" } } }));
  const r = startReader(
    cdp,
    () => "(function () {})",
    () => undefined,
    (s) => statuses.push(s),
    { pollMs: 2, retryMs: 2 },
  );
  try {
    for (let i = 0; i < 100 && !statuses.some((s) => s.message); i++)
      await sleep(10);
  } finally {
    void r.stop();
  }
  expect(statuses.find((s) => s.message)?.message).toBe(
    "Reading failed: the reading has the wrong shape",
  );
});

test("a good reading after the warning clears the message once", async () => {
  const statuses: Status[] = [];
  const readings: Reading[] = [];
  const f = failingThenGood(10);
  const { cdp } = fakeCdp(f.read);
  const r = startReader(
    cdp,
    () => "(function () {})",
    (x) => readings.push(x),
    (s) => statuses.push(s),
    { pollMs: 2, retryMs: 2 },
  );
  try {
    for (let i = 0; i < 100 && f.reads() < 15; i++) await sleep(10);
  } finally {
    void r.stop();
  }
  expect(readings).toHaveLength(1);
  expect(statuses.slice(1)).toEqual([
    { game: "running", reader: "attached" },
    {
      game: "running",
      reader: "attached",
      message: "Reading failed: TypeError: x is undefined",
    },
    { game: "running", reader: "attached" },
  ]);
});

test("onAttached gets how long the game was paused", async () => {
  const paused: number[] = [];
  const { cdp } = fakeCdp();
  const r = startReader(
    cdp,
    () => "(function () {})",
    () => undefined,
    () => undefined,
    { pollMs: 5, retryMs: 5, onAttached: (ms) => paused.push(ms) },
  );
  try {
    for (let i = 0; i < 100 && paused.length === 0; i++) await sleep(10);
  } finally {
    void r.stop();
  }
  expect(paused).toHaveLength(1);
  expect(paused[0]).toBeGreaterThanOrEqual(0);
});

test("a lost engine reference (a reload) is released, and the engine is taken again", async () => {
  const readings: Reading[] = [];
  const statuses: Status[] = [];
  let calls = 0;
  const { cdp, sent } = fakeCdp(() => {
    calls++;
    if (calls === 1) throw new Error("Could not find object with given id");
    return { result: { value: value(calls) } };
  });
  const r = startReader(
    cdp,
    () => "(function () {})",
    (x) => readings.push(x),
    (s) => statuses.push(s),
    { pollMs: 5, retryMs: 5 },
  );
  try {
    for (let i = 0; i < 100 && readings.length === 0; i++) await sleep(10);
  } finally {
    void r.stop();
  }
  const attaches = sent.flatMap((m, i) =>
    m === "Target.attachToTarget" ? [i] : [],
  );
  expect(attaches).toHaveLength(2);
  const between = sent.slice(attaches[0], attaches[1]);
  expect(between).toContain("Runtime.releaseObjectGroup");
  expect(between).toContain("Target.detachFromTarget");
  expect(attached(statuses)).toBe(2);
  expect(readings).toHaveLength(1);
  expect(sent.lastIndexOf("Runtime.callFunctionOn")).toBeGreaterThan(
    attaches[1] ?? Infinity,
  );
});

test("a game without the anchor (an update) is not taken again for this game load", async () => {
  const statuses: Status[] = [];
  const { cdp, sent } = fakeCdp();
  const send = cdp.send.bind(cdp);
  cdp.send = (method, ...rest) =>
    method === "Debugger.getScriptSource"
      ? Promise.resolve({ scriptSource: "var E={};" })
      : send(method, ...rest);
  const r = startReader(
    cdp,
    () => "(function () {})",
    () => undefined,
    (s) => statuses.push(s),
    { pollMs: 5, retryMs: 5 },
  );
  await sleep(100);
  void r.stop();
  expect(sent.filter((m) => m === "Target.attachToTarget")).toHaveLength(1);
  expect(statuses.at(-1)).toEqual({
    game: "running",
    reader: "error",
    message: "Game updated: the reader needs an update",
  });
});

test("a stop while the engine is being taken still lets the game go", async () => {
  const { cdp, sent } = fakeCdp();
  const send = cdp.send.bind(cdp);
  cdp.send = (method, ...rest) => {
    if (method === "Debugger.resume") void r.stop(); // the keeper stops while acquireEngine finishes
    return send(method, ...rest);
  };
  const r = startReader(
    cdp,
    () => "(function () {})",
    () => undefined,
    () => undefined,
    { pollMs: 5, retryMs: 5 },
  );
  await sleep(50);
  const after = sent.slice(sent.indexOf("Debugger.resume") + 1);
  expect(after).toContain("Target.detachFromTarget");
  expect(after).not.toContain("Runtime.callFunctionOn");
});
