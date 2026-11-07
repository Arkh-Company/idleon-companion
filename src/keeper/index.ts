// Keeper entry: what Steam starts (scripts/steam-launch.cmd), as electron.exe with ELECTRON_RUN_AS_NODE=1, with the
// game's exe and args. Plain Node: no Electron import. Built to out/main/keeper.js.
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { LINK_PIPE } from "../shared/index.ts";
import { keepAlive, runKeeper } from "./keeper.ts";
import type { KeeperLog } from "./keeper.ts";
import { launchGame } from "./launch.ts";
import { loadReadSource } from "./read-source.ts";
import { startReader } from "./reader.ts";
import { readInstalledGameCode } from "./update-watch.ts";

const dataDir = join(process.env.APPDATA ?? homedir(), "IdleOn Companion");
const logFile = join(dataDir, "keeper.log");
// out/main/keeper.js → the repository root, where package.json points Electron at the app.
const repoRoot = resolve(import.meta.dirname, "../..");
const readJs = join(repoRoot, "src/keeper/read.js");

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
  delete env.ELECTRON_RUN_AS_NODE; // the app is a real Electron app
  spawn(process.execPath, [repoRoot, "--from-steam"], {
    detached: true,
    stdio: "ignore",
    env,
  })
    .on("error", (e) => {
      log("app-failed", { error: String(e) });
    })
    .unref();
}

async function main(): Promise<number> {
  keepAlive(log);
  const [exe, ...args] = process.argv.slice(2);
  if (exe === undefined) {
    log("no-game", { error: "usage: keeper.js <game exe> [game args...]" });
    return 1;
  }
  await runKeeper({
    pipePath: LINK_PIPE,
    hashPath: join(dataDir, "game-hash.json"),
    makeDataDir: () => {
      mkdirSync(dataDir, { recursive: true });
    },
    gameCode: () =>
      readInstalledGameCode(join(dirname(exe), "resources", "app.asar")),
    launch: (debugPipe) => {
      const g = launchGame(exe, args, join(dataDir, "game.log"), {
        debugPipe,
      });
      return { pid: g.child.pid, cdp: g.cdp, exited: g.exited };
    },
    // read.js is loaded on every cycle, so a change to it takes effect without reopening the game (spec §5.2).
    read: (cdp, onReading, onStatus, onAttached) =>
      startReader(cdp, () => loadReadSource(readJs), onReading, onStatus, {
        onAttached,
      }),
    startApp,
    log,
  });
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    log("keeper-failed", { error: String(e) });
    process.exit(1);
  },
);
