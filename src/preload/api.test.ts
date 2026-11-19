// The window's API over a fake ipcRenderer: each method on its channel, and which main → window channels repeat their
// last value to a late subscriber (contracts/ipc.md of 004 and 008). Every value here is invented.
import { expect, test, vi } from "vitest";
import { IPC } from "../shared/index.ts";
import { companionApi } from "./api.ts";

function fakeIpc() {
  const listeners = new Map<string, (e: unknown, value: unknown) => void>();
  return {
    on: (name: string, l: (e: unknown, value: unknown) => void) => {
      listeners.set(name, l);
    },
    invoke: vi.fn<(name: string, ...args: unknown[]) => Promise<unknown>>(() =>
      Promise.resolve(undefined),
    ),
    emit: (name: string, value: unknown) => {
      listeners.get(name)?.({}, value);
    },
  };
}

test.each<[string, string, boolean]>([
  ["onFormula", IPC.formulaUpdate, true],
  ["onLiveValues", IPC.formulaLiveValues, true],
  ["onPanel", IPC.panelUpdate, true],
  ["onFarm", IPC.farmUpdate, true],
  ["onRadar", IPC.radarUpdate, true],
  ["onCharacters", IPC.formulaCharacters, true],
  ["onStats", IPC.statsUpdate, true],
  ["onSetupProgress", IPC.steamProgress, false],
])("%s listens on %s, replaying: %s", (method, name, replay) => {
  const ipc = fakeIpc();
  const api = companionApi(ipc) as unknown as Record<
    string,
    (cb: (v: unknown) => void) => () => void
  >;
  ipc.emit(name, "before");
  const got: unknown[] = [];
  api[method]?.((v) => got.push(v));
  ipc.emit(name, "after");
  expect(got).toEqual(replay ? ["before", "after"] : ["after"]);
});

test("formula:update gives the last tree to a window that subscribes late", () => {
  const ipc = fakeIpc();
  const api = companionApi(ipc);
  ipc.emit(IPC.formulaUpdate, { state: "calculating" });
  ipc.emit(IPC.formulaUpdate, { state: "none" });
  const got: unknown[] = [];
  api.onFormula((t) => got.push(t));
  expect(got).toEqual([{ state: "none" }]);
});

test.each<
  [string, (api: ReturnType<typeof companionApi>) => unknown, string, unknown[]]
>([
  [
    "requestFormula",
    (a) => a.requestFormula({ id: "hp" }),
    IPC.formulaRequest,
    [{ id: "hp" }],
  ],
  ["closeFormula", (a) => a.closeFormula(), IPC.formulaClose, []],
  [
    "formulaValues",
    (a) => a.formulaValues({ ids: ["hp"] }),
    IPC.formulaValues,
    [{ ids: ["hp"] }],
  ],
  [
    "listMarks",
    (a) => a.listMarks({ character: 1 }),
    IPC.marksList,
    [{ character: 1 }],
  ],
  [
    "saveMark",
    (a) => a.saveMark({ character: 1, name: "Before" }),
    IPC.marksSave,
    [{ character: 1, name: "Before" }],
  ],
  [
    "clearMark",
    (a) => a.clearMark({ character: 1, name: "Before" }),
    IPC.marksClear,
    [{ character: 1, name: "Before" }],
  ],
  ["getPins", (a) => a.getPins(), IPC.pinsGet, []],
  [
    "setPins",
    (a) => a.setPins([{ treeId: "hp", nodeId: null }]),
    IPC.pinsSet,
    [[{ treeId: "hp", nodeId: null }]],
  ],
  [
    "feedsList",
    (a) => a.feedsList({ pieceKey: '[0,"Sword"]' }),
    IPC.feedsList,
    [{ pieceKey: '[0,"Sword"]' }],
  ],
  ["dismissRadar", (a) => a.dismissRadar(), IPC.radarDismiss, []],
  ["getView", (a) => a.getView(), IPC.viewGet, []],
  [
    "setView",
    (a) => a.setView({ changes: true, share: false }),
    IPC.viewSet,
    [{ changes: true, share: false }],
  ],
  [
    "setSidePanel",
    (a) => a.setSidePanel({ open: true }),
    IPC.sidePanel,
    [{ open: true }],
  ],
])("%s invokes its channel", async (_name, call, name, args) => {
  const ipc = fakeIpc();
  await call(companionApi(ipc));
  expect(ipc.invoke).toHaveBeenCalledExactlyOnceWith(name, ...args);
});
