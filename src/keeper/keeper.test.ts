// The keeper's flow with fake game, reader and app, over a real local pipe (runs on the CI): it never launches the
// game twice, opens it without the debugging pipe when the keeper itself cannot start, and never ends before the game.
// The game code's check is in keeper-update.test.ts.
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import {
  app,
  cleanUp,
  cleanups,
  harness,
  reading,
  sleep,
  uniqueName,
  until,
} from "./keeper-fixture.ts";
import { keepAlive, runKeeper } from "./keeper.ts";
import { startLinkServer } from "./link-server.ts";

afterEach(cleanUp);

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

test("every good reading republishes the last status with its time, without a log line", async () => {
  const h = harness(() => "var a=1;");
  const run = runKeeper(h.deps);
  cleanups.push(() => (h.exit(), run));
  await until(() => h.order.includes("app"));
  const a = app(h.deps.pipePath);
  await sleep(50);
  h.readers[0]?.onStatus({ game: "running", reader: "attached" });
  h.readers[0]?.onRead(5000);
  h.readers[0]?.onRead(6000);
  await until(() => a.got.length >= 3);
  expect(a.got).toEqual([
    { type: "status", status: { game: "running", reader: "attached" } },
    {
      type: "status",
      status: { game: "running", reader: "attached", lastReadingAt: 5000 },
    },
    {
      type: "status",
      status: { game: "running", reader: "attached", lastReadingAt: 6000 },
    },
  ]);
  expect(h.logs.filter((l) => l.label === "status")).toHaveLength(1);
});

test("a status from the reader keeps the time of the last good reading", async () => {
  const h = harness(() => "var a=1;");
  const run = runKeeper(h.deps);
  cleanups.push(() => (h.exit(), run));
  await until(() => h.order.includes("app"));
  const a = app(h.deps.pipePath);
  await sleep(50);
  h.readers[0]?.onStatus({ game: "running", reader: "attached" });
  h.readers[0]?.onRead(5000);
  h.readers[0]?.onStatus({
    game: "running",
    reader: "attached",
    message: "Reading failed: boom",
  });
  await until(() => a.got.length >= 3);
  expect(a.got[2]).toEqual({
    type: "status",
    status: {
      game: "running",
      reader: "attached",
      message: "Reading failed: boom",
      lastReadingAt: 5000,
    },
  });
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

test("a link server that fails for another reason still opens the game, without the pipe", async () => {
  const h = harness(() => "var a=1;");
  // Not a pipe path in a folder that exists: EACCES on Windows, ENOENT elsewhere; never EADDRINUSE.
  h.deps.pipePath = join(
    tmpdir(),
    `idleon-no-such-dir-${uniqueName()}`,
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

test("a data folder that cannot be created tells the app reading is off", async () => {
  const h = harness(() => "var a=1;");
  h.deps.makeDataDir = () => {
    throw new Error("EPERM");
  };
  const run = runKeeper(h.deps);
  cleanups.push(() => (h.exit(), run));
  await until(() => h.order.includes("app"));
  const a = app(h.deps.pipePath);
  await until(() => a.got.length >= 1);
  expect(a.got).toEqual([
    {
      type: "status",
      status: {
        game: "running",
        reader: "error",
        message:
          "Could not create the data folder: reading is off for this session.",
      },
    },
  ]);
});

test("the data folder is made before the link server, so link-failed reaches the log", async () => {
  const h = harness(() => "var a=1;");
  h.deps.pipePath = join(tmpdir(), `idleon-no-such-dir-${uniqueName()}`, "x");
  h.deps.makeDataDir = () => h.logs.push({ label: "data-dir-made" });
  const run = runKeeper(h.deps);
  cleanups.push(() => (h.exit(), run));
  await until(() => h.order.includes("app"));
  const labels = h.logs.map((l) => l.label);
  expect(labels.indexOf("data-dir-made")).toBeGreaterThanOrEqual(0);
  expect(labels.indexOf("data-dir-made")).toBeLessThan(
    labels.indexOf("link-failed"),
  );
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

test("keepAlive logs uncaught errors, with the game pid, instead of ending the keeper", () => {
  const before = {
    exception: process.listeners("uncaughtException"),
    rejection: process.listeners("unhandledRejection"),
  };
  const logs: Record<string, unknown>[] = [];
  keepAlive(
    (label, data) => logs.push({ label, ...data }),
    () => 42,
  );
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
    { label: "uncaught-exception", id: 42, error: "Error: boom" },
    { label: "unhandled-rejection", id: 42, error: "nope" },
  ]);
});
