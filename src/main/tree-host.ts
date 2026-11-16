// The app owns the tree worker (research R1, contracts/tree-worker.md): a second calculator.js in tree mode, with its own
// limits. It lives until the game closes or new game files arrive; a character change only drops the request. Any
// failure of it is that one request "unavailable", and the Stats worker is never touched (FR-017).
import type { WorkerOptions } from "node:worker_threads";
import { isObject } from "../shared/index.ts";
import type { TreeRequest } from "../shared/index.ts";
import { hasVars } from "./calculator-host.ts";
import type { WorkerLike } from "./calculator-host.ts";
import type { GameBytes } from "./game-files.ts";

// ponytail: first guesses (the prototype took 12.3 s cold on the bench); T026 sets them from the compiled calculator.js.
export const TREE_INIT_MS = 120_000;
export const TREE_REQUEST_MS = 30_000;
const WORKER_OPTIONS = {
  env: {},
  stdin: false,
  resourceLimits: { maxOldGenerationSizeMb: 2048 },
} satisfies WorkerOptions;

type Job =
  | {
      kind: "tree";
      id: number;
      request: TreeRequest;
      mosaic: string | null;
      retried: boolean;
    }
  | { kind: "values"; id: number; ids: string[]; mosaic: string }
  | { kind: "shape"; id: number; treeId: string; mosaic: string };

const ANSWER = {
  tree: "treeResult",
  values: "valuesResult",
  shape: "shapeResult",
} as const;

const messageOf = (job: Job): unknown =>
  job.kind === "values"
    ? { type: "values", id: job.id, ids: job.ids, mosaic: job.mosaic }
    : job.kind === "shape"
      ? { type: "shape", id: job.id, treeId: job.treeId, mosaic: job.mosaic }
      : {
          type: "tree",
          id: job.id,
          request: job.request,
          ...(job.mosaic === null ? {} : { mosaic: job.mosaic }),
        };

