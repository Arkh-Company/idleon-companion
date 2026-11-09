// The two hooks the state reader needs from the reader: the engine reference (onEngine) and one read at a time (turn).
import { expect, test } from "vitest";
import type { Cdp, CdpMessage } from "./cdp.ts";
import type { EngineRef } from "./engine-ref.ts";
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

/** A game whose polls fail while `g.losing` is on; `log` has every CDP method and hook call, in order. */
function fakeGame() {
  const log: string[] = [];
  const g = {
    log,
    losing: false,
    cdp: {
      send(method) {
        log.push(method);
        if (method === "Runtime.callFunctionOn" && g.losing)
          return Promise.reject(new Error("dead object"));
        return Promise.resolve(answers[method] ?? {});
      },
      waitFor(pred) {
        const m = events.find(pred);
        return m
          ? Promise.resolve(m)
          : new Promise<CdpMessage>(() => undefined);
      },
      close() {
        // nothing to close
      },
    } as Cdp,
    polls: () => log.filter((m) => m === "Runtime.callFunctionOn").length,
  };
  return g;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(ok: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !ok(); i++) await sleep(5);
}

function start(
  g: ReturnType<typeof fakeGame>,
  opts: {
    onEngine?: (ref: EngineRef | null) => void;
    turn?: <T>(f: () => Promise<T>) => Promise<T>;
  } = {},
) {
  return startReader(
    g.cdp,
    () => "(function () {})",
    () => undefined,
    () => undefined,
    { pollMs: 5, retryMs: 5, ...opts },
  );
}

/** Records each onEngine call, also in the game's log, to see it against the CDP calls. */
function recorder(g: ReturnType<typeof fakeGame>) {
  const refs: (EngineRef | null)[] = [];
  return {
    refs,
    onEngine: (ref: EngineRef | null) => {
      refs.push(ref);
      g.log.push(ref ? "onEngine ref" : "onEngine null");
    },
  };
}

test("onEngine gets the reference once it is taken", async () => {
  const g = fakeGame();
  const { refs, onEngine } = recorder(g);
  const r = start(g, { onEngine });
  await until(() => g.polls() > 0);
  expect(refs).toHaveLength(1);
  expect(refs[0]).toMatchObject({ sessionId: "S", objectId: "O" });
  await r.stop();
});

test("onEngine gets null when the reference is lost, before it is released, and the new one after", async () => {
  const g = fakeGame();
  const { refs, onEngine } = recorder(g);
  const r = start(g, { onEngine });
  await until(() => g.polls() > 0);
  g.losing = true;
  await until(() => refs.includes(null));
  g.losing = false;
  await until(() => refs.length >= 3);
  await r.stop();
  expect(refs[1]).toBeNull();
  expect(refs[2]).toMatchObject({ objectId: "O" });
  const lost = g.log.indexOf("onEngine null");
  expect(g.log.indexOf("Runtime.releaseObjectGroup")).toBeGreaterThan(lost);
});

test("onEngine gets null when the reader stops, before the reference is released", async () => {
  const g = fakeGame();
  const { refs, onEngine } = recorder(g);
  const r = start(g, { onEngine });
  await until(() => g.polls() > 0);
  await r.stop();
  expect(refs.at(-1)).toBeNull();
  expect(g.log.indexOf("Runtime.releaseObjectGroup")).toBeGreaterThan(
    g.log.indexOf("onEngine null"),
  );
});

test("an onEngine that throws does not stop the reader", async () => {
  const g = fakeGame();
  const r = start(g, {
    onEngine: () => {
      throw new Error("the caller's problem");
    },
  });
  await until(() => g.polls() > 1);
  expect(g.polls()).toBeGreaterThan(1);
  await r.stop();
});

test("each poll runs inside the turn", async () => {
  const g = fakeGame();
  let open: () => void = () => undefined;
  const gate = new Promise<void>((r) => (open = r));
  let turns = 0;
  const turn = async <T>(f: () => Promise<T>) => {
    turns++;
    await gate;
    return f();
  };
  const r = start(g, { turn });
  await until(() => turns > 0);
  await sleep(20);
  expect(g.polls()).toBe(0);
  open();
  await until(() => g.polls() > 1);
  await r.stop();
  expect(turns).toBe(g.polls());
});

test("a poll that rejects inside the turn loses the reference as before", async () => {
  const g = fakeGame();
  g.losing = true;
  const { refs, onEngine } = recorder(g);
  const r = start(g, { onEngine, turn: (f) => f() });
  await until(() => refs.includes(null));
  expect(g.log).toContain("Runtime.releaseObjectGroup");
  await r.stop();
});

test("without a turn the polls go straight out", async () => {
  const g = fakeGame();
  const r = start(g);
  await until(() => g.polls() > 1);
  expect(g.polls()).toBeGreaterThan(1);
  await r.stop();
});
