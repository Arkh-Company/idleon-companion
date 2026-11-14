// The harness of the calculator host's tests: a fake worker. Every number and name here is invented.
import { vi } from "vitest";
import { createCalculatorHost } from "./calculator-host.ts";
import type { WorkerLike } from "./calculator-host.ts";
import type { GameBytes } from "./game-files.ts";

export const RESOURCES = "C:\\invented\\resources";

type Message = Record<string, unknown>;

export class FakeWorker implements WorkerLike {
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
  /** The messages of one type the worker got. */
  sent(type: string): Message[] {
    return this.posted
      .filter((p) => p.message.type === type)
      .map((p) => p.message);
  }
}

export function nth(workers: FakeWorker[], i = 0): FakeWorker {
  const w = workers[i];
  if (!w) throw new Error("no such worker");
  return w;
}

export const mosaic = (n: number) =>
  JSON.stringify({ attrs: { n }, vars: { A_invented: 1 }, skipped: [] });
export const files = (): Promise<GameBytes> =>
  Promise.resolve({
    code: Uint8Array.from([1, 2]),
    pak: Uint8Array.from([3]),
  });
export const flush = () => vi.advanceTimersByTimeAsync(0);

export function setup(read: () => Promise<GameBytes> = files) {
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

export function starting(read?: () => Promise<GameBytes>) {
  const t = setup(read);
  t.host.setFiles(RESOURCES);
  t.host.calculate(mosaic(1));
  return t;
}

/** A host with its worker ready and calculating mosaic 1. */
export async function running() {
  const t = starting();
  await flush();
  const worker = nth(t.workers);
  worker.emit("message", { type: "ready" });
  return { ...t, worker };
}

export function answer(w: FakeWorker): void {
  w.emit("message", { type: "result", numbers: {}, ms: 1 });
}
