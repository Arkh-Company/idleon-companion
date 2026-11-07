// acquireEngine against a scripted fake CDP: whatever fails, the game is never left paused or attached.
import { expect, test } from "vitest";
import type { Cdp, CdpMessage } from "./cdp.ts";
import { AnchorNotFound, acquireEngine } from "./engine-ref.ts";

const opts = {
  scriptSuffix: "/static/game/N.js",
  anchor: "getGameAttribute:function(",
};
const WITH_ANCHOR =
  "var E={getGameAttribute:function(e){return this.gameAttributes.h[e]}};";

const scriptParsed: CdpMessage = {
  sessionId: "S",
  method: "Debugger.scriptParsed",
  params: { url: "file:///x/static/game/N.js", scriptId: "1" },
};
const events: CdpMessage[] = [
  scriptParsed,
  {
    sessionId: "S",
    method: "Debugger.paused",
    params: { callFrames: [{ callFrameId: "F" }], hitBreakpoints: ["B"] },
  },
];

function fakeCdp(
  answers: Record<string, () => unknown>,
  seen: CdpMessage[] = events,
) {
  const sent: string[] = [];
  const cdp: Cdp = {
    send(method) {
      sent.push(method);
      // an answer that throws becomes a rejected request
      return Promise.resolve().then(() => answers[method]?.() ?? {});
    },
    waitFor(pred) {
      const m = seen.find(pred);
      return m ? Promise.resolve(m) : new Promise<CdpMessage>(() => undefined);
    },
    close() {
      // nothing to close
    },
  };
  return { cdp, sent };
}

const base = {
  "Target.getTargets": () => ({
    targetInfos: [{ targetId: "T", type: "page" }],
  }),
  "Target.attachToTarget": () => ({ sessionId: "S" }),
  "Debugger.getScriptSource": () => ({ scriptSource: WITH_ANCHOR }),
  "Debugger.setBreakpoint": () => ({ breakpointId: "B" }),
};

test("a failure while paused removes the breakpoint and resumes the game", async () => {
  const { cdp, sent } = fakeCdp({
    ...base,
    "Debugger.evaluateOnCallFrame": () => {
      throw new Error("evaluate failed");
    },
  });
  await expect(acquireEngine(cdp, opts)).rejects.toThrow("evaluate failed");
  const after = sent.slice(sent.indexOf("Debugger.evaluateOnCallFrame") + 1);
  expect(after).toContain("Debugger.removeBreakpoint");
  expect(after).toContain("Debugger.resume");
});

test("a script without the anchor throws AnchorNotFound and detaches", async () => {
  const { cdp, sent } = fakeCdp({
    ...base,
    "Debugger.getScriptSource": () => ({ scriptSource: "var E={};" }),
  });
  await expect(acquireEngine(cdp, opts)).rejects.toBeInstanceOf(AnchorNotFound);
  expect(sent).toContain("Target.detachFromTarget");
  expect(sent).not.toContain("Debugger.setBreakpoint");
});

test("a pause that is not at our breakpoint is resumed and never read", async () => {
  const foreign: CdpMessage = {
    sessionId: "S",
    method: "Debugger.paused",
    params: { callFrames: [{ callFrameId: "X" }], hitBreakpoints: ["other"] },
  };
  const { cdp, sent } = fakeCdp(base, [scriptParsed, foreign]);
  await expect(acquireEngine(cdp, opts)).rejects.toThrow(
    "the game paused outside the reader's breakpoint",
  );
  expect(sent).not.toContain("Debugger.evaluateOnCallFrame");
  expect(sent).toContain("Debugger.removeBreakpoint");
  expect(sent).toContain("Debugger.resume");
  expect(sent).toContain("Target.detachFromTarget");
});
