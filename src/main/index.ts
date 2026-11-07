// App entry (Electron main process): a link client of the keeper (spec §4, §5.4) with one window, a tray, one
// instance, the settings and the fixed IPC channels. The app never launches the game and never touches its pipe.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { IPC, LINK_PIPE } from "../shared/index.ts";
import type { Reading, Status } from "../shared/index.ts";
import {
  DEFAULT_CATALOG,
  loadCatalog,
  nameEntry,
  saveCatalog,
} from "./catalog/catalog.ts";
import { toContext } from "./context.ts";
import { decide } from "./lifecycle.ts";
import type { LifecycleAction, LifecycleEvent } from "./lifecycle.ts";
import { connectLink } from "./link-client.ts";
import {
  linkReading,
  linkStatus,
  namePayload,
  settingsPayload,
} from "./payloads.ts";
import { loadSettings, saveSettings } from "./settings.ts";
import { isAllowedNavigation, windowOptions } from "./window-options.ts";

/** What the window shows while no keeper answers on the link. */
const NOT_CONNECTED: Status = { game: "not-launched", reader: "error" };

function start(): void {
  const dataDir = join(app.getPath("appData"), "IdleOn Companion");
  const settingsFile = join(dataDir, "settings.json");
  const namesFile = join(dataDir, "names.json");
  let settings = loadSettings(settingsFile);
  let catalog = loadCatalog(namesFile, DEFAULT_CATALOG);
  // connectLink calls onConnected(false) only when a live connection drops, so the app starts as "not connected".
  let status = NOT_CONNECTED;
  let lastReading: Reading | null = null;

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  const ownUrl =
    devUrl ??
    pathToFileURL(join(import.meta.dirname, "../renderer/index.html")).href;

  const win = new BrowserWindow({
    ...windowOptions(join(import.meta.dirname, "../preload/index.cjs")),
    show: false, // the start event decides (setting "Show window when the game starts")
    alwaysOnTop: settings.alwaysOnTop,
  });
  const send = (channel: string, value: unknown) => {
    if (!win.isDestroyed()) win.webContents.send(channel, value);
  };
  const sendContext = () => {
    if (lastReading) send(IPC.contextUpdate, toContext(lastReading, catalog));
  };
  const setStatus = (s: Status) => {
    status = s;
    send(IPC.statusUpdate, s);
  };

  // Navigation lockdown (Electron security checklist): no new windows, no page but the own one.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => {
    if (!isAllowedNavigation(e.url, ownUrl)) e.preventDefault();
  });
  // Spec §7.1: a crashed window reloads alone; each load gets the last status and context again.
  win.webContents.on("render-process-gone", () => {
    win.webContents.reload();
  });
  win.webContents.on("did-finish-load", () => {
    send(IPC.statusUpdate, status);
    sendContext();
  });
  // The page loads by the same URL the navigation and IPC checks compare against.
  void win.loadURL(ownUrl);

  const apply = (event: LifecycleEvent) => {
    for (const action of decide(event, settings, win.isVisible())) run(action);
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
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show or hide",
        click: () => {
          apply("tray-click");
        },
      },
      {
        label: "Quit",
        click: () => {
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", () => {
    apply("tray-click");
  });

  const link = connectLink(
    LINK_PIPE,
    (m) => {
      if (m.type === "reading") {
        const r = linkReading(m.reading);
        if (!r) return; // the decoder checks only the message type
        lastReading = r;
        sendContext();
      } else if (m.type === "status") {
        const s = linkStatus(m.status);
        if (!s) return;
        setStatus(s);
        if (s.game === "closed") apply("game-exited");
      }
    },
    (up) => {
      if (!up) setStatus(NOT_CONNECTED);
    },
  );

  /** IPC only from the window's own page; a payload of the wrong shape is refused before use. */
  const handle = (channel: string, f: (payload: unknown) => unknown): void => {
    ipcMain.handle(channel, (e: IpcMainInvokeEvent, payload: unknown) => {
      const from = e.senderFrame?.url ?? "";
      if (!isAllowedNavigation(from, ownUrl))
        throw new Error(`IPC refused from ${from}`);
      return f(payload);
    });
  };
  handle(IPC.settingsGet, () => settings);
  handle(IPC.settingsSet, (payload) => {
    const s = settingsPayload(payload);
    if (!s) throw new Error("settings:set: invalid settings");
    settings = s;
    saveSettings(settingsFile, s);
    win.setAlwaysOnTop(s.alwaysOnTop);
  });
  handle(IPC.catalogName, (payload) => {
    const p = namePayload(payload);
    if (!p) throw new Error("catalog:name: invalid name");
    catalog = nameEntry(catalog, p.table, p.key, p.name);
    saveCatalog(namesFile, catalog);
    sendContext();
  });
  handle(IPC.confirmAttach, () => {
    link.send({ type: "confirm-attach" });
  });

  app.on("second-instance", () => {
    apply("second-instance");
  });
  app.on("before-quit", () => {
    link.close();
    tray.destroy();
  });
  apply(
    process.argv.includes("--from-steam") ? "start-from-steam" : "start-manual",
  );
}

// One app: a second copy hands over to the first (its `second-instance` focuses the window) and quits.
if (app.requestSingleInstanceLock()) {
  void app.whenReady().then(start);
  app.on("window-all-closed", () => {
    app.quit();
  });
} else {
  app.quit();
}
