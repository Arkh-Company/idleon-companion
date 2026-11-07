// Preload: the only bridge between the window and the main process, through the fixed IPC channels only.
import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../shared/index.ts";
import type {
  CompanionApi,
  Settings,
  SetupProgress,
  SteamState,
} from "../shared/index.ts";
import { channel } from "./channel.ts";

/** A main → window channel; `replay` repeats the last value to a late subscriber (contracts/ipc.md). */
const listen = (name: string, replay: boolean) =>
  channel(
    (n, l) => {
      ipcRenderer.on(n, l);
    },
    name,
    replay,
  );

const api: CompanionApi = {
  onContext: listen(IPC.contextUpdate, true),
  onStatus: listen(IPC.statusUpdate, true),
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
  // The channels of 002 (contracts/ipc.md). ponytail: the main process answers steam:state and steam:setup now, the
  // others as their story lands (tasks.md Phases 5–7); until then nothing in the window calls them.
  steamState: async () =>
    (await ipcRenderer.invoke(IPC.steamState)) as SteamState,
  setupSteam: async () =>
    (await ipcRenderer.invoke(IPC.steamSetup)) as SetupProgress,
  removeFromSteam: async () =>
    (await ipcRenderer.invoke(IPC.steamRemove)) as SetupProgress,
  // Each step of setting up goes only to whoever listens at that moment: a late screen must not see an old "done".
  onSetupProgress: listen(IPC.steamProgress, false),
  releaseGame: async () => {
    await ipcRenderer.invoke(IPC.readerRelease);
  },
  reconnect: async () => {
    await ipcRenderer.invoke(IPC.readerReconnect);
  },
  onUpdate: listen(IPC.updateState, true),
  installUpdate: async () => {
    await ipcRenderer.invoke(IPC.updateInstall);
  },
};

contextBridge.exposeInMainWorld("companion", api);
