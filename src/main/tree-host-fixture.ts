// The harness of the tree host's tests: a host over fake workers, and one whose worker is ready with a tree in flight.
// Every value is invented.
import { vi } from "vitest";
import {
  FakeWorker,
  files,
  flush,
  mosaic,
  nth,
  RESOURCES,
} from "./calculator-host-fixture.ts";
import type { GameBytes } from "./game-files.ts";
import { createTreeHost } from "./tree-host.ts";

export { mosaic };

export const DROP = { type: "number", id: "dropRate", character: 0 } as const;
export const HP = { type: "number", id: "hp", character: 0 } as const;
export const NO_VARS = JSON.stringify({
  attrs: { n: 1 },
  vars: {},
  skipped: [],
});

export function setup(read: () => Promise<GameBytes> = files) {
  const workers: FakeWorker[] = [];
  const options: unknown[] = [];
  const readFiles = vi.fn(read);
  const onTree = vi.fn();
  const onValues = vi.fn();
  const onUnavailable = vi.fn();
  const onShape = vi.fn();
  const host = createTreeHost({
    createWorker: (o) => {
      options.push(o);
      const w = new FakeWorker();
      workers.push(w);
      return w;
    },
    readFiles,
    onTree,
    onValues,
    onUnavailable,
    onShape,
  });
  host.setFiles(RESOURCES);
  return {
    host,
    workers,
    options,
    readFiles,
    onTree,
    onValues,
    onUnavailable,
    onShape,
  };
}

/** A host whose worker is ready and has request 1 (the Drop Rate over mosaic 1) in flight. */
export async function running() {
  const t = setup();
  t.host.request(1, DROP, mosaic(1));
  await flush();
  const worker = nth(t.workers);
  worker.emit("message", { type: "ready" });
  return { ...t, worker };
}

export const answer = (
  w: FakeWorker,
  id: number,
  tree: unknown = { id: "root" },
) => {
  w.emit("message", { type: "treeResult", id, tree });
};
