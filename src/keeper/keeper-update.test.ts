// The game code checked before the keeper reads (spec 002, over a real local pipe, runs on the CI): a changed game
// with markers, or one whose code cannot be checked, opens without the debugging pipe; a confirmed update is read in
// the next session, and clean code is recorded. Fake game, reader and app; every value and name is invented.
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import type { LinkMessage } from "../shared/index.ts";
import {
  linkApp,
  cleanUp,
  cleanups,
  harness,
  sleep,
  until,
} from "./keeper-fixture.ts";
import { runKeeper } from "./keeper.ts";
import { checkGameUpdate } from "./update-watch.ts";

const app = linkApp(connect);
afterEach(cleanUp);

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

test("clean code is recorded by the keeper, so the next session sees it unchanged", async () => {
  const h = harness(() => "var a=1;");
  const run = runKeeper(h.deps);
  cleanups.push(() => (h.exit(), run));
  await until(() => h.order.includes("app"));
  expect(checkGameUpdate("var a=1;", h.deps.hashPath).changed).toBe(false);
});

test("clean code whose hash cannot be saved is still read", async () => {
  const h = harness(() => "var a=1;");
  const file = join(mkdtempSync(join(tmpdir(), "idleon-keeper-")), "a-file");
  writeFileSync(file, "");
  h.deps.hashPath = join(file, "game-hash.json");
  const run = runKeeper(h.deps);
  cleanups.push(() => (h.exit(), run));
  await until(() => h.order.includes("app"));
  expect(h.order).toEqual(["launch", "read", "app"]);
  expect(h.logs).toContainEqual(
    expect.objectContaining({ label: "game-hash-not-saved", id: null }),
  );
  expect(h.logs.map((l) => l.label)).not.toContain("game-update-failed");
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
