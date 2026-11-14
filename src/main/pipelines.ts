// The Stats and the formula trees, joined as the app runs them: each Stats send tells the trees (FR-019, FR-021), and
// nothing of the trees can fail the Stats (FR-017). The window's formula channels are checked here before use. No
// electron import, so tests can load it.
import type { WorkerOptions } from "node:worker_threads";
import { IPC } from "../shared/index.ts";
import type { WorkerLike } from "./calculator-host.ts";
import { startFormulaPipeline } from "./formula-pipeline.ts";
import type { FormulaLog } from "./formula-pipeline.ts";
import type { GameBytes } from "./game-files.ts";
import { emptyPayload, formulaRequestPayload } from "./payloads.ts";
import { startStatsPipeline } from "./stats-pipeline.ts";
import { createTreeHost } from "./tree-host.ts";

export function startPipelines(deps: {
  send: (channel: string, value: unknown) => void;
  createWorker: (options: WorkerOptions) => WorkerLike;
  readFiles: (resources: string) => Promise<GameBytes>;
  log: (entry: FormulaLog) => void;
}): {
  stats: ReturnType<typeof startStatsPipeline>;
  formula: ReturnType<typeof startFormulaPipeline>;
  /** The window → main formula channels, by name, for `ipcMain.handle`. */
  handlers: Record<string, (payload: unknown) => unknown>;
} {
  let formula: ReturnType<typeof startFormulaPipeline> | null = null;
  const stats = startStatsPipeline({
    send: (s) => {
      deps.send(IPC.statsUpdate, s);
      try {
        formula?.statsChanged();
      } catch {
        // The window cannot get the tree: the Stats goes on (FR-017).
      }
    },
    createWorker: deps.createWorker,
    readFiles: deps.readFiles,
  });
  formula = startFormulaPipeline({
    send: (t) => {
      deps.send(IPC.formulaUpdate, t);
    },
    treeHost: (on) =>
      createTreeHost({
        createWorker: deps.createWorker,
        readFiles: deps.readFiles,
        ...on,
      }),
    statsPair: () => stats.pair(),
    log: deps.log,
  });
  const trees = formula;

  return {
    stats,
    formula: trees,
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
    },
  };
}
