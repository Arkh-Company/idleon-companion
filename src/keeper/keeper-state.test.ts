// The keeper's publication of the slices and of the game's folder, with a fake game and reader over a real local pipe.
// Every value here is made up (FR-021).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { LinkMessage, StateSlice } from "../shared/index.ts";
import type { Cdp } from "./cdp.ts";
import { runKeeper } from "./keeper.ts";
import type { KeeperDeps } from "./keeper.ts";
import type * as LinkServerModule from "./link-server.ts";

// Publication happens before an app can connect: this sees every message.
const published = vi.hoisted((): LinkMessage[] => []);
vi.mock("./link-server.ts", async (original) => {
  const real = await original<typeof LinkServerModule>();
  return {
    ...real,
    startLinkServer: async (
      ...args: Parameters<typeof real.startLinkServer>
    ) => {
      const server = await real.startLinkServer(...args);
      return {
        ...server,
        publish: (m: LinkMessage) => {
          published.push(m);
          server.publish(m);
        },
      };
    },
  };
});

let n = 0;
function pipePath(): string {
  const name = `idleon-companion-test-${String(process.pid)}-state-${String(n++)}`;
  return process.platform === "win32"
    ? `\\\\.\\pipe\\${name}`
    : join(tmpdir(), `${name}.sock`);
}

const cleanups: (() => unknown)[] = [];
beforeEach(() => {
  published.length = 0;
});
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(ok: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !ok(); i++) await sleep(20);
}

const RESOURCES = "C:\\Invented\\Game\\resources";
const SLICE: StateSlice = {
  sentinel: { char: "Tester", map: 7 },
  pieces: [{ path: ["Cards"], value: "FAKE-STATE-VALUE" }],
  at: 11,
  cycles: { fast: 2, all: 1 },
};

/** A running keeper whose game and reader are fakes. */
async function keeper(opts: { code?: string; resources?: () => string }) {
  let exit: () => void = () => undefined;
  const exited = new Promise<void>((r) => (exit = r));
  const logs: Record<string, unknown>[] = [];
  const reader: { onSlice?: (s: StateSlice) => void } = {};
  let started = false;
  const deps: KeeperDeps = {
    pipePath: pipePath(),
    hashPath: join(
      mkdtempSync(join(tmpdir(), "idleon-keeper-")),
      "game-hash.json",
    ),
    makeDataDir: () => undefined,
    gameCode: () => opts.code,
    launch: (debugPipe) => ({
      pid: 42,
      cdp: debugPipe ? ({} as Cdp) : undefined,
      exited,
    }),
    read: (_cdp, _onReading, _onStatus, _onAttached, _onRead, onSlice) => {
      reader.onSlice = onSlice;
      return { stop: () => Promise.resolve() };
    },
    startApp: () => {
      started = true;
    },
    log: (label, data) => logs.push({ label, ...data }),
    ...(opts.resources ? { resources: opts.resources } : {}),
  };
  const run = runKeeper(deps);
  cleanups.push(() => (exit(), run));
  await until(() => started);
  return { logs, reader };
}

const gameFiles = () => published.filter((m) => m.type === "gameFiles");

test("each slice the reader gives is published as state", async () => {
  const h = await keeper({});
  h.reader.onSlice?.(SLICE);
  h.reader.onSlice?.({ ...SLICE, at: 12 });
  expect(published.filter((m) => m.type === "state")).toEqual([
    { type: "state", slice: SLICE },
    { type: "state", slice: { ...SLICE, at: 12 } },
  ]);
});

test("no value of a slice reaches the log, and state is no label", async () => {
  const h = await keeper({ resources: () => RESOURCES });
  h.reader.onSlice?.(SLICE);
  expect(JSON.stringify(h.logs)).not.toContain("FAKE-STATE-VALUE");
  expect(h.logs.map((l) => l.label)).not.toContain("state");
});

test("the game's folder is published once after a launch with the debugging pipe", async () => {
  await keeper({ resources: () => RESOURCES });
  expect(gameFiles()).toEqual([{ type: "gameFiles", resources: RESOURCES }]);
});

test("a launch without the debugging pipe publishes no folder", async () => {
  await keeper({ code: "debugger;", resources: () => RESOURCES });
  expect(gameFiles()).toEqual([]);
});

test("with no resources function nothing is published and the keeper goes on", async () => {
  const h = await keeper({});
  expect(gameFiles()).toEqual([]);
  expect(h.reader.onSlice).toBeDefined();
});
