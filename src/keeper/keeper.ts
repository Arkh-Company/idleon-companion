// The keeper's flow (spec §4): holds the link pipe, checks the game code, launches the game (with its debugging pipe
// only when the code was checked and is clean), reads it and publishes to the app, and ends only after the game.
// index.ts gives it the real game, reader and app.
import type { Reading, Status } from "../shared/index.ts";
import type { Cdp } from "./cdp.ts";
import { AlreadyRunning, startLinkServer } from "./link-server.ts";
import { checkGameUpdate, recordGameHash } from "./update-watch.ts";

export type KeeperLog = (label: string, data?: Record<string, unknown>) => void;

export interface KeeperDeps {
  pipePath: string;
  /** game-hash.json, the update watch's memory between sessions */
  hashPath: string;
  /** Creates the data folder (logs, game-hash.json); throws when it cannot. */
  makeDataDir(): void;
  /** The installed game's N.js; undefined without an app.asar (as with Edge), throws when app.asar has no readable N.js. */
  gameCode(): string | undefined;
  /** Launches the game, with the debugging pipe only when `debugPipe`; without it there is no Cdp. */
  launch(debugPipe: boolean): {
    pid: number | undefined;
    cdp: Cdp | undefined;
    exited: Promise<unknown>;
  };
  read(
    cdp: Cdp,
    onReading: (r: Reading) => void,
    onStatus: (s: Status) => void,
    onAttached: (pausedMs: number) => void,
    onRead: (t: number) => void,
  ): { stop(): void };
  startApp(): void;
  log: KeeperLog;
}

const errorText = (e: unknown) => String(e);

/** Resolves when the game has exited (or at once when another keeper holds the link). */
export async function runKeeper(d: KeeperDeps): Promise<void> {
  let pid: number | null = null;
  const log: KeeperLog = (label, data) => {
    d.log(label, { id: pid, ...data });
  };
  let confirmed: (() => void) | undefined;
  let server: Awaited<ReturnType<typeof startLinkServer>> | undefined;
  // Spec §3: zero ban risk. Anything that keeps the keeper from checking the game opens it without the debugging pipe.
  let safe = true;
  try {
    server = await startLinkServer(d.pipePath, () => {
      const run = confirmed;
      confirmed = undefined; // a second click does nothing
      run?.();
    });
  } catch (e) {
    if (e instanceof AlreadyRunning) {
      log("already-running");
      return;
    }
    log("link-failed", { error: errorText(e) }); // the game never depends on the app: it still opens
    safe = false;
  }
  try {
    d.makeDataDir();
  } catch (e) {
    log("data-dir-failed", { error: errorText(e) });
    safe = false;
  }

  /** A hash that cannot be saved is only logged: the next session checks (and warns) again. */
  const saveHash = (hash: string) => {
    try {
      recordGameHash(hash, d.hashPath);
    } catch (e) {
      log("game-hash-not-saved", { error: errorText(e) });
    }
  };
  let warning: string | undefined;
  if (safe) {
    try {
      const code = d.gameCode();
      if (code === undefined) log("game-update-skipped");
      else {
        const { markers, hash, changed } = checkGameUpdate(code, d.hashPath);
        log("game-update", { changed, hash, markers });
        // Spec §7.2: a changed game code with detection markers is not read this session. "Connect next time"
        // records it, so the next session reads it without a warning; until then every session warns again.
        if (markers.length > 0) {
          safe = false;
          warning = `The game code changed and contains: ${markers.join(", ")}. Reading is off for this session.`;
          confirmed = () => {
            saveHash(hash);
          };
        } else if (changed) saveHash(hash); // clean code was checked: a failed save keeps the pipe
      }
    } catch (e) {
      // app.asar is there but its N.js cannot be read (or checked): fail closed, with nothing to remember.
      log("game-update-failed", { error: errorText(e) });
      safe = false;
      warning = "Could not check the game code: the reader needs an update.";
    }
  }

  const game = d.launch(safe);
  pid = game.pid ?? null;
  log("game-started", { debugPipe: safe });
  // Every status the app gets carries the time of the last good reading, once there is one (spec §5.6).
  let lastStatus: Status | undefined;
  let lastReadingAt: number | undefined;
  const sendStatus = () => {
    if (!lastStatus) return;
    const status =
      lastReadingAt === undefined
        ? lastStatus
        : { ...lastStatus, lastReadingAt };
    server?.publish({ type: "status", status });
  };
  const publishStatus = (status: Status) => {
    log("status", { ...status });
    lastStatus = status;
    sendStatus();
  };
  let reader: { stop(): void } | undefined;
  const startReading = (cdp: Cdp) => {
    reader = d.read(
      cdp,
      (reading) => {
        log("reading", { reading });
        server?.publish({ type: "reading", reading });
      },
      publishStatus,
      (pausedMs) => {
        log("attached", { pausedMs });
      },
      // Once a second: republished to the app, not logged.
      (t) => {
        lastReadingAt = t;
        sendStatus();
      },
    );
  };
  // Only a game launched with the pipe has a Cdp, so nothing can read a game opened without it.
  if (game.cdp) startReading(game.cdp);
  else if (warning)
    publishStatus({ game: "running", reader: "error", message: warning });

  try {
    d.startApp();
  } catch (e) {
    log("app-failed", { error: errorText(e) }); // the game goes on; the app can be opened by hand
  }

  await game.exited;
  confirmed = undefined;
  reader?.stop();
  publishStatus({ game: "closed", reader: "error" });
  await server?.close();
  log("keeper-exit");
}

/** While the game runs, an error nobody caught is logged: ending the keeper would close the game's pipe and the game. */
export function keepAlive(log: KeeperLog): void {
  process.on("uncaughtException", (e) => {
    log("uncaught-exception", { error: errorText(e) });
  });
  process.on("unhandledRejection", (e) => {
    log("unhandled-rejection", { error: errorText(e) });
  });
}
