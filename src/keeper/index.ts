// Keeper entry: Steam starts the companion's exe as `"<exe>" --keeper %command%`, and out/main/start.js loads this
// bundle (out/main/keeper.js) in Electron's main process. Still plain Node code: no Electron import.
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { LINK_PIPE } from "../shared/index.ts";
import type { Cdp } from "./cdp.ts";
import { appCommand, gameCommand, readJsPath } from "./command-line.ts";
import type { EngineRef } from "./engine-ref.ts";
import { keepAlive, runKeeper } from "./keeper.ts";
import type { KeeperDeps, KeeperLog } from "./keeper.ts";
import { launchGame } from "./launch.ts";
import { loadReadSource } from "./read-source.ts";
import { startReader } from "./reader.ts";
import { oneAtATime, startStateReader } from "./state-reader.ts";
import { readInstalledGameCode } from "./update-watch.ts";
import { createVarsReader } from "./vars-reader.ts";

const dataDir = join(process.env.APPDATA ?? homedir(), "IdleOn Companion");
const logFile = join(dataDir, "keeper.log");
// out/main/keeper.js → the repository root (in development, the folder Electron was given) or app.asar (packaged).
const repoRoot = resolve(import.meta.dirname, "../..");
// ponytail: Electron types it as boolean, but it is undefined when packaged; only its truthiness is used.
const defaultApp = process.defaultApp;
const paths = {
  defaultApp,
  resourcesPath: process.resourcesPath,
  repoRoot,
};
const readJs = readJsPath(paths);

/** The game's pid once it is launched: every keeper.log line carries it as `id` (null before the launch). */
let gamePid: number | null = null;

// ponytail: keeper.log only grows (one line per changed reading); rotate it if it ever gets large.
const log: KeeperLog = (label, data) => {
  try {
    appendFileSync(
      logFile,
      `${JSON.stringify({ t: Date.now(), label, ...data })}\n`,
    );
  } catch {
    // a log that cannot be written never ends the keeper
  }
};

function startApp(): void {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE; // the app is a real Electron app (harmless now: Steam never sets it)
  const app = appCommand({
    execPath: process.execPath,
    defaultApp,
    appPath: repoRoot,
  });
  spawn(app.file, app.args, {
    detached: true,
    stdio: "ignore",
    env,
  })
    .on("error", (e) => {
      log("app-failed", { id: gamePid, error: String(e) });
    })
    .unref();
}

const logStateFailing = () => {
  log("state-read-failing", { id: gamePid });
};

/** Once for the whole session; a missing script only turns the state reading off: ending the keeper closes the game. */
function loadStateScripts(): {
  listSource: string;
  sliceSource: string;
} | null {
  try {
    return {
      listSource: loadReadSource(readJsPath(paths, "state-list.js")),
      sliceSource: loadReadSource(readJsPath(paths, "state-slice.js")),
    };
  } catch {
    logStateFailing();
    return null;
  }
}

/** The 1 s reader and, sharing its engine and one read at a time, the reader of the state. */
const startReaders =
  (scripts: ReturnType<typeof loadStateScripts>): KeeperDeps["read"] =>
  (cdp, onReading, onStatus, onAttached, onRead, onSlice) => {
    const turn = oneAtATime();
    let engine: EngineRef | null = null;
    const reader = startReader(
      cdp,
      () => loadReadSource(readJs),
      onReading,
      onStatus,
      {
        onAttached,
        onRead,
        onEngine: (ref) => {
          engine = ref;
        },
        turn,
      },
    );
    if (!scripts) return reader;
    const send: Cdp["send"] = (...args) => cdp.send(...args);
    const state = startStateReader({
      send,
      engine: () => engine,
      ...scripts,
      turn,
      onSlice,
      onFailing: logStateFailing,
      vars: createVarsReader(send, scripts.sliceSource),
    });
    return {
      async stop() {
        await state.stop();
        await reader.stop();
      },
    };
  };

async function main(): Promise<number> {
  keepAlive(log, () => gamePid);
  const game = gameCommand(process.argv);
  if (game === null) {
    log("no-game", {
      id: null,
      error: "usage: <exe> --keeper <game exe> [game args...]",
    });
    return 1;
  }
  const { exe, args } = game;
  await runKeeper({
    pipePath: LINK_PIPE,
    hashPath: join(dataDir, "game-hash.json"),
    makeDataDir: () => {
      mkdirSync(dataDir, { recursive: true });
    },
    gameCode: () => readInstalledGameCode(exe),
    launch: (debugPipe) => {
      const g = launchGame(exe, args, join(dataDir, "game.log"), {
        debugPipe,
      });
      gamePid = g.child.pid ?? null;
      return { pid: g.child.pid, cdp: g.cdp, exited: g.exited };
    },
    // read.js is loaded on every cycle, so a change to it takes effect without reopening the game (spec §5.2).
    read: startReaders(loadStateScripts()),
    resources: () => join(dirname(exe), "resources"),
    startApp,
    log,
  });
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    log("keeper-failed", { id: gamePid, error: String(e) });
    process.exit(1);
  },
);
