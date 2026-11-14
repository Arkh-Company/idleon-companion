// What the preload exposes as `window.companion`, over the fixed IPC channels only. No electron import (index.ts passes
// `ipcRenderer`), so tests load it.
import { IPC } from "../shared/index.ts";
import type {
  CompanionApi,
  Mark,
  Pin,
  Settings,
  SetupProgress,
  SteamState,
} from "../shared/index.ts";
import { channel } from "./channel.ts";

interface Ipc {
  on(name: string, listener: (e: unknown, value: unknown) => void): unknown;
  invoke(name: string, ...args: unknown[]): Promise<unknown>;
}

export function companionApi(ipc: Ipc): CompanionApi {
  /** A main → window channel; `replay` repeats the last value to a late subscriber (contracts/ipc.md). */
  const listen = (name: string, replay: boolean) =>
    channel(
      (n, l) => {
        ipc.on(n, l);
      },
      name,
      replay,
    );
  /** A window → main call whose answer the window does not use. */
  const call =
    (name: string) =>
    async (...args: unknown[]): Promise<void> => {
      await ipc.invoke(name, ...args);
    };

  return {
    onContext: listen(IPC.contextUpdate, true),
    onStatus: listen(IPC.statusUpdate, true),
    getSettings: async () => (await ipc.invoke(IPC.settingsGet)) as Settings,
    setSettings: call(IPC.settingsSet),
    confirmAttach: call(IPC.confirmAttach),
    // The channels of 002 (contracts/ipc.md).
    steamState: async () => (await ipc.invoke(IPC.steamState)) as SteamState,
    setupSteam: async () => (await ipc.invoke(IPC.steamSetup)) as SetupProgress,
    // Each step of setting up goes only to whoever listens at that moment: a late screen must not see an old "done".
    onSetupProgress: listen(IPC.steamProgress, false),
    releaseGame: call(IPC.readerRelease),
    reconnect: call(IPC.readerReconnect),
    onUpdate: listen(IPC.updateState, true),
    installUpdate: call(IPC.updateInstall),
    onStats: listen(IPC.statsUpdate, true),
    // The channels of 008 (contracts/ipc.md).
    requestFormula: call(IPC.formulaRequest),
    onFormula: listen(IPC.formulaUpdate, true),
    closeFormula: call(IPC.formulaClose),
    formulaValues: call(IPC.formulaValues),
    onLiveValues: listen(IPC.formulaLiveValues, true),
    onPanel: listen(IPC.panelUpdate, true),
    listMarks: async (r) =>
      (await ipc.invoke(IPC.marksList, r)) as {
        marks: Mark[];
        warning: string | null;
      },
    saveMark: async (r) =>
      (await ipc.invoke(IPC.marksSave, r)) as string | null,
    clearMark: async (r) =>
      (await ipc.invoke(IPC.marksClear, r)) as string | null,
    getPins: async () => (await ipc.invoke(IPC.pinsGet)) as Pin[],
    setPins: call(IPC.pinsSet),
    onFarm: listen(IPC.farmUpdate, true),
    onRadar: listen(IPC.radarUpdate, true),
    dismissRadar: call(IPC.radarDismiss),
    setSidePanel: call(IPC.sidePanel),
  };
}
