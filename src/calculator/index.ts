// The worker's entry: `init` starts the engine once, and each `calc` is one calculation (contracts/calculator.md).
import { parentPort } from "node:worker_threads";
import { createEngine } from "./engine.ts";
import { TARGETS } from "./targets.ts";
import type { CalcNumbers } from "./targets.ts";

interface Port {
  postMessage(m: unknown): void;
}
type Engine = ReturnType<typeof createEngine>;
type Message = Partial<Record<"type" | "code" | "pak" | "mosaic", unknown>>;

const engines = new WeakMap<Port, Engine>();

function calculate(engine: Engine | undefined, mosaic: unknown): CalcNumbers {
  try {
    if (engine) return engine.calculate(mosaic as string);
  } catch {
    // A calculation that fails is every number unavailable, and the next one tries again.
  }
  return Object.fromEntries(
    TARGETS.map(([id]) => [id, null]),
  ) as unknown as CalcNumbers;
}

export function handleMessage(
  m: unknown,
  port: Port,
  make: (code: string, pak: Uint8Array) => Engine = createEngine,
): void {
  if (typeof m !== "object" || m === null) return;
  const { type, code, pak, mosaic } = m as Message;
  if (type === "init") {
    try {
      if (!(code instanceof Uint8Array) || !(pak instanceof Uint8Array))
        throw new Error("no game bytes");
      engines.set(port, make(new TextDecoder().decode(code), pak));
      port.postMessage({ type: "ready" });
    } catch {
      port.postMessage({ type: "failed" }); // Nothing of the game's text leaves the worker.
    }
  } else if (type === "calc") {
    const started = performance.now();
    const numbers = calculate(engines.get(port), mosaic);
    port.postMessage({
      type: "result",
      numbers,
      ms: performance.now() - started,
    });
  }
}

if (parentPort) {
  const port = parentPort;
  port.on("message", (m: unknown) => {
    handleMessage(m, port);
  });
}
