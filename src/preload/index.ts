// Preload: the only bridge between the window and the main process, through the fixed IPC channels only.
import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../shared/index.ts";
import type {
  CompanionApi,
  Settings,
  SetupProgress,
  SteamState,
} from "../shared/index.ts";

/** Listens on one channel from the start and keeps the last value: a subscriber that comes after the main process
 * sent (React effects run after the page loads) still gets it at once. The returned function unsubscribes. */
function channel(name: string): (cb: (value: never) => void) => () => void {
  let last: { value: unknown } | undefined;
  const subscribers = new Set<(value: unknown) => void>();
  ipcRenderer.on(name, (_e, value: unknown) => {
    last = { value };
    for (const cb of subscribers) cb(value);
  });
  return (cb) => {
    // The main process sends this channel's type only (IPC.contextUpdate: GameContext, IPC.statusUpdate: Status).
    const f = cb as (value: unknown) => void;
    subscribers.add(f);
    if (last) f(last.value);
    return () => {
      subscribers.delete(f);
    };
  };
}

const api: CompanionApi = {
  onContext: channel(IPC.contextUpdate),
  onStatus: channel(IPC.statusUpdate),
  name: async (table, key, name) => {
    await ipcRenderer.invoke(IPC.catalogName, { table, key, name });
  },
  getSettings: async () =>
    (await ipcRenderer.invoke(IPC.settingsGet)) as Settings,
  setSettings: async (s) => {
    await ipcRenderer.invoke(IPC.settingsSet, s);
  },
  confirmAttach: async () => {
    await ipcRenderer.invoke(IPC.confirmAttach);
  },
  // The channels of 002 (contracts/ipc.md). ponytail: the main process answers them as each story lands (tasks.md
  // Phases 4–7); until then nothing in the window calls them.
  steamState: async () =>
    (await ipcRenderer.invoke(IPC.steamState)) as SteamState,
  setupSteam: async () =>
    (await ipcRenderer.invoke(IPC.steamSetup)) as SetupProgress,
  removeFromSteam: async () =>
    (await ipcRenderer.invoke(IPC.steamRemove)) as SetupProgress,
  onSetupProgress: channel(IPC.steamProgress),
  releaseGame: async () => {
    await ipcRenderer.invoke(IPC.readerRelease);
  },
  reconnect: async () => {
    await ipcRenderer.invoke(IPC.readerReconnect);
  },
  onUpdate: channel(IPC.updateState),
  installUpdate: async () => {
    await ipcRenderer.invoke(IPC.updateInstall);
  },
};

contextBridge.exposeInMainWorld("companion", api);
