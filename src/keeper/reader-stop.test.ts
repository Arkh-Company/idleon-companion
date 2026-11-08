// reader.stop() resolves only once the engine is let go (research R7), so a "Reconnect" right after it never runs beside
// the old session. A scripted fake CDP: runs on the CI.
import { expect, test } from "vitest";
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

const answers: Record<string, unknown> = {
  "Target.getTargets": { targetInfos: [{ targetId: "T", type: "page" }] },
  "Target.attachToTarget": { sessionId: "S" },
  "Debugger.getScriptSource": {
    scriptSource: "var E={getGameAttribute:function(e){return 1}};",
  },
  "Debugger.setBreakpoint": { breakpointId: "B" },
  "Debugger.evaluateOnCallFrame": { result: { objectId: "O" } },
  "Runtime.callFunctionOn": { result: { value: null } },
};

/** A game whose answer to `held` waits for `answerHeld()`; `sent` has everything the reader sent. */
function fakeGame(held: string) {
  const sent: { method: string; params: unknown; sessionId?: unknown }[] = [];
  let answerHeld: () => void = () => undefined;
  const gate = new Promise<void>((r) => (answerHeld = r));
  const cdp: Cdp = {
    async send(method, params, sessionId) {
      sent.push({ method, params, sessionId });
      if (method === held) await gate;
      return answers[method] ?? {};
    },
    waitFor(pred) {
      const m = events.find(pred);
      return m ? Promise.resolve(m) : new Promise<CdpMessage>(() => undefined);
    },
    close() {
      // nothing to close
    },
  };
  const wasSent = (method: string) => sent.some((m) => m.method === method);
  return { cdp, sent, wasSent, answerHeld };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(ok: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !ok(); i++) await sleep(5);
}
const start = (cdp: Cdp, pollMs = 5) =>
  startReader(
    cdp,
    () => "(function () {})",
    () => undefined,
    () => undefined,
    { pollMs, retryMs: 5 },
  );

test("stop resolves only after the reference is released and the held session detached", async () => {
  const g = fakeGame("Target.detachFromTarget");
  const r = start(g.cdp);
  await until(() => g.wasSent("Runtime.callFunctionOn"));
  let done = false;
  const stopped = r.stop().then(() => (done = true));
  await until(() => g.wasSent("Target.detachFromTarget"));
  await sleep(20);
  expect(done).toBe(false);
  expect(g.sent.slice(-2)).toEqual([
    {
      method: "Runtime.releaseObjectGroup",
      params: { objectGroup: "companion" },
      sessionId: "S",
    },
    {
      method: "Target.detachFromTarget",
      params: { sessionId: "S" },
      sessionId: undefined,
    },
  ]);
  g.answerHeld();
  await stopped;
  expect(done).toBe(true);
});

test("a stop while the engine is being taken resolves after that engine is let go", async () => {
  const g = fakeGame("Debugger.evaluateOnCallFrame");
  const r = start(g.cdp);
  await until(() => g.wasSent("Debugger.evaluateOnCallFrame"));
  let done = false;
  const stopped = r.stop().then(() => (done = true));
  await sleep(20);
  expect(done).toBe(false);
  g.answerHeld();
  await stopped;
  expect(g.wasSent("Debugger.resume")).toBe(true);
  expect(g.wasSent("Target.detachFromTarget")).toBe(true);
  expect(g.wasSent("Runtime.callFunctionOn")).toBe(false);
});

test("a second stop resolves too, and lets the engine go only once", async () => {
  const g = fakeGame("nothing is held");
  const r = start(g.cdp);
  await until(() => g.wasSent("Runtime.callFunctionOn"));
  await r.stop();
  await r.stop();
  expect(
    g.sent.filter((m) => m.method === "Target.detachFromTarget"),
  ).toHaveLength(1);
});

test("a stop during a reading does not wait for the next poll", async () => {
  const g = fakeGame("Runtime.callFunctionOn");
  const r = start(g.cdp, 30_000);
  await until(() => g.wasSent("Runtime.callFunctionOn"));
  const stopped = r.stop();
  g.answerHeld();
  expect(
    await Promise.race([stopped, sleep(1000).then(() => "still waiting")]),
  ).toBeUndefined();
  expect(g.wasSent("Target.detachFromTarget")).toBe(true);
});
