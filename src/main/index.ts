// App entry (Electron main process): a link client of the keeper (spec §4, §5.4) with one window, a tray, one
// instance, the settings and the fixed IPC channels. The app never launches the game and never touches its pipe.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from "electron";
import { IPC, LINK_PIPE } from "../shared/index.ts";
import type { Status } from "../shared/index.ts";
import { calculatorPath } from "./calculator-host.ts";
import { contextTracker } from "./context.ts";
import { forgetOldNames } from "./forget-names.ts";
import { readGameFiles } from "./game-files.ts";
import {
  decide,
  launchEvent,
  NOT_CONNECTED,
  shouldReload,
  trayUpdater,
} from "./lifecycle.ts";
import type { LifecycleAction, LifecycleEvent, TrayItem } from "./lifecycle.ts";
import { connectLink } from "./link-client.ts";
import { routeLink } from "./link-routes.ts";
import { emptyPayload, settingsPayload } from "./payloads.ts";
import { loadSettings, loadZoom, saveSettings, saveZoom } from "./settings.ts";
import { setupStoreIn } from "./setup-store.ts";
import { startStatsPipeline } from "./stats-pipeline.ts";
import {
  companionPart,
  steamSetupJob,
  steamState,
  steamSystem,
} from "./steam/index.ts";
import { installCheck, startUpdates } from "./updates.ts";
import {
  guardIpc,
  isAllowedNavigation,
  windowOptions,
} from "./window-options.ts";
import { zoomControl } from "./zoom.ts";

