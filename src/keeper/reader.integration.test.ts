// The keeper's reader against the mock game in a headless Edge (opt-in: IDLEON_EDGE_TESTS=1, Windows only), and the
// launch arguments (everywhere). `just check` and the CI never start Edge: tests use no real network, and Edge cannot
// promise none of its own.
import { spawnSync } from "node:child_process";
import type { SpawnOptions, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Reading, Status } from "../shared/index.ts";
import { launchGame } from "./launch.ts";
import { loadReadSource } from "./read-source.ts";
import { startReader } from "./reader.ts";

const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const readSrc = loadReadSource(join(import.meta.dirname, "read.js"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const dirs: string[] = [];
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "idleon-reader-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true, maxRetries: 5 });
    } catch {
      // Edge may still hold a file for a moment; the temp folder is the OS's to clean.
    }
  }
});

test("exe path with spaces and parentheses keeps every arg", () => {
  const fakeSpawn = vi.fn<
    (exe: string, args: string[], options: SpawnOptions) => EventEmitter
  >(() =>
    Object.assign(new EventEmitter(), {
      stdio: [null, null, null, new PassThrough(), new PassThrough()],
    }),
  );
  const exe =
    "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Legends of Idleon\\LegendsOfIdleon.exe";
  launchGame(
    exe,
    ["-novsync", "--foo=bar baz"],
    join(tempDir(), "game.log"),
    {},
    fakeSpawn as unknown as typeof spawn,
  );
  expect(fakeSpawn).toHaveBeenCalledWith(
    exe,
    ["-novsync", "--foo=bar baz", "--remote-debugging-pipe"],
    expect.objectContaining({
      stdio: ["ignore", expect.anything(), expect.anything(), "pipe", "pipe"],
    }),
  );
  expect(fakeSpawn.mock.calls[0]?.[2].env?.ELECTRON_ENABLE_LOGGING).toBe("1");
});

test("the game never inherits the keeper's ELECTRON_RUN_AS_NODE", () => {
  const fakeSpawn = vi.fn<
    (exe: string, args: string[], options: SpawnOptions) => EventEmitter
  >(() =>
    Object.assign(new EventEmitter(), {
      stdio: [null, null, null, new PassThrough(), new PassThrough()],
    }),
  );
  vi.stubEnv("ELECTRON_RUN_AS_NODE", "1");
  try {
    launchGame(
      "game.exe",
      [],
      join(tempDir(), "game.log"),
      {},
      fakeSpawn as unknown as typeof spawn,
    );
  } finally {
    vi.unstubAllEnvs();
  }
  // The game is an Electron app too: with this variable it would start as plain Node, with no window.
  expect(fakeSpawn.mock.calls[0]?.[2].env).not.toHaveProperty(
    "ELECTRON_RUN_AS_NODE",
  );
});

/** A spawn that records its call and returns a child with no real process behind it. */
function noPipeSpawn() {
  return vi.fn<
    (exe: string, args: string[], options: SpawnOptions) => EventEmitter
  >(() => Object.assign(new EventEmitter(), { stdio: [null, null, null] }));
}

test("without the debugging pipe the Steam args pass unchanged, with no pipes and no ELECTRON_RUN_AS_NODE", () => {
  const fakeSpawn = noPipeSpawn();
  vi.stubEnv("ELECTRON_RUN_AS_NODE", "1");
  let launched: ReturnType<typeof launchGame>;
  try {
    launched = launchGame(
      "game.exe",
      ["-novsync", "--foo=bar baz"],
      join(tempDir(), "game.log"),
      { debugPipe: false },
      fakeSpawn as unknown as typeof spawn,
    );
  } finally {
    vi.unstubAllEnvs();
  }
  expect(fakeSpawn).toHaveBeenCalledWith(
    "game.exe",
    ["-novsync", "--foo=bar baz"],
    expect.objectContaining({
      stdio: ["ignore", expect.anything(), expect.anything()],
    }),
  );
  expect(fakeSpawn.mock.calls[0]?.[2].env).not.toHaveProperty(
    "ELECTRON_RUN_AS_NODE",
  );
  expect(launched.cdp).toBeUndefined();
});

test("a game log that cannot be opened still launches the game", () => {
  const fakeSpawn = noPipeSpawn();
  launchGame(
    "game.exe",
    [],
    join(tempDir(), "missing-folder", "game.log"),
    { debugPipe: false },
    fakeSpawn as unknown as typeof spawn,
  );
  expect(fakeSpawn.mock.calls[0]?.[2].stdio).toEqual([
    "ignore",
    "ignore",
    "ignore",
  ]);
});

