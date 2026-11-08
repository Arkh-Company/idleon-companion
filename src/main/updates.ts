// Automatic updates (spec US4; research R3; ADR 0005): the only code of the companion that reaches the network, in the
// app only, from the releases repository named in electron-builder.yml. electron-updater checks the published sha512.
// Nothing installs with the game open: the keeper is this same program.
import type { AppUpdater } from "electron-updater";
import type { Status, UpdateState } from "../shared/index.ts";
import { GAME_IMAGE } from "./steam/index.ts";
import type { SteamSystem } from "./steam/index.ts";

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
// Only while an update waits: the game can close with no status left to say so (the keeper ends with it).
const LOOK_FOR_GAME_EVERY_MS = 5000;

export type UpdateEvent =
  "checking" | "available" | "progress" | "downloaded" | "error";

/** The part of electron-updater's `autoUpdater` used here. */
export type Updater = Pick<
  AppUpdater,
  | "autoDownload"
  | "allowDowngrade"
  | "autoInstallOnAppQuit"
  | "on"
  | "checkForUpdates"
  | "quitAndInstall"
>;

/** Never with the game open: by the link, or by its process when the game runs without the keeper. */
export function canInstall(p: {
  status: Status | null;
  gameRunning: boolean;
}): boolean {
  return p.status?.game !== "running" && !p.gameRunning;
}

export function updateStateFrom(
  event: UpdateEvent,
  version = "",
  installable = false,
): UpdateState {
  switch (event) {
    case "checking":
      return { state: "none" };
    case "available":
    case "progress":
      return { state: "downloading", version };
    case "downloaded":
      return { state: "ready", version, canInstall: installable };
    case "error":
      return { state: "check-failed" };
  }
}

/** The check every 6 h or a failed one must not take a finished or running download away from the window. */
export function nextUpdateState(
  current: UpdateState,
  event: UpdateEvent,
  version?: string,
  installable?: boolean,
): UpdateState {
  const known = "version" in current ? current.version : undefined;
  if (event === "checking" && known !== undefined) return current;
  if (current.state === "ready") {
    if (event === "error") return current;
    if (event !== "downloaded" && (version ?? known) === known) return current;
  }
  return updateStateFrom(event, version ?? known, installable);
}

/** In development the updater stays off (research R9). */
export function shouldCheck(p: { isPackaged: boolean }): boolean {
  return p.isPackaged;
}

/** Asks whether an update may install now; a `tasklist` that fails counts as the game being open. */
export function installCheck(
  status: () => Status | null,
  sys: Pick<SteamSystem, "isRunning">,
): () => Promise<boolean> {
  return async () => {
    const gameRunning =
      status()?.game === "running" ||
      (await sys.isRunning(GAME_IMAGE).catch(() => true));
    return canInstall({ status: status(), gameRunning });
  };
}

// electron-updater is CommonJS and `autoUpdater` is a getter that ESM's named imports do not see. Loaded on use, so
// tests and development never load it.
const loadUpdater = async (): Promise<Updater> =>
  (await import("electron-updater")).default.autoUpdater;

/**
 * Starts the updater. `canInstallNow` is async because it runs `tasklist`: a remembered answer could be stale exactly
 * when the button is pressed.
 */
export function startUpdates(
  send: (u: UpdateState) => void,
  canInstallNow: () => Promise<boolean>,
  options: { isPackaged: boolean; load?: () => Promise<Updater> },
): { install(): Promise<void>; onStatus(): void; replay(): void } {
  let state: UpdateState = { state: "none" };
  let updater: Updater | undefined;
  let newestLook = 0;

  const publish = (next: UpdateState) => {
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    send(state);
  };
  const apply = (event: UpdateEvent, version?: string) => {
    publish(nextUpdateState(state, event, version));
  };

  /** Decides again, for the button and for quitting; of two looks at once, only the newest counts. */
  const look = async (): Promise<boolean> => {
    const mine = ++newestLook;
    const can = await canInstallNow();
    if (mine === newestLook && updater && state.state === "ready") {
      updater.autoInstallOnAppQuit = can;
      publish({ ...state, canInstall: can });
    }
    return can;
  };
  const lookIfReady = () => {
    if (state.state === "ready") void look();
  };

  const begin = (u: Updater) => {
    updater = u;
    u.autoDownload = true;
    u.allowDowngrade = false;
    // electron-updater adds its quit handler right after the "update-downloaded" event, only if this is on, and reads
    // it again at quit. So it stays on until an update is ready (nothing can install before), and look() settles it
    // after the handler is in, a tick later; the installer itself also refuses with the game open (build/installer.nsh).
    u.autoInstallOnAppQuit = true;
    u.on("checking-for-update", () => {
      apply("checking");
    });
    u.on("update-available", (info) => {
      apply("available", info.version);
    });
    u.on("download-progress", () => {
      apply("progress");
    });
    u.on("update-downloaded", (info) => {
      apply("downloaded", info.version);
      void look();
    });
    u.on("error", () => {
      apply("error");
    });
    const check = () => {
      // The failure is only a line in Settings (FR-025), and a rejected promise here would be an unhandled one.
      u.checkForUpdates().catch(() => {
        apply("error");
      });
    };
    check();
    setInterval(check, CHECK_EVERY_MS);
    setInterval(lookIfReady, LOOK_FOR_GAME_EVERY_MS);
  };

  if (shouldCheck(options))
    (options.load ?? loadUpdater)()
      .then(begin)
      .catch(() => {
        apply("error");
      });

  return {
    install: async () => {
      // A fresh look: the game may have opened since the last one (FR-023).
      if (state.state !== "ready" || !(await look())) return;
      updater?.quitAndInstall(true, true);
    },
    onStatus: lookIfReady,
    replay: () => {
      send(state);
    },
  };
}
