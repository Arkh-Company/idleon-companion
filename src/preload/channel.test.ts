// The preload's channel listeners over a fake `ipcRenderer.on`: which channels repeat their last value to a late
// subscriber (contracts/ipc.md).
import { expect, test } from "vitest";
import { channel } from "./channel.ts";

function fakeIpc() {
  const listeners = new Map<string, (e: unknown, value: unknown) => void>();
  return {
    on: (name: string, l: (e: unknown, value: unknown) => void) => {
      listeners.set(name, l);
    },
    emit: (name: string, value: unknown) => {
      listeners.get(name)?.({}, value);
    },
  };
}

test("a replaying channel gives its last value to a late subscriber, then every new one", () => {
  const ipc = fakeIpc();
  const sub = channel(ipc.on, "update:state", true);
  ipc.emit("update:state", 1);
  ipc.emit("update:state", 2);
  const got: unknown[] = [];
  sub((v) => got.push(v));
  ipc.emit("update:state", 3);
  expect(got).toEqual([2, 3]);
});

test("a channel without replay gives a late subscriber only what comes after it", () => {
  const ipc = fakeIpc();
  const sub = channel(ipc.on, "steam:progress", false);
  ipc.emit("steam:progress", "done");
  const got: unknown[] = [];
  sub((v) => got.push(v));
  expect(got).toEqual([]);
  ipc.emit("steam:progress", "closing-steam");
  expect(got).toEqual(["closing-steam"]);
});

test("unsubscribing stops the values", () => {
  const ipc = fakeIpc();
  const sub = channel(ipc.on, "status:update", true);
  const got: unknown[] = [];
  const off = sub((v) => got.push(v));
  ipc.emit("status:update", 1);
  off();
  ipc.emit("status:update", 2);
  expect(got).toEqual([1]);
});
