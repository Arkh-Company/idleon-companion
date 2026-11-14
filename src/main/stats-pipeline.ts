// From the keeper's slices to the Stats tab: the mosaic, the calculator's host, the check and the tab's state, joined.
// Nothing here throws to the link or to the host: a failure of any part is "unavailable" and the rest of the app goes on
// (FR-014, FR-016).
import type { WorkerOptions } from "node:worker_threads";
import { isObject } from "../shared/index.ts";
import type {
  CalcNumbers,
  LinkMessage,
  Reading,
  Stats,
  Status,
} from "../shared/index.ts";
import { createCalculatorHost } from "./calculator-host.ts";
import type { WorkerLike } from "./calculator-host.ts";
import type { GameBytes } from "./game-files.ts";
import { linkGameFiles, linkState } from "./payloads.ts";
import { createStateStore } from "./state-store.ts";
import { statListCheck, statsRows, statsTracker } from "./stats.ts";

/** The last result of the active character and the mosaic it came from: what a tree request uses (FR-019 of 008). */
export interface StatsPair {
  numbers: CalcNumbers;
  mosaicJson: string;
  calculatedAt: number;
}

/** With a character and the reader attached, the state reader sends twelve slices a second. */
const STALL_MS = 30_000;

function statListOf(mosaicJson: string, char: string | null): unknown {
  let v: unknown = JSON.parse(mosaicJson);
  for (const key of [
    "attrs",
    "PlayerDATABASE",
    "$m",
    char ?? "",
    "$m",
    "PersonalValuesMap",
    "$m",
    "StatList",
  ])
    v = isObject(v) ? v[key] : undefined;
  return v;
}

export function startStatsPipeline(deps: {
  send: (s: Stats) => void;
  createWorker: (options: WorkerOptions) => WorkerLike;
  readFiles: (resources: string) => Promise<GameBytes>;
}): {
  message(m: LinkMessage): void;
  reading(r: Reading): void;
  status(s: Status): void;
  replay(): void;
  /** Kept in memory with the game closed (FR-022 of 008); null after a character change or with no character. */
  pair(): StatsPair | null;
} {
  /** Stays until a new `gameFiles`, also across a release: a game patch does not heal by reconnecting. */
  let failed = false;
  let attached = false;
  let selected = false;
  let char: string | null = null;
  let statList: unknown;
  let pair: StatsPair | null = null;
  let check = statListCheck(Date.now);
  /** Stays set after it fires, so a repeated status does not start it again before a new slice. */
  let stall: ReturnType<typeof setTimeout> | undefined;

  const tracker = statsTracker(deps.send);

  function fail(): void {
    failed = true;
    host.reset();
    try {
      tracker.unavailable();
    } catch {
      // The window cannot be reached: there is nobody left to tell.
    }
  }

  const guarded =
    <A extends unknown[]>(f: (...args: A) => void) =>
    (...args: A): void => {
      try {
        f(...args);
      } catch {
        fail();
      }
    };

  const host = createCalculatorHost({
    createWorker: deps.createWorker,
    readFiles: deps.readFiles,
    onResult: guarded((n, mosaicJson) => {
      pair = { numbers: n, mosaicJson, calculatedAt: Date.now() };
      tracker.result(statsRows(n, check(n, statList)));
    }),
    onUnavailable: fail,
  });

  /** A new character or no character: what was checked or is being calculated belongs to the one before. */
  function forget(): void {
    statList = undefined;
    check = statListCheck(Date.now);
    host.reset();
  }

  const store = createStateStore({
    onDue: (mosaicJson) => {
      if (failed) return;
      statList = statListOf(mosaicJson, char);
      host.calculate(mosaicJson);
    },
    onCharacter: (c) => {
      char = c;
      pair = null;
      forget();
      if (c === null) tracker.clear();
      else tracker.character();
    },
  });

  function stop(): void {
    store.clear();
    char = null;
    pair = null;
    forget();
    tracker.clear();
  }

  /** The game closed: the reading and the calculation end, and the last numbers stay (FR-022 of 008). */
  function close(): void {
    store.clear();
    char = null;
    forget();
    tracker.closed();
  }

  function watch(slice = false): void {
    const wanted = selected && attached;
    if (!slice && wanted === (stall !== undefined)) return;
    clearTimeout(stall);
    stall = wanted
      ? setTimeout(
          guarded(() => {
            tracker.stalled();
          }),
          STALL_MS,
        )
      : undefined;
  }

  function message(m: LinkMessage): void {
    if (m.type === "gameFiles") {
      const resources = linkGameFiles(m.resources);
      if (resources === null) return;
      failed = false;
      store.clear();
      char = null;
      tracker.start();
      host.setFiles(resources);
    } else if (m.type === "state") {
      const s = linkState(m.slice);
      // A slice read just before the reader let go arrives after the news of it. No check of `selected`: the state
      // reader sees a new character before the `reading` does, and those first slices are part of the mosaic.
      if (!s || !attached) return;
      store.add(s);
      if (s.sentinel.char === null) return;
      tracker.slice();
      watch(true);
    }
  }

  function reading(r: Reading): void {
    selected = r.char !== null;
    if (!selected) stop();
    watch();
  }

  function status(s: Status): void {
    attached = s.game === "running" && s.reader === "attached";
    if (s.game === "closed") close();
    else if (!attached) stop();
    watch();
  }

  return {
    message: guarded(message),
    reading: guarded(reading),
    status: guarded(status),
    replay: guarded(() => {
      tracker.replay();
    }),
    pair: () => pair,
  };
}
