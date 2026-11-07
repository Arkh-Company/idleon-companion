// The keeper's flow (spec §4): holds the link pipe, checks the game code, launches the game with its debugging pipe,
// reads it and publishes to the app, and ends only after the game. index.ts gives it the real game, reader and app.
import type { Reading, Status } from "../shared/index.ts";
import type { Cdp } from "./cdp.ts";
import { AlreadyRunning, startLinkServer } from "./link-server.ts";
import { checkGameUpdate, recordGameHash } from "./update-watch.ts";

export type KeeperLog = (label: string, data?: Record<string, unknown>) => void;

export interface KeeperDeps {
  pipePath: string;
  /** game-hash.json, the update watch's memory between sessions */
  hashPath: string;
  /** The installed game's N.js; throws when it cannot be read (as with Edge). */
  gameCode(): string;
  launch(): { pid: number | undefined; cdp: Cdp; exited: Promise<unknown> };
  read(
    cdp: Cdp,
    onReading: (r: Reading) => void,
    onStatus: (s: Status) => void,
    onAttached: (pausedMs: number) => void,
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
  let server: Awaited<ReturnType<typeof startLinkServer>>;
  try {
    server = await startLinkServer(d.pipePath, () => {
      const start = confirmed;
      confirmed = undefined; // a second click starts nothing
      start?.();
    });
  } catch (e) {
    if (!(e instanceof AlreadyRunning)) throw e;
    log("already-running");
    return;
  }

  let markers: string[] = [];
  let hash = "";
  try {
    const update = checkGameUpdate(d.gameCode(), d.hashPath);
    ({ markers, hash } = update);
    log("game-update", update);
  } catch (e) {
    log("game-update-skipped", { error: errorText(e) });
  }

  const game = d.launch();
  pid = game.pid ?? null;
  log("game-started");
  const publishStatus = (status: Status) => {
    log("status", { ...status });
    server.publish({ type: "status", status });
  };
  let reader: { stop(): void } | undefined;
  const startReading = () => {
    reader = d.read(
      game.cdp,
      (reading) => {
        log("reading", { reading });
        server.publish({ type: "reading", reading });
      },
      publishStatus,
      (pausedMs) => {
        log("attached", { pausedMs });
      },
    );
  };
  // Spec §7.2: a changed game code with detection markers is not read until the user says so.
  if (markers.length > 0) {
    // The accepted code is recorded only now: a session closed without "Connect anyway" warns again next time.
    confirmed = () => {
      try {
        recordGameHash(hash, d.hashPath);
      } catch (e) {
        log("game-hash-not-saved", { error: errorText(e) }); // the next session warns again; reading goes on
      }
      startReading();
    };
    publishStatus({
      game: "running",
      reader: "error",
      message: `The game code changed and contains: ${markers.join(", ")}. Connect anyway?`,
    });
  } else startReading();

  try {
    d.startApp();
  } catch (e) {
    log("app-failed", { error: errorText(e) }); // the game goes on; the app can be opened by hand
  }

  await game.exited;
  confirmed = undefined;
  reader?.stop();
  publishStatus({ game: "closed", reader: "error" });
  await server.close();
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
