// "Let the game close" and "Reconnect" (research R7, contracts/link.md) with a fake game and reader over a real local
// pipe (runs on the CI): the debugging pipe is never closed, and a reconnect is exactly one new `read`.
import { mkdtempSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { createLineDecoder, encodeLine } from "../shared/index.ts";
import type { LinkMessage, Status } from "../shared/index.ts";
import type { Cdp } from "./cdp.ts";
import { runKeeper } from "./keeper.ts";
import type { KeeperDeps } from "./keeper.ts";

let n = 0;
function pipePath(): string {
  const name = `idleon-companion-test-${String(process.pid)}-release-${String(n++)}`;
  return process.platform === "win32"
    ? `\\\\.\\pipe\\${name}`
    : join(tmpdir(), `${name}.sock`);
}

const cleanups: (() => unknown)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(ok: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !ok(); i++) await sleep(20);
}

/** A running keeper whose game and reader are fakes; `gameCode` with a marker opens the game without the pipe. */
async function keeper(gameCode = "var a=1;") {
  let exit: () => void = () => undefined;
  const exited = new Promise<void>((r) => (exit = r));
  const order: string[] = [];
  const cdps: Cdp[] = [];
  const onStatus: ((s: Status) => void)[] = [];
  const logs: Record<string, unknown>[] = [];
  const close = vi.fn();
  const cdp = { close } as unknown as Cdp;
  const h = {
    order,
    cdps,
    cdp,
    close,
    onStatus,
    logs,
    /** What the reader's stop answers; replaced to keep a stop pending. */
    stop: () => Promise.resolve(),
    exit: () => {
      exit();
    },
    reads: () => order.filter((x) => x === "read").length,
    stops: () => order.filter((x) => x === "stop").length,
    deps: undefined as unknown as KeeperDeps,
    run: Promise.resolve(),
  };
  h.deps = {
    pipePath: pipePath(),
    hashPath: join(
      mkdtempSync(join(tmpdir(), "idleon-keeper-")),
      "game-hash.json",
    ),
    makeDataDir: () => undefined,
    gameCode: () => gameCode,
    launch: (debugPipe) => {
      order.push(debugPipe ? "launch" : "launch-no-pipe");
      return { pid: 42, cdp: debugPipe ? cdp : undefined, exited };
    },
    read: (c, _onReading, status) => {
      order.push("read");
      cdps.push(c);
      onStatus.push(status);
      return {
        stop: () => {
          order.push("stop");
          return h.stop();
        },
      };
    },
    startApp: () => order.push("app"),
    log: (label, data) => logs.push({ label, ...data }),
  };
  h.run = runKeeper(h.deps);
  cleanups.push(() => (h.exit(), h.run));
  await until(() => order.includes("app"));
  return h;
}

/** An app on the link: the statuses it got, and a way to send. */
async function app(path: string) {
  const statuses: Status[] = [];
  const s = connect(path);
  s.on("error", () => undefined);
  s.on(
    "data",
    createLineDecoder((m) => {
      if (m.type === "status") statuses.push(m.status);
    }),
  );
  cleanups.push(() => s.destroy());
  await sleep(50);
  return {
    statuses,
    send: (m: LinkMessage) => s.write(encodeLine(m)),
    released: () => statuses.some((x) => x.reader === "released"),
  };
}

const RELEASE: LinkMessage = { type: "release" };
const RECONNECT: LinkMessage = { type: "reconnect" };
const RELEASED: Status = { game: "running", reader: "released" };

test("a release while reading stops the reader, says so, and leaves the game and its pipe alone", async () => {
  const h = await keeper();
  const a = await app(h.deps.pipePath);
  let ended = false;
  void h.run.then(() => (ended = true));
  a.send(RELEASE);
  await until(a.released);
  expect(h.order).toEqual(["launch", "read", "app", "stop"]);
  expect(a.statuses.at(-1)).toEqual(RELEASED);
  expect(h.close).not.toHaveBeenCalled();
  expect(ended).toBe(false);
});

test("the released status waits for the reader to let the game go", async () => {
  const h = await keeper();
  let letGo: () => void = () => undefined;
  h.stop = () => new Promise<void>((r) => (letGo = r));
  const a = await app(h.deps.pipePath);
  a.send(RELEASE);
  await until(() => h.stops() === 1);
  await sleep(50);
  expect(a.released()).toBe(false);
  letGo();
  await until(a.released);
  expect(a.statuses.at(-1)).toEqual(RELEASED);
});

