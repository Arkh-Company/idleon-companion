// The app owns the calculator's worker: it feeds it, limits it and turns any failure of it into "unavailable"
// (FR-014, FR-016, contracts/calculator.md).
import type { WorkerOptions } from "node:worker_threads";
import { isObject, NUMBER_IDS } from "../shared/index.ts";
import type { CalcNumbers } from "../shared/index.ts";
import type { GameBytes } from "./game-files.ts";

export interface WorkerLike {
  postMessage(message: unknown, transfer?: readonly ArrayBuffer[]): void;
  on(
    event: "message" | "error" | "exit",
    listener: (value: unknown) => void,
  ): unknown;
  terminate(): unknown;
}

const INIT_MS = 60_000;
const SET_MS = 15_000;
const CALC_GAP_MS = 5_000;
const WORKER_OPTIONS = {
  env: {},
  stdin: false,
  resourceLimits: { maxOldGenerationSizeMb: 1024 },
} satisfies WorkerOptions;

/** The worker's file is unpacked next to the asar: a `Worker` cannot start from inside one. */
export function calculatorPath(dir: string): string {
  return dir.replace(/([\\/])app\.asar(?=[\\/]|$)/, "$1app.asar.unpacked");
}

function numbersOf(v: unknown): CalcNumbers {
  const got = isObject(v) ? v : {};
  return Object.fromEntries(
    NUMBER_IDS.map((id) => {
      const n = got[id];
      return [id, typeof n === "number" && Number.isFinite(n) ? n : null];
    }),
  ) as CalcNumbers;
}

/** Without the `_vars` the numbers would be silently wrong, so none is calculated (FR-015). */
function hasVars(mosaicJson: string): boolean {
  try {
    const parsed: unknown = JSON.parse(mosaicJson);
    return (
      isObject(parsed) &&
      isObject(parsed.vars) &&
      Object.keys(parsed.vars).length > 0
    );
  } catch {
    return false;
  }
}

export function createCalculatorHost(deps: {
  createWorker: (options: WorkerOptions) => WorkerLike;
  readFiles: (resources: string) => Promise<GameBytes>;
  onResult: (n: CalcNumbers) => void;
  onUnavailable: () => void;
}): {
  calculate(mosaicJson: string): void;
  setFiles(resources: string): void;
  reset(): void;
} {
  let resources: string | null = null;
  let worker: WorkerLike | null = null;
  let ready = false;
  let calculating = false;
  let unavailable = false;
  let waiting: string | null = null;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let gap: ReturnType<typeof setTimeout> | undefined;

  function stop(): void {
    clearTimeout(deadline);
    clearTimeout(gap);
    gap = undefined;
    ready = false;
    calculating = false;
    const old = worker;
    worker = null; // First, so the `exit` of a terminated worker is not taken for a failure.
    old?.terminate();
  }

  function fail(): void {
    if (unavailable) return;
    unavailable = true;
    waiting = null;
    stop();
    deps.onUnavailable();
  }

  function limit(ms: number): void {
    clearTimeout(deadline);
    deadline = setTimeout(fail, ms);
  }

  function receive(m: unknown): void {
    if (!isObject(m)) return;
    if (m.type === "failed") fail();
    else if (m.type === "ready") {
      ready = true;
      next();
    } else if (m.type === "result" && calculating) {
      clearTimeout(deadline);
      calculating = false;
      gap = setTimeout(() => {
        gap = undefined;
        next();
      }, CALC_GAP_MS);
      deps.onResult(numbersOf(m.numbers));
    }
  }

  async function init(w: WorkerLike, folder: string): Promise<void> {
    try {
      const { code, pak } = await deps.readFiles(folder);
      if (w === worker)
        w.postMessage({ type: "init", code, pak }, [code.buffer, pak.buffer]);
    } catch {
      if (w === worker) fail();
    }
  }

  function start(folder: string): void {
    let w: WorkerLike;
    try {
      w = deps.createWorker(WORKER_OPTIONS);
    } catch {
      fail();
      return;
    }
    worker = w;
    limit(INIT_MS);
    const lost = (): void => {
      if (w === worker) fail();
    };
    w.on("message", (m) => {
      if (w === worker) receive(m);
    });
    w.on("error", lost);
    w.on("exit", lost);
    void init(w, folder);
  }

  function next(): void {
    if (waiting === null || resources === null) return;
    if (!worker) {
      start(resources);
      return;
    }
    if (!ready || calculating || gap !== undefined) return;
    const mosaic = waiting;
    waiting = null;
    calculating = true;
    limit(SET_MS);
    try {
      worker.postMessage({ type: "calc", mosaic });
    } catch {
      fail();
    }
  }

  return {
    calculate(mosaicJson) {
      if (unavailable) return;
      if (!hasVars(mosaicJson)) {
        fail();
        return;
      }
      waiting = mosaicJson;
      next();
    },
    setFiles(folder) {
      stop();
      unavailable = false;
      resources = folder;
      next();
    },
    reset() {
      stop();
      unavailable = false;
      waiting = null;
    },
  };
}
