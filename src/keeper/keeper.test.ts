// The keeper's flow with fake game, reader and app, over a real local pipe (runs on the CI): it never launches the
// game twice, opens it without the debugging pipe when the game code is suspicious or cannot be checked, or when the
// keeper itself cannot start, and never ends before the game.
import { existsSync, mkdtempSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { createLineDecoder, encodeLine } from "../shared/index.ts";
import type { LinkMessage, Reading, Status } from "../shared/index.ts";
import type { Cdp } from "./cdp.ts";
import { keepAlive, runKeeper } from "./keeper.ts";
import type { KeeperDeps } from "./keeper.ts";
import { startLinkServer } from "./link-server.ts";

let n = 0;
function pipePath(): string {
  const name = `idleon-companion-test-${String(process.pid)}-keeper-${String(n++)}`;
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

interface FakeReader {
  onReading(r: Reading): void;
  onStatus(s: Status): void;
  onAttached(pausedMs: number): void;
}

/** A keeper whose game, reader and app are fakes; `order` records what it did, `exit()` closes the game. */
function harness(gameCode: () => string | undefined) {
  let exit: () => void = () => undefined;
  const exited = new Promise<void>((r) => (exit = r));
  const order: string[] = [];
  const readers: FakeReader[] = [];
  const logs: Record<string, unknown>[] = [];
  const deps: KeeperDeps = {
    pipePath: pipePath(),
    hashPath: join(
      mkdtempSync(join(tmpdir(), "idleon-keeper-")),
      "game-hash.json",
    ),
    makeDataDir: () => undefined,
    gameCode,
    // "launch" opens the game with the debugging pipe, "launch-no-pipe" without it (and then there is no Cdp).
    launch: (debugPipe) => {
      order.push(debugPipe ? "launch" : "launch-no-pipe");
      return { pid: 42, cdp: debugPipe ? ({} as Cdp) : undefined, exited };
    },
    read: (_cdp, onReading, onStatus, onAttached) => {
      order.push("read");
      readers.push({ onReading, onStatus, onAttached });
      return { stop: () => order.push("stop") };
    },
    startApp: () => order.push("app"),
    log: (label, data) => logs.push({ label, ...data }),
  };
  return {
    deps,
    exit: () => {
      exit();
    },
    order,
    readers,
    logs,
  };
}

/** An app on the link: what it got, and a way to send. Closed messages also go to `order`. */
function app(path: string, order: string[] = []) {
  const got: LinkMessage[] = [];
  const s = connect(path);
  s.on("error", () => undefined);
  s.on(
    "data",
    createLineDecoder((m) => {
      got.push(m);
      if (m.type === "status" && m.status.game === "closed")
        order.push("closed");
    }),
  );
  cleanups.push(() => s.destroy());
  return { got, send: (m: LinkMessage) => s.write(encodeLine(m)) };
}

const reading: Reading = {
  t: 1,
  map: 264,
  menu: 3,
  menu2: 0,
  menu2tab: 0,
  skillTab: 0,
  char: "Tester",
  afk: null,
  codexTab: 2,
  codexSel: null,
};

test("a clean game is launched and read, and what the reader sends reaches the app and the log", async () => {
  const h = harness(() => "var a=1;");
  const run = runKeeper(h.deps);
  cleanups.push(() => (h.exit(), run));
  await until(() => h.order.includes("app"));
  expect(h.order).toEqual(["launch", "read", "app"]);
  const a = app(h.deps.pipePath);
  await sleep(50);
  h.readers[0]?.onAttached(268);
  h.readers[0]?.onStatus({ game: "running", reader: "attached" });
  h.readers[0]?.onReading(reading);
  await until(() => a.got.length >= 2);
  expect(a.got).toEqual([
    { type: "status", status: { game: "running", reader: "attached" } },
    { type: "reading", reading },
  ]);
  expect(h.logs).toContainEqual({ label: "attached", id: 42, pausedMs: 268 });
  expect(h.logs).toContainEqual({ label: "reading", id: 42, reading });
});

test("when the game exits the reader stops before the app hears it closed, and the keeper ends", async () => {
  const h = harness(() => "var a=1;");
  const run = runKeeper(h.deps);
  await until(() => h.order.includes("app"));
  app(h.deps.pipePath, h.order);
  await sleep(50);
  h.exit();
  await run;
  await until(() => h.order.includes("closed"));
  expect(h.order.slice(-2)).toEqual(["stop", "closed"]);
});

test("a second keeper launches nothing", async () => {
  const h = harness(() => "var a=1;");
  const first = await startLinkServer(h.deps.pipePath, () => undefined);
  cleanups.push(() => first.close());
  await runKeeper(h.deps);
  expect(h.order).toEqual([]);
  expect(h.logs).toContainEqual({ label: "already-running", id: null });
});

test("a changed game with markers opens without the pipe and is not read this session", async () => {
  const h = harness(() => "x;debugger;y");
  const run = runKeeper(h.deps);
  cleanups.push(() => (h.exit(), run));
  await until(() => h.order.includes("app"));
  expect(h.order).toEqual(["launch-no-pipe", "app"]);
  const a = app(h.deps.pipePath);
  await until(() => a.got.length >= 1);
  expect(a.got).toEqual([
    {
      type: "status",
      status: {
        game: "running",
        reader: "error",
        message:
          "The game code changed and contains: debugger. Reading is off for this session.",
      },
    },
  ]);
});

test("confirming a suspicious update records it and starts nothing this session", async () => {
  const h = harness(() => "x;debugger;y");
  const run = runKeeper(h.deps);
  cleanups.push(() => (h.exit(), run));
  await until(() => h.order.includes("app"));
  const a = app(h.deps.pipePath);
  await until(() => a.got.length >= 1);
  a.send({ type: "confirm-attach" });
  await until(() => existsSync(h.deps.hashPath));
  await sleep(50);
  expect(existsSync(h.deps.hashPath)).toBe(true);
  expect(h.order).toEqual(["launch-no-pipe", "app"]);
});

test("an app.asar whose N.js cannot be read opens the game without the pipe", async () => {
  const h = harness(() => {
    throw new Error("ENOENT");
  });
  const run = runKeeper(h.deps);
  cleanups.push(() => (h.exit(), run));
  await until(() => h.order.includes("app"));
  expect(h.order).toEqual(["launch-no-pipe", "app"]);
  expect(h.logs).toContainEqual({
    label: "game-update-failed",
    id: null,
    error: "Error: ENOENT",
  });
  const a = app(h.deps.pipePath);
  await until(() => a.got.length >= 1);
  expect(a.got).toEqual([
    {
      type: "status",
      status: {
        game: "running",
        reader: "error",
        message: "Could not check the game code: the reader needs an update.",
      },
    },
  ]);
  // There is no hash to remember: a confirmation records nothing.
  a.send({ type: "confirm-attach" });
  await sleep(100);
  expect(existsSync(h.deps.hashPath)).toBe(false);
  expect(h.order).toEqual(["launch-no-pipe", "app"]);
});

test("without an app.asar (not the Steam game) the watch is skipped and the game is read", async () => {
  const h = harness(() => undefined);
  const run = runKeeper(h.deps);
  cleanups.push(() => (h.exit(), run));
  await until(() => h.order.includes("app"));
  expect(h.order).toEqual(["launch", "read", "app"]);
  expect(h.logs).toContainEqual({ label: "game-update-skipped", id: null });
});

test("a link server that fails for another reason still opens the game, without the pipe", async () => {
  const h = harness(() => "var a=1;");
  // Not a pipe path in a folder that exists: EACCES on Windows, ENOENT elsewhere; never EADDRINUSE.
  h.deps.pipePath = join(
    tmpdir(),
    `idleon-no-such-dir-${String(n++)}`,
    "x.sock",
  );
  let ended = false;
  const run = runKeeper(h.deps).then(() => (ended = true));
  await until(() => h.order.includes("app"));
  expect(h.order).toEqual(["launch-no-pipe", "app"]);
  expect(h.logs).toContainEqual(
    expect.objectContaining({ label: "link-failed" }),
  );
  await sleep(50);
  expect(ended).toBe(false);
  h.exit();
  await run;
  expect(ended).toBe(true);
});

test("a data folder that cannot be created still opens the game, without the pipe", async () => {
  const h = harness(() => "var a=1;");
  h.deps.makeDataDir = () => {
    throw new Error("EPERM");
  };
  const run = runKeeper(h.deps);
  cleanups.push(() => (h.exit(), run));
  await until(() => h.order.includes("app"));
  expect(h.order).toEqual(["launch-no-pipe", "app"]);
  expect(h.logs).toContainEqual({
    label: "data-dir-failed",
    id: null,
    error: "Error: EPERM",
  });
});

test("an app that cannot start never ends the keeper before the game", async () => {
  const h = harness(() => "var a=1;");
  h.deps.startApp = () => {
    throw new Error("spawn failed");
  };
  let ended = false;
  const run = runKeeper(h.deps).then(() => (ended = true));
  await until(() => h.order.includes("read"));
  await sleep(50);
  expect(ended).toBe(false);
  expect(h.logs).toContainEqual({
    label: "app-failed",
    id: 42,
    error: "Error: spawn failed",
  });
  h.exit();
  await run;
  expect(ended).toBe(true);
});

test("keepAlive logs uncaught errors instead of ending the keeper", () => {
  const before = {
    exception: process.listeners("uncaughtException"),
    rejection: process.listeners("unhandledRejection"),
  };
  const logs: Record<string, unknown>[] = [];
  keepAlive((label, data) => logs.push({ label, ...data }));
  const onException = process
    .listeners("uncaughtException")
    .find((l) => !before.exception.includes(l));
  const onRejection = process
    .listeners("unhandledRejection")
    .find((l) => !before.rejection.includes(l));
  if (onException) process.off("uncaughtException", onException);
  if (onRejection) process.off("unhandledRejection", onRejection);
  onException?.(new Error("boom"), "uncaughtException");
  onRejection?.("nope", Promise.resolve());
  expect(logs).toEqual([
    { label: "uncaught-exception", error: "Error: boom" },
    { label: "unhandled-rejection", error: "nope" },
  ]);
});

/** One game session of a keeper on code with markers; `confirm` clicks "Connect next time" before the game closes. */
async function sessionWithMarkers(
  hashPath: string | undefined,
  confirm: boolean,
) {
  const h = harness(() => "x;debugger;y");
  if (hashPath) h.deps.hashPath = hashPath;
  const run = runKeeper(h.deps);
  await until(() => h.order.includes("app"));
  const a = app(h.deps.pipePath);
  await until(() => a.got.length >= 1);
  if (confirm) {
    a.send({ type: "confirm-attach" });
    await until(() => existsSync(h.deps.hashPath));
  }
  h.exit();
  await run;
  return { h, a };
}

const isWarning = (m: LinkMessage) =>
  m.type === "status" &&
  m.status.message?.startsWith("The game code changed") === true;

test("an update warning nobody confirmed comes back in the next session", async () => {
  const first = await sessionWithMarkers(undefined, false);
  const second = await sessionWithMarkers(first.h.deps.hashPath, false);
  expect(second.a.got.some(isWarning)).toBe(true);
  expect(second.h.order).not.toContain("read");
});

test("a confirmed update is read without a warning in the next session", async () => {
  const first = await sessionWithMarkers(undefined, true);
  const h = harness(() => "x;debugger;y");
  h.deps.hashPath = first.h.deps.hashPath;
  const run = runKeeper(h.deps);
  cleanups.push(() => (h.exit(), run));
  await until(() => h.order.includes("app"));
  expect(h.order).toEqual(["launch", "read", "app"]);
  expect(h.logs.filter((l) => l.label === "status")).toEqual([]);
});
