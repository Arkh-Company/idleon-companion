// The keeper's flow (spec §4): holds the link pipe, checks the game code, launches the game (with its debugging pipe
// only when the code was checked and is clean), reads it and publishes to the app, and ends only after the game.
// index.ts gives it the real game, reader and app.
import type { GameTables, Reading, Status } from "../shared/index.ts";
import type { Cdp } from "./cdp.ts";
import { readGameTables } from "./game-tables.ts";
import { AlreadyRunning, startLinkServer } from "./link-server.ts";
import { checkGameUpdate, recordGameHash } from "./update-watch.ts";

export type KeeperLog = (label: string, data?: Record<string, unknown>) => void;

export interface KeeperDeps {
  pipePath: string;
  /** game-hash.json, the update watch's memory between sessions */
  hashPath: string;
  /** Creates the data folder (logs, game-hash.json); throws when it cannot. */
  makeDataDir(): void;
  /**
   * The installed game's N.js, from app.asar or the unpacked resources folder; undefined when neither is there and the
   * exe is not the game's (as with Edge); throws when the code cannot be read, or the game's exe has neither.
   */
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
  ): { stop(): Promise<void> };
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
  /** "Let the game close" and "Reconnect": a message before the game is launched does nothing. */
  let onReaderMessage: (m: "release" | "reconnect") => void = () => undefined;
  let server: Awaited<ReturnType<typeof startLinkServer>> | undefined;
  // Spec §3: zero ban risk. Anything that keeps the keeper from checking the game opens it without the debugging pipe.
  let safe = true;
  let warning: string | undefined;
  // First, so every later line (link-failed included) has a folder to go to.
  try {
    d.makeDataDir();
  } catch (e) {
    log("data-dir-failed", { error: errorText(e) });
    safe = false;
    warning =
      "Could not create the data folder: reading is off for this session.";
  }
  try {
    server = await startLinkServer(d.pipePath, (m) => {
      if (m !== "confirm-attach") {
        onReaderMessage(m);
        return;
      }
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

  /** A hash that cannot be saved is only logged: the next session checks (and warns) again. */
  const saveHash = (hash: string) => {
    try {
      recordGameHash(hash, d.hashPath);
    } catch (e) {
      log("game-hash-not-saved", { error: errorText(e) });
    }
  };
  // Held until the scan after startApp, then let go: the file has millions of characters.
  const installed = { code: undefined as string | undefined };
  if (safe) {
    try {
      installed.code = d.gameCode();
      if (installed.code === undefined) log("game-update-skipped");
      else {
        const { markers, hash, changed } = checkGameUpdate(
          installed.code,
          d.hashPath,
        );
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
      // The game code is missing or unreadable (or cannot be checked): fail closed, with nothing to remember.
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
    // ponytail: not `{ ...lastStatus, lastReadingAt }`: exactOptionalPropertyTypes refuses an undefined lastReadingAt.
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
  let reader: { stop(): Promise<void> } | undefined;
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
  // The debugging pipe, kept for "Reconnect" until the game exits. It is never closed: that would close the game.
  let cdp = game.cdp;
  const release = async () => {
    if (!reader) return; // no reader (a game without the pipe), or already released
    const stopping = reader;
    reader = undefined;
    await stopping.stop();
    if (!cdp) return; // the game exited meanwhile: "closed" is already out
    log("released");
    publishStatus({ game: "running", reader: "released" });
  };
  const reconnect = () => {
    if (reader || !cdp) return;
    log("reconnect");
    startReading(cdp); // the same reader as 001: one new pause, property reads only
  };
  // One after the other: a reconnect sent right after a release waits for it, so two sessions never run at once.
  let turn = Promise.resolve();
  onReaderMessage = (m) => {
    turn = turn.then(m === "release" ? release : reconnect);
  };
  if (cdp) startReading(cdp);
  else if (warning)
    publishStatus({ game: "running", reader: "error", message: warning });

  try {
    d.startApp();
  } catch (e) {
    log("app-failed", { error: errorText(e) }); // the game goes on; the app can be opened by hand
  }

  // Research R8: once per opening, right after startApp and synchronous, and a failure only reaches the log. Whatever
  // happens the app hears, so the tables of an earlier session are never kept.
  let tables: GameTables = { maps: null, monsters: null };
  try {
    if (installed.code !== undefined) tables = readGameTables(installed.code);
    if (!tables.maps || !tables.monsters)
      log("game-tables-unreadable", {
        maps: tables.maps !== null,
        monsters: tables.monsters !== null,
      });
  } catch (e) {
    log("game-scan-failed", { error: errorText(e) });
  }
  installed.code = undefined;
  server?.publish({ type: "tables", tables });

  await game.exited;
  confirmed = undefined;
  cdp = undefined;
  void reader?.stop();
  publishStatus({ game: "closed", reader: "error" });
  await server?.close();
  log("keeper-exit");
}

/** While the game runs, an error nobody caught is logged: ending the keeper would close the game's pipe and the game. */
export function keepAlive(log: KeeperLog, id: () => number | null): void {
  process.on("uncaughtException", (e) => {
    log("uncaught-exception", { id: id(), error: errorText(e) });
  });
  process.on("unhandledRejection", (e) => {
    log("unhandled-rejection", { id: id(), error: errorText(e) });
  });
}