function start(): void {
  const dataDir = join(app.getPath("appData"), "IdleOn Companion");
  forgetOldNames(dataDir);
  const settingsFile = join(dataDir, "settings.json");
  let settings = loadSettings(settingsFile);
  // connectLink calls onConnected(false) only when a live connection drops, so the app starts as "not connected".
  let status = NOT_CONNECTED;

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  const ownUrl =
    devUrl ??
    pathToFileURL(join(import.meta.dirname, "../renderer/index.html")).href;

  // No File/Edit/View/Window bar: on Windows, null also removes its shortcuts to the developer tools.
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    ...windowOptions(join(import.meta.dirname, "../preload/index.cjs")),
    show: false, // the start event decides (setting "Show window when the game starts")
    alwaysOnTop: settings.alwaysOnTop,
  });
  const send = (channel: string, value: unknown) => {
    if (!win.isDestroyed()) win.webContents.send(channel, value);
  };
  const tracker = contextTracker((c) => {
    send(IPC.contextUpdate, c);
  });
  const setStatus = (s: Status) => {
    status = s;
    send(IPC.statusUpdate, s);
    updateTray(s);
    return updates.onStatus();
  };

  // Navigation lockdown (Electron security checklist): no new windows, no page but the own one.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => {
    if (!isAllowedNavigation(e.url, ownUrl)) e.preventDefault();
  });
  // Spec §7.1: a crashed window reloads alone (at most 3 times a minute); each load gets the last status and context.
  const reloads: number[] = [];
  win.webContents.on("render-process-gone", (_e, details) => {
    const now = Date.now();
    if (!shouldReload(details.reason, !win.isDestroyed(), reloads, now)) return;
    reloads.push(now);
    win.webContents.reload();
  });
  // Text zoom (FR-031): the menu is gone, so its keys and Ctrl+wheel come here; each load gets the saved factor.
  const zoom = zoomControl(loadZoom(settingsFile), win.webContents, (f) => {
    saveZoom(settingsFile, f);
  });
  win.webContents.on("did-finish-load", zoom.apply);
  win.webContents.on("before-input-event", (e, input) => {
    if (zoom.key(input)) e.preventDefault();
  });
  win.webContents.on("zoom-changed", (_e, direction) => {
    zoom.wheel(direction);
  });
  // The page loads by the same URL the navigation and IPC checks compare against.
  void win.loadURL(ownUrl);

  // Set by before-quit (tray "Quit", the game exiting with closeWithGame) and by the system ending the session.
  let quitting = false;
  const apply = (event: LifecycleEvent) => {
    for (const action of decide(event, settings, win.isVisible(), quitting))
      run(action);
  };
  const run = (action: LifecycleAction) => {
    if (action === "quit") {
      app.quit();
      return;
    }
    if (win.isDestroyed()) return;
    if (action === "show-window") win.show();
    if (action === "hide-window") win.hide();
    if (action === "focus-window") {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  };

  // ponytail: a plain 16×16 square; a drawn icon when the app gets one.
  const icon = nativeImage.createFromBitmap(
    Buffer.alloc(16 * 16 * 4).fill(Buffer.from([0x30, 0xa0, 0x40, 0xff])),
    { width: 16, height: 16 },
  );
  const tray = new Tray(icon);
  tray.setToolTip("IdleOn Companion");
  const trayClicks: Record<TrayItem, () => void> = {
    "Show/Hide": () => {
      apply("tray-click");
    },
    "Let the game close": () => {
      link.send({ type: "release" });
    },
    Reconnect: () => {
      link.send({ type: "reconnect" });
    },
    Quit: () => {
      app.quit();
    },
  };
  const updateTray = trayUpdater((items) => {
    if (tray.isDestroyed()) return;
    tray.setContextMenu(
      Menu.buildFromTemplate(
        items.map((label) => ({ label, click: trayClicks[label] })),
      ),
    );
  });
  updateTray(status);
  tray.on("click", () => {
    apply("tray-click");
  });

  const updates = startUpdates(
    (u) => {
      send(IPC.updateState, u);
    },
    installCheck(() => status, steamSystem),
    { isPackaged: app.isPackaged },
  );

  // The calculator's worker is the app's, never the keeper's: a crash of it cannot reach the game (FR-010, FR-016).
  const stats = startStatsPipeline({
    send: (s) => {
      send(IPC.statsUpdate, s);
    },
    createWorker: (options) =>
      new Worker(
        `${calculatorPath(import.meta.dirname)}/calculator.js`,
        options,
      ),
    readFiles: readGameFiles,
  });

  const routes = routeLink({
    tracker,
    stats,
    updates,
    status: () => status,
    setStatus,
    sendStatus: (s) => {
      send(IPC.statusUpdate, s);
    },
    gameExited: () => {
      apply("game-exited");
    },
    page: win.webContents,
  });
  const link = connectLink(LINK_PIPE, routes.message, routes.connected);

  /** IPC only from the window's own page; a payload of the wrong shape is refused before use. */
  const handle = (channel: string, f: (payload: unknown) => unknown): void => {
    ipcMain.handle(channel, guardIpc(ownUrl, f));
  };
  handle(IPC.settingsGet, (payload) => {
    if (!emptyPayload(payload))
      throw new Error("settings:get: no body expected");
    return settings;
  });
  handle(IPC.settingsSet, (payload) => {
    const s = settingsPayload(payload);
    if (!s) throw new Error("settings:set: invalid settings");
    settings = s;
    saveSettings(settingsFile, s);
    win.setAlwaysOnTop(s.alwaysOnTop);
  });
  handle(IPC.confirmAttach, (payload) => {
    if (!emptyPayload(payload))
      throw new Error("reader:confirm-attach: no body expected");
    link.send({ type: "confirm-attach" });
  });
  handle(IPC.readerRelease, (payload) => {
    if (!emptyPayload(payload))
      throw new Error("reader:release: no body expected");
    link.send({ type: "release" });
  });
  handle(IPC.readerReconnect, (payload) => {
    if (!emptyPayload(payload))
      throw new Error("reader:reconnect: no body expected");
    link.send({ type: "reconnect" });
  });
  handle(IPC.updateInstall, (payload) => {
    if (!emptyPayload(payload))
      throw new Error("update:install: no body expected");
    return updates.install();
  });

  // Steam setup (contracts/ipc.md): the part Steam runs before the game, the records and the copies (FR-027).
  const part = companionPart({
    execPath: process.execPath,
    defaultApp: process.defaultApp, // undefined when packaged, though typed boolean
    appPath: app.getAppPath(),
  });
  const setupStore = setupStoreIn(dataDir);
  const setUpSteam = steamSetupJob(steamSystem, setupStore, part, (p) => {
    send(IPC.steamProgress, p);
  });
  handle(IPC.steamState, (payload) => {
    if (!emptyPayload(payload))
      throw new Error("steam:state: no body expected");
    return steamState(steamSystem, setupStore, part);
  });
  handle(IPC.steamSetup, (payload) => {
    if (!emptyPayload(payload))
      throw new Error("steam:setup: no body expected");
    return setUpSteam();
  });

  app.on("second-instance", (_e, argv) => {
    apply(launchEvent(argv, false));
  });
  // X hides the window in the tray; only quitting lets it close (T065).
  win.on("close", (e) => {
    const actions = decide("window-close", settings, win.isVisible(), quitting);
    if (actions.includes("hide-window")) e.preventDefault();
    for (const action of actions) run(action);
  });
  win.on("session-end", () => {
    quitting = true;
    app.quit();
  });
  app.on("before-quit", () => {
    quitting = true;
    link.close();
    tray.destroy();
  });
  apply(launchEvent(process.argv, true));
}

// One app: a second copy hands its argv to the first (`second-instance`: a manual launch focuses the window, a Steam one
// follows the setting) and quits.
if (app.requestSingleInstanceLock()) {
  void app.whenReady().then(start);
  app.on("window-all-closed", () => {
    app.quit();
  });
} else {
  app.quit();
}
