// The app's side of the calculator's worker: any failure of it is "unavailable" and nothing else (FR-014, FR-016).
// The worker is a fake, and every number and name here is invented.
import type { Worker } from "node:worker_threads";
import { afterEach, beforeEach, expect, expectTypeOf, test, vi } from "vitest";
import { calculatorPath, createCalculatorHost } from "./calculator-host.ts";
import type { WorkerLike } from "./calculator-host.ts";
import type { GameBytes } from "./game-files.ts";

const RESOURCES = "C:\\invented\\resources";

type Message = Record<string, unknown>;

class FakeWorker implements WorkerLike {
  posted: { message: Message; transfer: unknown }[] = [];
  terminated = 0;
  throwOnPost = false;
  private handlers = new Map<string, (value: unknown) => void>();
  postMessage(message: unknown, transfer?: unknown): void {
    if (this.throwOnPost) throw new Error("cannot post");
    this.posted.push({ message: message as Message, transfer });
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
  calcs(): unknown[] {
    return this.posted
      .filter((p) => p.message.type === "calc")
      .map((p) => p.message.mosaic);
  }
}

function nth(workers: FakeWorker[], i = 0): FakeWorker {
  const w = workers[i];
  if (!w) throw new Error("no such worker");
  return w;
}

const mosaic = (n: number) =>
  JSON.stringify({ attrs: { n }, vars: { A_invented: 1 }, skipped: [] });
const files = (): Promise<GameBytes> =>
  Promise.resolve({
    code: Uint8Array.from([1, 2]),
    pak: Uint8Array.from([3]),
  });
const flush = () => vi.advanceTimersByTimeAsync(0);

function setup(read: () => Promise<GameBytes> = files) {
  const workers: FakeWorker[] = [];
  const options: unknown[] = [];
  const readFiles = vi.fn(read);
  const onResult = vi.fn();
  const onUnavailable = vi.fn();
  const host = createCalculatorHost({
    createWorker: (o) => {
      options.push(o);
      const w = new FakeWorker();
      workers.push(w);
      return w;
    },
    readFiles,
    onResult,
    onUnavailable,
  });
  return { host, workers, options, readFiles, onResult, onUnavailable };
}

/** A host with its worker ready and calculating mosaic 1. */
async function running() {
  const t = setup();
  t.host.setFiles(RESOURCES);
  t.host.calculate(mosaic(1));
  await flush();
  const worker = nth(t.workers);
  worker.emit("message", { type: "ready" });
  return { ...t, worker };
}

function answer(w: FakeWorker): void {
  w.emit("message", { type: "result", numbers: {}, ms: 1 });
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test.each([
  ["C:\\p\\app.asar\\out\\main", "C:\\p\\app.asar.unpacked\\out\\main"],
  ["/p/app.asar/out/main", "/p/app.asar.unpacked/out/main"],
  ["C:\\dev\\app\\out\\main", "C:\\dev\\app\\out\\main"],
  ["C:\\my-app.asar\\out", "C:\\my-app.asar\\out"],
  ["C:\\p\\app.asar.unpacked\\out", "C:\\p\\app.asar.unpacked\\out"],
])("calculatorPath(%s)", (dir, expected) => {
  expect(calculatorPath(dir)).toBe(expected);
});

test("the real Worker fits where the fake does", () => {
  expectTypeOf<Worker>().toExtend<WorkerLike>();
});

test("the worker is created with no environment, no stdin and a memory limit", async () => {
  const t = await running();
  expect(t.options).toEqual([
    {
      env: {},
      stdin: false,
      resourceLimits: { maxOldGenerationSizeMb: 1024 },
    },
  ]);
});

test("the first calculate reads the files once and transfers them to the worker, with no path", async () => {
  const t = setup();
  t.host.setFiles(RESOURCES);
  t.host.calculate(mosaic(1));
  t.host.calculate(mosaic(2));
  await flush();
  expect(t.readFiles).toHaveBeenCalledTimes(1);
  expect(t.readFiles).toHaveBeenCalledWith(RESOURCES);
  expect(t.workers).toHaveLength(1);
  const [init] = nth(t.workers).posted;
  expect(init?.message.type).toBe("init");
  const { code, pak } = init?.message as { code: Uint8Array; pak: Uint8Array };
  expect(init?.transfer).toEqual([code.buffer, pak.buffer]);
  expect([...code]).toEqual([1, 2]);
  expect([...pak]).toEqual([3]);
  expect(JSON.stringify(init?.message)).not.toContain("invented");
});

test("a calculate before the folder is known waits for it", async () => {
  const t = setup();
  t.host.calculate(mosaic(1));
  await flush();
  expect(t.workers).toHaveLength(0);
  t.host.setFiles(RESOURCES);
  await flush();
  const worker = nth(t.workers);
  worker.emit("message", { type: "ready" });
  expect(worker.calcs()).toEqual([mosaic(1)]);
});

test("nothing is calculated before ready, and ready lets only the newest mosaic go", async () => {
  const t = setup();
  t.host.setFiles(RESOURCES);
  t.host.calculate(mosaic(1));
  t.host.calculate(mosaic(2));
  await flush();
  const worker = nth(t.workers);
  expect(worker.calcs()).toEqual([]);
  worker.emit("message", { type: "ready" });
  expect(worker.calcs()).toEqual([mosaic(2)]);
});

test("one calculation at a time, and a newer mosaic replaces the waiting one", async () => {
  const { host, worker } = await running();
  host.calculate(mosaic(2));
  host.calculate(mosaic(3));
  expect(worker.calcs()).toEqual([mosaic(1)]);
  answer(worker);
  await vi.advanceTimersByTimeAsync(5_000);
  expect(worker.calcs()).toEqual([mosaic(1), mosaic(3)]);
});

test("the next calculation waits 5,000 ms after the last ended", async () => {
  const { host, worker } = await running();
  await vi.advanceTimersByTimeAsync(1_000);
  answer(worker);
  host.calculate(mosaic(2));
  await vi.advanceTimersByTimeAsync(4_999);
  expect(worker.calcs()).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(worker.calcs()).toHaveLength(2);
});

test("a result reaches onResult, with an absent or non-number id as null", async () => {
  const { worker, onResult } = await running();
  worker.emit("message", {
    type: "result",
    numbers: {
      damageMax: 7,
      damageMin: 0,
      hp: "12",
      mp: Number.NaN,
      str: null,
      extra: 1,
    },
    ms: 1,
  });
  expect(onResult).toHaveBeenCalledTimes(1);
  expect(onResult).toHaveBeenCalledWith({
    damageMax: 7,
    damageMin: 0,
    hp: null,
    mp: null,
    accuracy: null,
    str: null,
    agi: null,
    wis: null,
    luk: null,
    dropRate: null,
    afkGains: null,
  });
});

test("a result with no numbers object is every number null", async () => {
  const { worker, onResult } = await running();
  worker.emit("message", { type: "result", numbers: "bad", ms: 1 });
  expect(onResult.mock.calls[0]?.[0]).toMatchObject({ hp: null, luk: null });
});

test("a result nobody is waiting for is ignored", async () => {
  const { worker, onResult } = await running();
  answer(worker);
  answer(worker);
  expect(onResult).toHaveBeenCalledTimes(1);
});

test.each([
  ["no ready in 60 s", null, null],
  ["failed", "message", { type: "failed" }],
  ["the worker's error", "error", new Error("boom")],
  ["the worker's exit", "exit", 1],
])(
  "before ready, %s terminates and is unavailable once, and later calculates do nothing",
  async (_name, event, value) => {
    const t = setup();
    t.host.setFiles(RESOURCES);
    t.host.calculate(mosaic(1));
    await flush();
    const worker = nth(t.workers);
    if (event === null) await vi.advanceTimersByTimeAsync(60_000);
    else worker.emit(event, value);
    expect(worker.terminated).toBe(1);
    expect(t.onUnavailable).toHaveBeenCalledTimes(1);
    t.host.calculate(mosaic(2));
    await vi.advanceTimersByTimeAsync(120_000);
    worker.emit("message", { type: "ready" });
    expect(t.workers).toHaveLength(1);
    expect(worker.calcs()).toEqual([]);
    expect(t.readFiles).toHaveBeenCalledTimes(1);
    expect(t.onUnavailable).toHaveBeenCalledTimes(1);
  },
);

test.each<[string, () => Promise<GameBytes>]>([
  ["rejects", () => Promise.reject(new Error("no file"))],
  [
    "throws",
    () => {
      throw new Error("no file");
    },
  ],
])("a read that %s terminates and is unavailable", async (_name, read) => {
  const t = setup(read);
  t.host.setFiles(RESOURCES);
  t.host.calculate(mosaic(1));
  await flush();
  expect(nth(t.workers).terminated).toBe(1);
  expect(t.onUnavailable).toHaveBeenCalledTimes(1);
});

test("a read that never answers is unavailable at 60 s, and not before", async () => {
  const t = setup(() => new Promise<GameBytes>(() => undefined));
  t.host.setFiles(RESOURCES);
  t.host.calculate(mosaic(1));
  await vi.advanceTimersByTimeAsync(59_999);
  expect(t.onUnavailable).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(t.onUnavailable).toHaveBeenCalledTimes(1);
});

test("no answer in 15 s terminates and is unavailable once, and not before", async () => {
  const { worker, onUnavailable } = await running();
  await vi.advanceTimersByTimeAsync(14_999);
  expect(onUnavailable).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(worker.terminated).toBe(1);
  expect(onUnavailable).toHaveBeenCalledTimes(1);
});

test("an answer ends the waits", async () => {
  const { worker, onUnavailable } = await running();
  answer(worker);
  await vi.advanceTimersByTimeAsync(120_000);
  expect(worker.terminated).toBe(0);
  expect(onUnavailable).not.toHaveBeenCalled();
});

test.each([
  ["empty vars", JSON.stringify({ attrs: {}, vars: {} })],
  ["no vars", JSON.stringify({ attrs: {} })],
  ["bad JSON", "{"],
])("a mosaic with %s is unavailable, with no calculation", async (_n, bad) => {
  const { host, worker, onUnavailable } = await running();
  host.calculate(bad);
  host.calculate(bad);
  await vi.advanceTimersByTimeAsync(5_000);
  expect(worker.terminated).toBe(1);
  expect(worker.calcs()).toEqual([mosaic(1)]);
  expect(onUnavailable).toHaveBeenCalledTimes(1);
});

test("a worker that cannot be created is unavailable, and nothing is thrown", () => {
  const onUnavailable = vi.fn();
  const host = createCalculatorHost({
    createWorker: () => {
      throw new Error("no worker");
    },
    readFiles: files,
    onResult: vi.fn(),
    onUnavailable,
  });
  host.setFiles(RESOURCES);
  expect(() => {
    host.calculate(mosaic(1));
  }).not.toThrow();
  expect(onUnavailable).toHaveBeenCalledTimes(1);
});

test("a post that throws is unavailable, and nothing is thrown", async () => {
  const { host, worker, onUnavailable } = await running();
  answer(worker);
  await vi.advanceTimersByTimeAsync(5_000);
  worker.throwOnPost = true;
  expect(() => {
    host.calculate(mosaic(2));
  }).not.toThrow();
  expect(worker.terminated).toBe(1);
  expect(onUnavailable).toHaveBeenCalledTimes(1);
});

test("an init that cannot be posted is unavailable", async () => {
  const t = setup();
  t.host.setFiles(RESOURCES);
  t.host.calculate(mosaic(1));
  nth(t.workers).throwOnPost = true;
  await flush();
  expect(t.onUnavailable).toHaveBeenCalledTimes(1);
});

test("reset terminates with no unavailable, drops the waiting mosaic and allows a new start", async () => {
  const { host, worker, workers, readFiles, onUnavailable } = await running();
  host.calculate(mosaic(2));
  host.reset();
  expect(worker.terminated).toBe(1);
  expect(onUnavailable).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(workers).toHaveLength(1);
  host.calculate(mosaic(3));
  await flush();
  expect(workers).toHaveLength(2);
  expect(readFiles).toHaveBeenCalledTimes(2);
  nth(workers, 1).emit("message", { type: "ready" });
  expect(nth(workers, 1).calcs()).toEqual([mosaic(3)]);
});

test("reset clears an unavailable host", async () => {
  const { host, worker, workers, onUnavailable } = await running();
  worker.emit("error", new Error("boom"));
  host.reset();
  host.calculate(mosaic(2));
  await flush();
  expect(workers).toHaveLength(2);
  expect(onUnavailable).toHaveBeenCalledTimes(1);
});

test("the old worker's late messages and a late read mean nothing after a reset", async () => {
  let answerRead: (b: GameBytes) => void = () => undefined;
  const t = setup(
    () =>
      new Promise<GameBytes>((r) => {
        answerRead = r;
      }),
  );
  t.host.setFiles(RESOURCES);
  t.host.calculate(mosaic(1));
  const old = nth(t.workers);
  t.host.reset();
  answerRead(await files());
  await flush();
  old.emit("message", { type: "ready" });
  old.emit("message", { type: "failed" });
  old.emit("error", new Error("late"));
  expect(old.posted).toEqual([]);
  expect(t.onUnavailable).not.toHaveBeenCalled();
});

test("reset forgets the 5,000 ms wait", async () => {
  const { host, worker, workers } = await running();
  answer(worker);
  host.reset();
  host.calculate(mosaic(2));
  await flush();
  nth(workers, 1).emit("message", { type: "ready" });
  expect(nth(workers, 1).calcs()).toEqual([mosaic(2)]);
});

test("new files start over, from the new folder, even after unavailable", async () => {
  const { host, worker, workers, readFiles } = await running();
  host.calculate(mosaic(2));
  worker.emit("error", new Error("boom"));
  host.setFiles("C:\\other\\resources");
  await flush();
  expect(workers).toHaveLength(1); // The mosaic that waited died with the failure.
  host.calculate(mosaic(3));
  await flush();
  expect(readFiles).toHaveBeenLastCalledWith("C:\\other\\resources");
  expect(workers).toHaveLength(2);
});

test("new files replace a working engine", async () => {
  const { host, worker, workers } = await running();
  answer(worker);
  host.setFiles(RESOURCES);
  expect(worker.terminated).toBe(1);
  host.calculate(mosaic(2));
  await flush();
  expect(workers).toHaveLength(2);
});
