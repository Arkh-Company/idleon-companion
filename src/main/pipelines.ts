// The Stats and the formula trees, joined as the app runs them: each Stats send tells the trees (FR-019, FR-021), and
// nothing of the trees can fail the Stats (FR-017). The window's formula channels are checked here before use. No
// electron import, so tests can load it.
import type { WorkerOptions } from "node:worker_threads";
import { IPC } from "../shared/index.ts";
import type { WorkerLike } from "./calculator-host.ts";
import { characterSender } from "./characters.ts";
import { startFormulaPipeline } from "./formula-pipeline.ts";
import type { FormulaLog } from "./formula-pipeline.ts";
import type { GameBytes } from "./game-files.ts";
import {
  emptyPayload,
  feedsListPayload,
  formulaRequestPayload,
  formulaValuesPayload,
} from "./payloads.ts";
import { patchRadar } from "./radar.ts";
import { startStatsPipeline } from "./stats-pipeline.ts";
import { marksHandlers, pinsHandlers } from "./saved-files.ts";
import type { savedFiles } from "./saved-files.ts";
import type { Pin } from "../shared/index.ts";
import { createTreeHost } from "./tree-host.ts";
import { versionBand } from "./version-band.ts";

export function startPipelines(deps: {
  send: (channel: string, value: unknown) => void;
  createWorker: (options: WorkerOptions) => WorkerLike;
  readFiles: (resources: string) => Promise<GameBytes>;
  log: (entry: FormulaLog) => void;
  /** The marks and pins saved on this computer. */
  saved: ReturnType<typeof savedFiles>;
}): {
  stats: ReturnType<typeof startStatsPipeline>;
  formula: ReturnType<typeof startFormulaPipeline>;
  /** The window → main formula, marks, pins and radar channels, by name, for `ipcMain.handle`. */
  handlers: Record<string, (payload: unknown) => unknown>;
} {
  let formula: ReturnType<typeof startFormulaPipeline> | null = null;
  const characters = characterSender((c) => {
    deps.send(IPC.formulaCharacters, c);
  });
  const tellTrees = (): void => {
    try {
      characters.tell(stats.pair()?.mosaicJson ?? null);
      formula?.statsChanged();
    } catch {
      // The window cannot get the tree: the Stats goes on (FR-017).
    }
  };
  const stats = startStatsPipeline({
    send: (s) => {
      deps.send(IPC.statsUpdate, s);
      tellTrees();
    },
    createWorker: deps.createWorker,
    readFiles: deps.readFiles,
    // A new mosaic whose 11 texts did not change sends nothing to the tab, and the live values still follow it.
    onPair: tellTrees,
  });
  const band = versionBand();
  const radar = patchRadar({
    send: (r) => {
      deps.send(IPC.radarUpdate, r);
    },
    shapes: deps.saved.shapes,
  });
  formula = startFormulaPipeline({
    send: (t) => {
      deps.send(IPC.formulaUpdate, t);
    },
    sendValues: (v) => {
      deps.send(IPC.formulaLiveValues, v);
    },
    treeHost: (on) =>
      createTreeHost({
        createWorker: deps.createWorker,
        // The code is hashed before the host transfers its bytes to the worker.
        readFiles: async (resources) => {
          const files = await deps.readFiles(resources);
          const sha = band.read(files.code);
          formula?.gameRead(sha);
          return files;
        },
        ...on,
      }),
    statsPair: () => stats.pair(),
    checkedOnThisGame: band.checked,
    log: deps.log,
    shapes: deps.saved.shapes,
    radar,
  });
  const trees = formula;
  // The pinned numbers are live whatever the window shows, from the start (FR-026).
  const pinned = (pins: Pin[]): void => {
    trees.pinned(pins.map((p) => p.treeId));
  };
  pinned(deps.saved.pins.get());

  return {
    stats,
    // A new page gets the picker's list again with the tree (FR-020).
    formula: {
      ...trees,
      replay() {
        trees.replay();
        characters.replay();
      },
    },
    handlers: {
      [IPC.formulaRequest]: (payload) => {
        const r = formulaRequestPayload(payload);
        if (!r) throw new Error("formula:request: invalid request");
        trees.request(r);
      },
      [IPC.formulaClose]: (payload) => {
        if (!emptyPayload(payload))
          throw new Error("formula:close: no body expected");
        trees.close();
      },
      [IPC.formulaValues]: (payload) => {
        const r = formulaValuesPayload(payload);
        if (!r) throw new Error("formula:values: invalid ids");
        trees.values(r.ids);
      },
      [IPC.feedsList]: (payload) => {
        const r = feedsListPayload(payload);
        if (!r) throw new Error("feeds:list: invalid piece");
        return trees.feeds(r.pieceKey);
      },
      [IPC.radarDismiss]: (payload) => {
        if (!emptyPayload(payload))
          throw new Error("radar:dismiss: no body expected");
        radar.dismiss();
      },
      ...marksHandlers(deps.saved.marks, (n) => trees.markOf(n)),
      ...pinsHandlers(deps.saved.pins, pinned),
    },
  };
}
