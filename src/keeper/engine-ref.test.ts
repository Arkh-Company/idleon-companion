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

function fakeCdp(answers: Record<string, () => unknown>) {
  const sent: string[] = [];
  const cdp: Cdp = {
    send(method) {
      sent.push(method);
      // an answer that throws becomes a rejected request
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