/** Kills the Edge process the test started and every process under it (only those). */
function killTree(pid: number | undefined): void {
  if (pid !== undefined)
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
    });
}

describe.skipIf(process.env.IDLEON_EDGE_TESTS !== "1" || !existsSync(EDGE))(
  "reader against the mock game in Edge",
  () => {
    const mock = pathToFileURL(
      join(import.meta.dirname, "mock-game", "app.html"),
    ).href;

    function edge(url: string) {
      const dir = tempDir();
      const g = launchGame(
        EDGE,
        [
          "--headless=new",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-gpu",
          "--disable-background-networking",
          "--disable-component-update",
          "--disable-sync",
          `--user-data-dir=${join(dir, "profile")}`,
          url,
        ],
        join(dir, "game.log"),
      );
      if (!g.cdp) throw new Error("launched without the debugging pipe");
      return { ...g, cdp: g.cdp };
    }

    /** Runs the reader for `ms` and returns its statuses and readings in the order they came. */
    async function run(
      url: string,
      ms: number,
      readSource: () => string,
      opts?: Parameters<typeof startReader>[4],
    ) {
      const events: (
        | { kind: "status"; status: Status }
        | { kind: "reading"; reading: Reading }
      )[] = [];
      const g = edge(url);
      const r = startReader(
        g.cdp,
        readSource,
        (reading) => events.push({ kind: "reading", reading }),
        (status) => events.push({ kind: "status", status }),
        opts,
      );
      try {
        await sleep(ms);
      } finally {
        r.stop();
        killTree(g.child.pid);
        await g.exited;
      }
      const attachedAt = events.flatMap((e, i) =>
        e.kind === "status" && e.status.reader === "attached" ? [i] : [],
      );
      const readings = events.flatMap((e) =>
        e.kind === "reading" ? [e.reading] : [],
      );
      return { events, attachedAt, readings };
    }

    test("reads changes, pauses once, survives a reload", async () => {
      const { events, attachedAt, readings } = await run(
        `${mock}?reload=1`,
        12000,
        () => readSrc,
      );
      // one pause for the first load and one for the reload, never more
      expect(attachedAt).toHaveLength(2);
      // readings go on after the engine is taken again
      const second = attachedAt[1] ?? events.length;
      expect(events.slice(second).some((e) => e.kind === "reading")).toBe(true);
      expect(new Set(readings.map((x) => x.map)).size).toBeGreaterThan(3);
      expect(readings[0]).toMatchObject({
        menu: 3,
        char: "Tester",
        codexTab: 2,
      });
    }, 30000);

    test("an exception inside read.js never takes the engine again", async () => {
      const { attachedAt, readings } = await run(
        mock,
        4000,
        () => "(function () { throw new Error('x'); })",
        { retryMs: 500 },
      );
      expect(attachedAt).toHaveLength(1);
      expect(readings).toEqual([]);
    }, 30000);

    test("the game closing rejects in-flight requests with no unhandled rejection", async () => {
      const unhandled: unknown[] = [];
      const onUnhandled = (e: unknown) => unhandled.push(e);
      process.on("unhandledRejection", onUnhandled);
      try {
        const g = edge(mock);
        const pending = g.cdp.send("Target.getTargets");
        // Killed in the same tick, before Edge can answer (taskkill is too slow for that); Edge's own child
        // processes exit with it.
        g.child.kill();
        await expect(pending).rejects.toThrow("the game closed");
        await g.exited;
        await sleep(100);
        expect(unhandled).toEqual([]);
      } finally {
        process.off("unhandledRejection", onUnhandled);
      }
    }, 30000);

    test("a missing anchor reports the game-updated message and no reading", async () => {
      const readings: Reading[] = [];
      const statuses: Status[] = [];
      const g = edge(mock);
      const r = startReader(
        g.cdp,
        () => readSrc,
        (x) => readings.push(x),
        (s) => statuses.push(s),
        { anchor: "noSuchAnchor:function(", retryMs: 60000 },
      );
      try {
        for (
          let i = 0;
          i < 40 && !statuses.some((s) => s.reader === "error");
          i++
        )
          await sleep(250);
      } finally {
        r.stop();
        killTree(g.child.pid);
        await g.exited;
      }
      expect(statuses).toContainEqual({
        game: "running",
        reader: "error",
        message: "Game updated: the reader needs an update",
      });
      expect(readings).toEqual([]);
    }, 30000);
  },
);