test("a reconnect after a release starts one new read on the same pipe, and the status goes back to attached", async () => {
  const h = await keeper();
  const a = await app(h.deps.pipePath);
  a.send(RELEASE);
  await until(a.released);
  a.send(RECONNECT);
  await until(() => h.reads() === 2);
  expect(h.order).toEqual(["launch", "read", "app", "stop", "read"]);
  expect(h.cdps[1]).toBe(h.cdp);
  h.onStatus[1]?.({ game: "running", reader: "attached" });
  await until(() => a.statuses.at(-1)?.reader === "attached");
  expect(a.statuses.at(-1)).toEqual({ game: "running", reader: "attached" });
  expect(h.close).not.toHaveBeenCalled();
});

test("the new reader can be released again", async () => {
  const h = await keeper();
  const a = await app(h.deps.pipePath);
  a.send(RELEASE);
  await until(a.released);
  a.send(RECONNECT);
  await until(() => h.reads() === 2);
  a.send(RELEASE);
  await until(() => h.stops() === 2);
  expect(h.stops()).toBe(2);
});

test("a reconnect without a release is ignored", async () => {
  const h = await keeper();
  const a = await app(h.deps.pipePath);
  a.send(RECONNECT);
  await sleep(100);
  expect(h.reads()).toBe(1);
  expect(h.logs.map((l) => l.label)).not.toContain("reconnect");
});

test("a second reconnect after the first is ignored: one new pause only", async () => {
  const h = await keeper();
  const a = await app(h.deps.pipePath);
  a.send(RELEASE);
  await until(a.released);
  a.send(RECONNECT);
  a.send(RECONNECT);
  await until(() => h.reads() === 2);
  await sleep(100);
  expect(h.reads()).toBe(2);
});

test("a release with no reader (the game opened without the pipe) is ignored", async () => {
  const h = await keeper("x;debugger;y");
  expect(h.order).toEqual(["launch-no-pipe", "app"]);
  const a = await app(h.deps.pipePath);
  a.send(RELEASE);
  await sleep(100);
  expect(a.released()).toBe(false);
  expect(h.logs.map((l) => l.label)).not.toContain("released");
});

test("a second release is ignored: the reader is stopped once", async () => {
  const h = await keeper();
  const a = await app(h.deps.pipePath);
  a.send(RELEASE);
  await until(a.released);
  a.send(RELEASE);
  await sleep(100);
  expect(h.stops()).toBe(1);
  expect(a.statuses.filter((s) => s.reader === "released")).toHaveLength(1);
});

test("a release and a reconnect sent at once start the new reader only after the old stop resolved", async () => {
  const h = await keeper();
  let letGo: () => void = () => undefined;
  h.stop = () => new Promise<void>((r) => (letGo = r));
  const a = await app(h.deps.pipePath);
  a.send(RELEASE);
  a.send(RECONNECT);
  await until(() => h.stops() === 1);
  await sleep(100);
  expect(h.reads()).toBe(1);
  letGo();
  await until(() => h.reads() === 2);
  expect(h.order).toEqual(["launch", "read", "app", "stop", "read"]);
});

test("the game exiting while released ends the keeper as in 001", async () => {
  const h = await keeper();
  const a = await app(h.deps.pipePath);
  a.send(RELEASE);
  await until(a.released);
  h.exit();
  await h.run;
  await until(() => a.statuses.at(-1)?.game === "closed");
  expect(a.statuses.at(-1)).toEqual({ game: "closed", reader: "error" });
  expect(h.stops()).toBe(1);
  expect(h.logs.at(-1)).toEqual({ label: "keeper-exit", id: 42 });
});

test("a release still finishing when the game exits never says released after closed", async () => {
  const h = await keeper();
  let letGo: () => void = () => undefined;
  h.stop = () => new Promise<void>((r) => (letGo = r));
  const a = await app(h.deps.pipePath);
  a.send(RELEASE);
  await until(() => h.stops() === 1);
  h.exit();
  await until(() => a.statuses.at(-1)?.game === "closed");
  letGo();
  await h.run;
  await sleep(50);
  expect(a.released()).toBe(false);
  expect(h.logs.map((l) => l.label)).not.toContain("released");
});

test("a reconnect that arrives as the game exits starts nothing", async () => {
  const h = await keeper();
  const a = await app(h.deps.pipePath);
  a.send(RELEASE);
  await until(a.released);
  const log = h.deps.log;
  h.deps.log = (label, data) => {
    log(label, data);
    if (label === "status" && data?.game === "closed") a.send(RECONNECT);
  };
  h.exit();
  await h.run;
  await sleep(50);
  expect(h.reads()).toBe(1);
});

test("the released and reconnect log lines carry the game pid", async () => {
  const h = await keeper();
  const a = await app(h.deps.pipePath);
  a.send(RELEASE);
  await until(a.released);
  a.send(RECONNECT);
  await until(() => h.reads() === 2);
  expect(h.logs).toContainEqual({ label: "released", id: 42 });
  expect(h.logs).toContainEqual({ label: "reconnect", id: 42 });
});
