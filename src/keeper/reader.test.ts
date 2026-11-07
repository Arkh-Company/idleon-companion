// startReader against a scripted fake CDP (runs on the CI): a failed reading or a throwing callback never takes the
// engine again and never ends the keeper (spec §3, §7.1).
import { expect, test } from "vitest";
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
    params: { callFrames: [{ callFrameId: "F" }] },
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
  codexSel: null,
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
    r.stop();
    await sleep(20);
    process.off("unhandledRejection", onUnhandled);
  }
  expect(readings.length).toBeGreaterThanOrEqual(2);
  expect(readings[1]?.map).not.toBe(readings[0]?.map);
  expect(attached(statuses)).toBe(1);
  expect(unhandled).toEqual([]);
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
    r.stop();
  }
  expect(reads).toBeGreaterThanOrEqual(5);
  expect(attached(statuses)).toBe(1);
  expect(readings).toEqual([]);
  expect(sent.filter((m) => m === "Target.attachToTarget")).toHaveLength(1);
});
