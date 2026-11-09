// The harness of the Stats pipeline's tests: a fake worker, invented slices and the fake game's messages. Every number
// and character name here is invented.
import { vi } from "vitest";
import { READ_NULLS } from "../shared/index.ts";
import type { Reading, StateSlice, Stats, Status } from "../shared/index.ts";
import type { WorkerLike } from "./calculator-host.ts";
import type { GameBytes } from "./game-files.ts";
import { startStatsPipeline } from "./stats-pipeline.ts";

export const RESOURCES = "C:\\invented\\resources";
const CHAR = "Invented";
export const CALCULATED = {
  damageMin: 1,
  damageMax: 2,
  hp: 3,
  mp: 4,
  accuracy: 5,
  str: 11,
  agi: 22,
  wis: 33,
  luk: 44,
  dropRate: 6,
  afkGains: 7,
};
export const CALCULATING: Stats = { state: "calculating" };
export const NONE: Stats = { state: "none" };
export const UNAVAILABLE: Stats = { state: "unavailable" };
export const ATTACHED: Status = { game: "running", reader: "attached" };

export type Piece = StateSlice["pieces"][number];
type Message = Record<string, unknown>;

class FakeWorker implements WorkerLike {
  posted: Message[] = [];
  terminated = 0;
  private handlers = new Map<string, (value: unknown) => void>();
  postMessage(message: unknown): void {
    this.posted.push(message as Message);
  }
  on(event: string, listener: (value: unknown) => void): void {
    this.handlers.set(event, listener);
  }
  terminate(): void {
    this.terminated++;
    this.emit("exit", 1); // A real worker that is terminated also ends with `exit`.
  }
  emit(event: string, value?: unknown): void {
    this.handlers.get(event)?.(value);
  }
  calcs(): string[] {
    return this.posted
      .filter((m) => m.type === "calc")
      .map((m) => m.mosaic as string);
  }
}

export const reading = (char: string | null = CHAR): Reading => ({
  ...READ_NULLS,
  t: 1,
  map: 5,
  menu: 0,
  menu2: 0,
  menu2tab: 0,
  skillTab: 0,
  char,
  afk: null,
  codexTab: null,
});
export const vars: Piece = { path: ["_vars"], value: { A_friendBons: 1 } };
export const piece = (top: string, value: unknown): Piece => ({
  path: [top],
  value,
});
export const statList = (list: unknown, char = CHAR): Piece => ({
  path: ["PlayerDATABASE", char],
  value: { $m: { PersonalValuesMap: { $m: { StatList: list } } } },
});
export const flush = () => vi.advanceTimersByTimeAsync(0);

export function setup() {
  const workers: FakeWorker[] = [];
  const options: unknown[] = [];
  const sent: Stats[] = [];
  const send = vi.fn((s: Stats) => {
    sent.push(s);
  });
  const readFiles = vi.fn((): Promise<GameBytes> =>
    Promise.resolve({
      code: Uint8Array.from([1]),
      pak: Uint8Array.from([2]),
    }),
  );
  const p = startStatsPipeline({
    send,
    createWorker: (o) => {
      options.push(o);
      const w = new FakeWorker();
      workers.push(w);
      return w;
    },
    readFiles,
  });
  let laps = 0;
  const h = {
    p,
    workers,
    options,
    sent,
    send,
    readFiles,
    last: () => sent.at(-1),
    worker: () => {
      const w = workers.at(-1);
      if (!w) throw new Error("no worker");
      return w;
    },
    slice(
      pieces: Piece[] = [],
      cycles: StateSlice["cycles"] = { fast: 0, all: 0 },
      char: string | null = CHAR,
    ) {
      p.message({
        type: "state",
        slice: { sentinel: { char, map: 5 }, pieces, at: 1, cycles },
      });
    },
    /** A whole rotation: the slice before it and the one that closes it. */
    rotation(pieces: Piece[] = [vars], char: string | null = CHAR) {
      h.slice([], { fast: laps, all: laps }, char);
      laps++;
      h.slice(pieces, { fast: laps, all: laps }, char);
    },
    restartCycles() {
      laps = 0;
    },
    files() {
      p.message({ type: "gameFiles", resources: RESOURCES });
    },
    async ready() {
      await flush();
      h.worker().emit("message", { type: "ready" });
    },
    answer(numbers: unknown = CALCULATED) {
      h.worker().emit("message", { type: "result", numbers });
    },
    /** The game open and a character selected. */
    open() {
      p.status(ATTACHED);
      p.reading(reading());
    },
    /** The game open, a character selected and its first calculation answered. */
    async showing(pieces: Piece[] = [vars]) {
      h.open();
      h.files();
      h.rotation(pieces);
      await h.ready();
      h.answer();
    },
    /** The game open, and the worker reports it could not start. */
    async failing() {
      h.open();
      h.files();
      h.rotation();
      await flush();
      h.worker().emit("message", { type: "failed" });
    },
  };
  return h;
}
