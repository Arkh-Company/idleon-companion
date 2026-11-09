// The 1 s reader and the state reader together, over a fake game: one read at a time, the order of the stop, and what a
// script that cannot be loaded turns off. Every value here is made up (FR-021).
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { StateSlice } from "../shared/index.ts";
import type { Cdp, CdpMessage } from "./cdp.ts";
import type { KeeperLog } from "./keeper.ts";
import { loadStateScripts, startReaders } from "./readers.ts";

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
};

const SOURCES: Record<string, string> = {
  "read.js": "READ",
  "state-list.js": "LIST",
  "state-slice.js": "SLICE",
};
const load = (file: string) => SOURCES[file] ?? "";

function answerTo(source: string, paths: unknown[]): unknown {
  if (source === "LIST")
    return {
      result: { value: { char: "Hero", map: 1, top: ["Cards"], split: {} } },
    };
  if (source === "SLICE")
    return {
      result: { value: { char: "Hero", map: 1, out: paths.map(() => 1) } },
    };
  return { result: { value: null } };
}

/** A game whose reads take `latency` ms; `reads` has each script run, `log` the other calls, both in order. */
function fakeGame() {
  const g = {
    log: [] as string[],
    reads: [] as string[],
    inFlight: 0,
    most: 0,
    latency: 0,
    sliceGate: null as Promise<void> | null,
    failList: false,
    cdp: {
      async send(method: string, params: object = {}) {
        const p = params as {
          functionDeclaration?: string;
          objectGroup?: string;
          arguments?: { value: unknown[] | null }[];
        };
        if (method === "Runtime.releaseObjectGroup")
          g.log.push(`release ${String(p.objectGroup)}`);
        else g.log.push(method);
        if (method !== "Runtime.callFunctionOn") return answers[method] ?? {};
        const source = p.functionDeclaration ?? "";
        g.reads.push(source);
        g.inFlight++;
        g.most = Math.max(g.most, g.inFlight);
        if (source === "SLICE" && g.sliceGate) await g.sliceGate;
        await new Promise((r) => setTimeout(r, g.latency));
        g.inFlight--;
        if (source === "LIST" && g.failList) throw new Error("no answer");
        return answerTo(source, p.arguments?.[0]?.value ?? []);
      },
      waitFor(pred: (m: CdpMessage) => boolean) {
        const m = events.find(pred);
        return m
          ? Promise.resolve(m)
          : new Promise<CdpMessage>(() => undefined);
      },
      close() {
        // nothing to close
      },
    } as Cdp,
    count: (source: string) => g.reads.filter((s) => s === source).length,
  };
  return g;
}

function start(
  g: ReturnType<typeof fakeGame>,
  scripts: ReturnType<typeof loadStateScripts>,
  log: KeeperLog = () => undefined,
) {
  const slices: StateSlice[] = [];
  const reader = startReaders(scripts, load, log)(
    g.cdp,
    () => undefined,
    () => undefined,
    () => undefined,
    () => undefined,
    (s) => slices.push(s),
  );
  return { reader, slices };
}

const SCRIPTS = { listSource: "LIST", sliceSource: "SLICE" };
const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

async function stop(r: { stop(): Promise<void> }): Promise<void> {
  const stopped = r.stop();
  await advance(1000); // outlives a read in flight and the one waiting for its turn
  await stopped;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test("a 1 s read and a slice read never overlap", async () => {
  const g = fakeGame();
  g.latency = 300; // long enough that the 250 ms slots and the 1 s polls would meet
  const { reader, slices } = start(g, SCRIPTS);
  await advance(6000);
  await stop(reader);
  expect(g.most).toBe(1);
  expect(g.count("READ")).toBeGreaterThan(1);
  expect(g.count("SLICE")).toBeGreaterThan(0);
  expect(slices.length).toBeGreaterThan(0);
});

test("the state reader has ended before the 1 s reader lets the engine go", async () => {
  const g = fakeGame();
  let open: () => void = () => undefined;
  g.sliceGate = new Promise<void>((r) => (open = r));
  const { reader } = start(g, SCRIPTS);
  await advance(800); // the list at 250 ms and a slice read held open at 500, with the 1 s reader asleep
  expect(g.count("SLICE")).toBe(1);
  const stopped = reader.stop();
  await advance(3000);
  expect(g.log).not.toContain("Target.detachFromTarget");
  open();
  await advance(10);
  await stopped;
  const detached = g.log.indexOf("Target.detachFromTarget");
  expect(detached).toBeGreaterThan(-1);
  expect(g.log.indexOf("release companion-vars")).toBeLessThan(detached);
  expect(g.log.indexOf("release companion-vars")).toBeGreaterThan(-1);
});

test.each([
  ["every script", () => true],
  ["the second script", (file: string) => file === "state-slice.js"],
])(
  "a load that throws on %s is logged once, with no data, and does not propagate",
  (_name, fails) => {
    const log = vi.fn<KeeperLog>();
    const scripts = loadStateScripts((file) => {
      if (fails(file)) throw new Error("no file");
      return load(file);
    }, log);
    expect(scripts).toBeNull();
    expect(log.mock.calls).toEqual([["state-read-failing"]]);
  },
);

test("with no state scripts the 1 s reader goes on, alone", async () => {
  const g = fakeGame();
  const { reader, slices } = start(g, null);
  await advance(2500);
  expect(g.count("READ")).toBeGreaterThan(1);
  expect(g.count("LIST")).toBe(0);
  expect(slices).toEqual([]);
  await stop(reader);
});

test("the scripts are the ones loaded", () => {
  expect(loadStateScripts(load, () => undefined)).toEqual(SCRIPTS);
});

test("a state reading that keeps failing is logged once, with no data", async () => {
  const g = fakeGame();
  g.failList = true;
  const log = vi.fn<KeeperLog>();
  const { reader } = start(g, SCRIPTS, log);
  await advance(250 * 14);
  await stop(reader);
  expect(log.mock.calls).toEqual([["state-read-failing"]]);
});