export function createTreeHost(deps: {
  createWorker: (options: WorkerOptions) => WorkerLike;
  readFiles: (resources: string) => Promise<GameBytes>;
  onTree: (id: number, tree: unknown) => void;
  /** The worker's values, or null when they failed: values never reach `onUnavailable`, which is for trees. */
  onValues: (id: number, values: unknown) => void;
  onUnavailable: (id: number) => void;
  /** The parts of a number's whole tree as the worker sent them, or null when they failed or were lost (FR-027). */
  onShape: (id: number, shape: unknown) => void;
}): {
  setFiles(resources: string): void;
  /** A `number` request needs its mosaic; an `expand` goes with null. */
  request(id: number, request: TreeRequest, mosaicJson: string | null): void;
  /** The ids are the caller's own count, apart from the trees'. */
  values(id: number, ids: string[], mosaicJson: string): void;
  /**
   * In the background: after every tree and value, and kept by `dropCurrent`. A new one replaces the waiting one;
   * `stop` and `setFiles` drop the waiting one with no answer, and answer null to the one in flight.
   */
  shape(id: number, treeId: string, mosaicJson: string): void;
  /** A character change or a loose reader: the request and its answer no longer matter; the worker stays. */
  dropCurrent(): void;
  /** The game closed: the worker ends. */
  stop(): void;
  /** The last tree request again. */
  replay(): void;
} {
  let resources: string | null = null;
  let worker: WorkerLike | null = null;
  let ready = false;
  /** The job the worker has; `dropped` when its answer no longer matters, `priming` when it rebuilds the stored tree. */
  let inFlight: { job: Job; dropped: boolean; priming?: true } | null = null;
  let waitingTree: Job | null = null;
  let waitingValues: Job | null = null;
  let waitingShape: Job | null = null;
  let last: Job | null = null;
  /**
   * The last number sent: the worker keeps its build for the expands, so a new worker gets it again before an expand
   * (a failure or the game closing ended the old one). It outlives `stop`; a new tree or new files drop it.
   */
  let built: Job | null = null;
  /** Whether the current worker has had a number. */
  let primed = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;

  function end(): void {
    clearTimeout(deadline);
    ready = false;
    primed = false;
    const old = worker;
    worker = null; // First, so the `exit` of a terminated worker is not taken for a failure.
    old?.terminate();
  }

  /** The worker failed: the tree it had, in flight or waiting for the start, is unavailable, and a death tries it once more. */
  function fail(retry: boolean): void {
    const current = inFlight;
    inFlight = null;
    end();
    let lost: Job | null = waitingTree;
    // A failed priming loses the expand that waited for it.
    if (current && !current.priming)
      lost = current.dropped ? null : current.job;
    else waitingTree = null;
    waitingValues = null; // Values come again with the next mosaic.
    // A shape is never tried again, nor the waiting one: a game whose files fail would start workers with no end.
    const shape = waitingShape;
    waitingShape = null;
    if (lost?.kind === "shape") deps.onShape(lost.id, null);
    if (shape) deps.onShape(shape.id, null);
    if (lost?.kind === "values") deps.onValues(lost.id, null);
    else if (lost?.kind === "tree") {
      deps.onUnavailable(lost.id);
      if (retry && !lost.retried && waitingTree === null)
        waitingTree = { ...lost, retried: true };
    }
    next();
  }

  function limit(ms: number): void {
    clearTimeout(deadline);
    deadline = setTimeout(() => {
      fail(false);
    }, ms);
  }

  function receive(m: unknown): void {
    if (!isObject(m)) return;
    if (m.type === "ready") {
      clearTimeout(deadline);
      ready = true;
      next();
      return;
    }
    if (m.type === "failed") {
      fail(false);
      return;
    }
    const current = inFlight;
    if (!current || m.id !== current.job.id) return;
    const { job, dropped } = current;
    if (m.type !== ANSWER[job.kind]) return;
    clearTimeout(deadline);
    inFlight = null;
    if (!dropped) {
      if (job.kind === "values") deps.onValues(job.id, m.values);
      else if (job.kind === "shape") deps.onShape(job.id, m.shape ?? null);
      else if ("tree" in m) deps.onTree(job.id, m.tree);
      else deps.onUnavailable(job.id);
    }
    next();
  }

  async function init(w: WorkerLike, folder: string): Promise<void> {
    try {
      // Read again: the Stats worker's bytes were transferred to it.
      const { code, pak } = await deps.readFiles(folder);
      if (w === worker)
        w.postMessage({ type: "init", mode: "tree", code, pak }, [
          code.buffer,
          pak.buffer,
        ]);
    } catch {
      if (w === worker) fail(false);
    }
  }

  function start(folder: string): void {
    let w: WorkerLike;
    try {
      w = deps.createWorker(WORKER_OPTIONS);
    } catch {
      fail(false);
      return;
    }
    worker = w;
    limit(TREE_INIT_MS);
    const lost = (): void => {
      if (w === worker) fail(true);
    };
    w.on("message", (m) => {
      if (w === worker) receive(m);
    });
    w.on("error", lost);
    w.on("exit", lost);
    void init(w, folder);
  }

  function next(): void {
    const job = waitingTree ?? waitingValues ?? waitingShape;
    if (resources === null || !job) return;
    if (!worker) {
      start(resources);
      return;
    }
    if (!ready || inFlight) return;
    const priming =
      job.kind === "tree" &&
      job.request.type === "expand" &&
      !primed &&
      built !== null;
    if (priming) inFlight = { job: built ?? job, dropped: true, priming: true };
    else {
      if (job === waitingTree) waitingTree = null;
      else if (job === waitingValues) waitingValues = null;
      else waitingShape = null;
      inFlight = { job, dropped: false };
      if (job.kind === "tree") last = job;
    }
    const sent = inFlight.job;
    if (sent.kind === "tree" && sent.request.type === "number") {
      built = sent;
      primed = true;
    }
    limit(TREE_REQUEST_MS);
    try {
      worker.postMessage(messageOf(sent));
    } catch {
      fail(false);
    }
  }

  function drop(): void {
    waitingTree = null;
    waitingValues = null;
    last = null;
  }

  /** The worker ends on purpose: a shape or values in flight are lost, so they answer null as a failure does. */
  function cut(): void {
    const current = inFlight;
    inFlight = null;
    end();
    if (!current || current.dropped) return;
    if (current.job.kind === "shape") deps.onShape(current.job.id, null);
    else if (current.job.kind === "values") deps.onValues(current.job.id, null);
  }

  return {
    setFiles(folder) {
      drop();
      waitingShape = null;
      built = null;
      resources = folder;
      cut();
    },
    request(id, request, mosaicJson) {
      if (
        request.type === "number" &&
        (mosaicJson === null || !hasVars(mosaicJson))
      ) {
        deps.onUnavailable(id);
        return;
      }
      waitingTree = {
        kind: "tree",
        id,
        request,
        mosaic: mosaicJson,
        retried: false,
      };
      next();
    },
    values(id, ids, mosaicJson) {
      if (!hasVars(mosaicJson)) {
        deps.onValues(id, null);
        return;
      }
      waitingValues = { kind: "values", id, ids, mosaic: mosaicJson };
      next();
    },
    shape(id, treeId, mosaicJson) {
      if (!hasVars(mosaicJson)) {
        deps.onShape(id, null);
        return;
      }
      waitingShape = { kind: "shape", id, treeId, mosaic: mosaicJson };
      next();
    },
    dropCurrent() {
      drop();
      built = null;
      // A shape is no character's tree: its answer still counts.
      if (inFlight && inFlight.job.kind !== "shape") inFlight.dropped = true;
    },
    stop() {
      drop();
      waitingShape = null;
      cut();
    },
    replay() {
      if (!last) return;
      waitingTree = last;
      next();
    },
  };
}
