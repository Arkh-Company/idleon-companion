// Takes a reference to the game engine once: a breakpoint inside getGameAttribute pauses the game for a few ms,
// `this` is kept in an object group, and the game resumes. Nothing here calls a game function or writes game state.
import type { Cdp } from "./cdp.ts";

/** The game script no longer has the anchor text: a game update moved the reader's breakpoint. */
export class AnchorNotFound extends Error {
  constructor(anchor: string) {
    super(`anchor not found in the game script: ${anchor}`);
    this.name = "AnchorNotFound";
  }
}

export interface EngineRef {
  sessionId: string;
  objectId: string;
  pausedMs: number;
}

/** The object group that holds the engine reference: releasing it lets the game collect it. */
export const OBJECT_GROUP = "companion";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function acquireEngine(
  cdp: Cdp,
  opts: { scriptSuffix: string; anchor: string },
): Promise<EngineRef> {
  let page: { targetId: string } | undefined;
  for (let i = 0; i < 120 && !page; i++) {
    const { targetInfos } = (await cdp.send("Target.getTargets")) as {
      targetInfos: { targetId: string; type: string }[];
    };
    page = targetInfos.find((x) => x.type === "page");
    if (!page) await sleep(500);
  }
  if (!page) throw new Error("no game page appeared");
  const { sessionId } = (await cdp.send("Target.attachToTarget", {
    targetId: page.targetId,
    flatten: true,
  })) as { sessionId: string };

  // Debugger.enable reports every script already loaded, and the game script may still be loading.
  const parsed = cdp.waitFor((m) => {
    const url = m.params?.url;
    return (
      m.sessionId === sessionId &&
      m.method === "Debugger.scriptParsed" &&
      typeof url === "string" &&
      url.endsWith(opts.scriptSuffix)
    );
  }, 120000);
  parsed.catch(() => undefined); // awaited below; this only keeps an early failure from going unhandled
  try {
    await cdp.send("Debugger.enable", {}, sessionId);
    const scriptId = (await parsed).params?.scriptId as string;
    const { scriptSource } = (await cdp.send(
      "Debugger.getScriptSource",
      { scriptId },
      sessionId,
    )) as { scriptSource: string };
    const a = scriptSource.indexOf(opts.anchor);
    if (a < 0) throw new AnchorNotFound(opts.anchor);
    const at = scriptSource.indexOf("{", a) + 1;
    const before = scriptSource.slice(0, at);
    const lineNumber = before.split("\n").length - 1;
    const columnNumber = at - (before.lastIndexOf("\n") + 1);

    const paused = cdp.waitFor(
      (m) => m.sessionId === sessionId && m.method === "Debugger.paused",
      60000,
    );
    paused.catch(() => undefined); // same: setBreakpoint may fail before it is awaited
    const { breakpointId } = (await cdp.send(
      "Debugger.setBreakpoint",
      { location: { scriptId, lineNumber, columnNumber } },
      sessionId,
    )) as { breakpointId: string };
    try {
      const p = await paused;
      const t0 = Date.now();
      // Only our breakpoint's pause has the engine as `this`; any other pause is resumed below and never read.
      // ponytail: checked after the wait, not inside the waitFor predicate: the pause can arrive in the same chunk as
      // the setBreakpoint answer, before breakpointId is known here.
      const hits = p.params?.hitBreakpoints;
      if (!Array.isArray(hits) || !hits.includes(breakpointId))
        throw new Error("the game paused outside the reader's breakpoint");
      const frames = p.params?.callFrames as { callFrameId: string }[];
      const { result } = (await cdp.send(
        "Debugger.evaluateOnCallFrame",
        {
          callFrameId: frames[0]?.callFrameId,
          expression: "this",
          objectGroup: OBJECT_GROUP,
        },
        sessionId,
      )) as { result: { objectId?: string } };
      await cdp.send("Debugger.removeBreakpoint", { breakpointId }, sessionId);
      await cdp.send("Debugger.resume", {}, sessionId);
      if (result.objectId === undefined)
        throw new Error("the engine reference has no object id");
      return {
        sessionId,
        objectId: result.objectId,
        pausedMs: Date.now() - t0,
      };
    } catch (e) {
      // Never leave the game paused or with our breakpoint.
      await cdp
        .send("Debugger.removeBreakpoint", { breakpointId }, sessionId)
        .catch(() => undefined);
      await cdp.send("Debugger.resume", {}, sessionId).catch(() => undefined);
      throw e;
    }
  } catch (e) {
    await cdp
      .send("Target.detachFromTarget", { sessionId })
      .catch(() => undefined);
    throw e;
  } finally {
    await cdp.send("Debugger.disable", {}, sessionId).catch(() => undefined);
  }
}
