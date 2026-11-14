// The worker's entry: `init` starts the engine once, and each `calc` is one calculation (contracts/calculator.md). An
// `init` with `mode: "tree"` makes this worker the tree worker, answering `tree` and `values` (spec 008,
// contracts/tree-worker.md).
import { parentPort } from "node:worker_threads";
import { createEngine } from "./engine.ts";
import { TARGETS } from "./targets.ts";
import type { CalcNumbers } from "./targets.ts";
import { createTreeEngine } from "./tree-engine.ts";
import type { TreeEngine } from "./tree-engine.ts";

interface Port {
  postMessage(m: unknown): void;
}
type Engine = ReturnType<typeof createEngine>;
type Message = Partial<
  Record<
    "type" | "mode" | "code" | "pak" | "mosaic" | "id" | "request" | "ids",
    unknown
  >
>;

const engines = new WeakMap<Port, Engine>();
const trees = new WeakMap<Port, TreeEngine>();

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

/** Nothing of the game's text leaves the worker: a failure is only `failed: true`. */
function treeResult(
  engine: TreeEngine | undefined,
  { id, request, mosaic }: Message,
): unknown {
  try {
    if (!engine) throw new Error("no tree engine");
    const tree = engine.tree(request, mosaic);
    return tree === "unknownNumber"
      ? { type: "treeResult", id, refused: "unknownNumber" }
      : { type: "treeResult", id, tree };
  } catch {
    return { type: "treeResult", id, failed: true };
  }
}

/** One number per id asked; a failure is every id unavailable, with nothing of the game's text. */
function valuesResult(
  engine: TreeEngine | undefined,
  { id, ids, mosaic }: Message,
): unknown {
  try {
    if (!engine) throw new Error("no tree engine");
    return { type: "valuesResult", id, values: engine.values(ids, mosaic) };
  } catch {
    const asked = Array.isArray(ids)
      ? ids.filter((x): x is string => typeof x === "string")
      : [];
    return {
      type: "valuesResult",
      id,
      values: Object.fromEntries(asked.map((x) => [x, null])),
    };
  }
}

export function handleMessage(
  m: unknown,
  port: Port,
  make: (code: string, pak: Uint8Array) => Engine = createEngine,
  makeTree: (code: string, pak: Uint8Array) => TreeEngine = createTreeEngine,
): void {
  if (typeof m !== "object" || m === null) return;
  const message = m as Message;
  const { type, mode, code, pak, mosaic } = message;
  if (type === "init") {
    try {
      if (!(code instanceof Uint8Array) || !(pak instanceof Uint8Array))
        throw new Error("no game bytes");
      const text = new TextDecoder().decode(code);
      if (mode === "tree") trees.set(port, makeTree(text, pak));
      else engines.set(port, make(text, pak));
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
  } else if (type === "tree") {
    port.postMessage(treeResult(trees.get(port), message));
  } else if (type === "values") {
    port.postMessage(valuesResult(trees.get(port), message));
  }
}

if (parentPort) {
  const port = parentPort;
  port.on("message", (m: unknown) => {
    handleMessage(m, port);
  });
}
