// The app's side of the tree worker (research R1, contracts/tree-worker.md): long-lived, one request in flight, and a
// failure of it is that request "unavailable" and nothing else (FR-017). The worker is a fake; every value is invented.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  FakeWorker,
  files,
  flush,
  mosaic,
  nth,
  RESOURCES,
} from "./calculator-host-fixture.ts";
import type { GameBytes } from "./game-files.ts";
import { createTreeHost, TREE_REQUEST_MS } from "./tree-host.ts";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const DROP = { type: "number", id: "dropRate", character: 0 } as const;
const HP = { type: "number", id: "hp", character: 0 } as const;
const NO_VARS = JSON.stringify({ attrs: { n: 1 }, vars: {}, skipped: [] });

function setup(read: () => Promise<GameBytes> = files) {
  const workers: FakeWorker[] = [];
  const options: unknown[] = [];
  const readFiles = vi.fn(read);
  const onTree = vi.fn();
  const onValues = vi.fn();
  const onUnavailable = vi.fn();
  const onShape = vi.fn();
  const host = createTreeHost({
    createWorker: (o) => {
      options.push(o);
      const w = new FakeWorker();
      workers.push(w);
      return w;
    },
    readFiles,
    onTree,
    onValues,
    onUnavailable,
    onShape,
  });
  host.setFiles(RESOURCES);
  return {
    host,
    workers,
    options,
    readFiles,
    onTree,
    onValues,
    onUnavailable,
    onShape,
  };
}

/** A host whose worker is ready and has request 1 (the Drop Rate over mosaic 1) in flight. */
async function running() {
  const t = setup();
  t.host.request(1, DROP, mosaic(1));
  await flush();
  const worker = nth(t.workers);
  worker.emit("message", { type: "ready" });
  return { ...t, worker };
}

const answer = (w: FakeWorker, id: number, tree: unknown = { id: "root" }) => {
  w.emit("message", { type: "treeResult", id, tree });
};

test("the worker has no environment, no stdin and 2 GB of heap", async () => {
  const t = await running();
  expect(t.options).toEqual([
    { env: {}, stdin: false, resourceLimits: { maxOldGenerationSizeMb: 2048 } },
  ]);
});

test("the host reads the game files itself and transfers them in a tree init", async () => {
  const t = await running();
  expect(t.readFiles).toHaveBeenCalledExactlyOnceWith(RESOURCES);
  const [init] = t.worker.posted;
  expect(init?.message).toMatchObject({ type: "init", mode: "tree" });
  const { code, pak } = init?.message as { code: Uint8Array; pak: Uint8Array };
  expect(init?.transfer).toEqual([code.buffer, pak.buffer]);
});

test("after ready the request goes with its id and mosaic, and its tree reaches onTree", async () => {
  const t = await running();
  expect(t.worker.sent("tree")).toEqual([
    { type: "tree", id: 1, request: DROP, mosaic: mosaic(1) },
  ]);
  answer(t.worker, 1, { id: "root", value: 2 });
  expect(t.onTree).toHaveBeenCalledExactlyOnceWith(1, { id: "root", value: 2 });
});

test.each([
  ["refused", { refused: "unknownNumber" }],
  ["failed", { failed: true }],
])("a %s tree is that request unavailable", async (_name, body) => {
  const t = await running();
  t.worker.emit("message", { type: "treeResult", id: 1, ...body });
  expect(t.onUnavailable).toHaveBeenCalledExactlyOnceWith(1);
  expect(t.onTree).not.toHaveBeenCalled();
});

test("never two requests in flight: a new one replaces the waiting one", async () => {
  const t = await running();
  t.host.request(2, HP, mosaic(2));
  t.host.request(3, DROP, mosaic(3));
  expect(t.worker.sent("tree").map((m) => m.id)).toEqual([1]);
  answer(t.worker, 1);
  expect(t.worker.sent("tree").map((m) => m.id)).toEqual([1, 3]);
});

test("an expand goes with no mosaic", async () => {
  const t = await running();
  answer(t.worker, 1);
  const expand = { type: "expand", treeId: "t", nodeId: "n" } as const;
  t.host.request(2, expand, null);
  expect(t.worker.sent("tree")[1]).toEqual({
    type: "tree",
    id: 2,
    request: expand,
  });
});

const EXPAND = { type: "expand", treeId: "t", nodeId: "n" } as const;

test.each([
  [
    "a worker that died",
    (t: Awaited<ReturnType<typeof running>>) => {
      t.worker.emit("exit", 1);
    },
  ],
  [
    "the game closed",
    (t: Awaited<ReturnType<typeof running>>) => {
      t.host.stop();
    },
  ],
])(
  "after %s, a new worker gets the last number again, its answer dropped, before an expand",
  async (_name, end) => {
    const t = await running();
    answer(t.worker, 1);
    end(t);
    t.host.request(2, EXPAND, null);
    await flush();
    const second = nth(t.workers, 1);
    second.emit("message", { type: "ready" });
    expect(second.sent("tree")).toEqual([
      { type: "tree", id: 1, request: DROP, mosaic: mosaic(1) },
    ]);
    answer(second, 1);
    expect(second.sent("tree").map((m) => m.id)).toEqual([1, 2]);
    answer(second, 2, { id: "n" });
    expect(t.onTree.mock.calls).toEqual([
      [1, { id: "root" }],
      [2, { id: "n" }],
    ]);
    expect(t.onUnavailable).not.toHaveBeenCalled();
  },
);

test("an expand whose new worker cannot build the number again is unavailable, with no endless restart", async () => {
  const t = await running();
  answer(t.worker, 1);
  t.host.stop();
  t.host.request(2, EXPAND, null);
  await flush();
  nth(t.workers, 1).emit("message", { type: "ready" });
  await vi.advanceTimersByTimeAsync(TREE_REQUEST_MS);
  expect(t.onUnavailable).toHaveBeenCalledExactlyOnceWith(2);
  await flush();
  expect(t.workers).toHaveLength(2);
});

test("a mosaic with no _vars is unavailable before it reaches the worker (FR-015 of 005)", async () => {
  const t = await running();
  answer(t.worker, 1);
  t.host.request(2, DROP, NO_VARS);
  expect(t.onUnavailable).toHaveBeenCalledExactlyOnceWith(2);
  expect(t.worker.sent("tree")).toHaveLength(1);
});

test("dropCurrent drops the waiting request and the answer in flight, and keeps the worker", async () => {
  const t = await running();
  t.host.request(2, HP, mosaic(2));
  t.host.dropCurrent();
  answer(t.worker, 1);
  expect(t.onTree).not.toHaveBeenCalled();
  expect(t.worker.sent("tree").map((m) => m.id)).toEqual([1]);
  expect(t.worker.terminated).toBe(0);
  t.host.request(4, DROP, mosaic(4));
  expect(t.worker.sent("tree").map((m) => m.id)).toEqual([1, 4]);
  expect(t.workers).toHaveLength(1);
});

test("a dropped request whose worker dies is neither unavailable nor tried again", async () => {
  const t = await running();
  t.host.dropCurrent();
  t.worker.emit("exit", 1);
  await flush();
  expect(t.onUnavailable).not.toHaveBeenCalled();
  expect(t.workers).toHaveLength(1);
});

test("a request after dropCurrent waits for the answer in flight", async () => {
  const t = await running();
  t.host.dropCurrent();
  t.host.request(2, HP, mosaic(2));
  expect(t.worker.sent("tree").map((m) => m.id)).toEqual([1]);
  answer(t.worker, 1);
  expect(t.worker.sent("tree").map((m) => m.id)).toEqual([1, 2]);
});

test("only a new setFiles or stop ends the worker", async () => {
  const t = await running();
  t.host.dropCurrent();
  expect(t.worker.terminated).toBe(0);
  t.host.setFiles(RESOURCES);
  expect(t.worker.terminated).toBe(1);
  t.host.request(2, DROP, mosaic(2));
  await flush();
  const second = nth(t.workers, 1);
  second.emit("message", { type: "ready" });
  t.host.stop();
  expect(second.terminated).toBe(1);
  expect(t.onUnavailable).not.toHaveBeenCalled();
});

test("a request past its time ends the worker, only it is unavailable, and the next one starts another worker", async () => {
  const t = await running();
  t.host.request(2, HP, mosaic(2));
  await vi.advanceTimersByTimeAsync(TREE_REQUEST_MS);
  expect(t.worker.terminated).toBe(1);
  expect(t.onUnavailable).toHaveBeenCalledExactlyOnceWith(1);
  await flush();
  const second = nth(t.workers, 1);
  expect(t.readFiles).toHaveBeenCalledTimes(2);
  second.emit("message", { type: "ready" });
  expect(second.sent("tree").map((m) => m.id)).toEqual([2]);
});

test("a worker that dies leaves the request unavailable, tries it once more, and no more", async () => {
  const t = await running();
  t.worker.emit("exit", 1);
  expect(t.onUnavailable).toHaveBeenCalledExactlyOnceWith(1);
  await flush();
  const second = nth(t.workers, 1);
  second.emit("message", { type: "ready" });
  expect(second.sent("tree").map((m) => m.id)).toEqual([1]);
  second.emit("error", new Error("native failure"));
  await flush();
  expect(t.workers).toHaveLength(2);
  expect(t.onUnavailable).toHaveBeenCalledTimes(2);
});

test("the retry after a death can still bring the tree", async () => {
  const t = await running();
  t.worker.emit("exit", 1);
  await flush();
  const second = nth(t.workers, 1);
  second.emit("message", { type: "ready" });
  answer(second, 1, { id: "root" });
  expect(t.onTree).toHaveBeenCalledExactlyOnceWith(1, { id: "root" });
});

test("a failed init ends the worker and the request is unavailable, with no retry", async () => {
  const t = setup();
  t.host.request(1, DROP, mosaic(1));
  await flush();
  nth(t.workers).emit("message", { type: "failed" });
  await flush();
  expect(t.onUnavailable).toHaveBeenCalledExactlyOnceWith(1);
  expect(nth(t.workers).terminated).toBe(1);
  expect(t.workers).toHaveLength(1);
});

test("files that cannot be read make the request unavailable", async () => {
  const t = setup(() => Promise.reject(new Error("no such file")));
  t.host.request(1, DROP, mosaic(1));
  await flush();
  expect(t.onUnavailable).toHaveBeenCalledExactlyOnceWith(1);
});

test("replay sends the last request again", async () => {
  const t = await running();
  answer(t.worker, 1);
  t.host.replay();
  expect(t.worker.sent("tree")).toEqual([
    { type: "tree", id: 1, request: DROP, mosaic: mosaic(1) },
    { type: "tree", id: 1, request: DROP, mosaic: mosaic(1) },
  ]);
});

test("values go to the worker and come back to onValues", async () => {
  const t = await running();
  answer(t.worker, 1);
  t.host.values(5, ["hp"], mosaic(5));
  expect(t.worker.sent("values")).toEqual([
    { type: "values", id: 5, ids: ["hp"], mosaic: mosaic(5) },
  ]);
  t.worker.emit("message", { type: "valuesResult", id: 5, values: { hp: 3 } });
  expect(t.onValues).toHaveBeenCalledExactlyOnceWith(5, { hp: 3 });
});

// Values fail apart from the trees (review of phase 2): their own ids, and `onValues(id, null)`, never `onUnavailable`.
test("values over a mosaic with no _vars are null before they reach the worker", async () => {
  const t = await running();
  answer(t.worker, 1);
  t.host.values(5, ["hp"], NO_VARS);
  expect(t.onValues).toHaveBeenCalledExactlyOnceWith(5, null);
  expect(t.onUnavailable).not.toHaveBeenCalled();
  expect(t.worker.sent("values")).toEqual([]);
});

test.each([
  [
    "dies",
    async (t: Awaited<ReturnType<typeof running>>) => {
      t.worker.emit("exit", 1);
      await flush();
    },
  ],
  [
    "runs out of time",
    async () => {
      await vi.advanceTimersByTimeAsync(TREE_REQUEST_MS);
    },
  ],
])(
  "values whose worker %s are null, never a tree unavailable, and are not tried again",
  async (_name, end) => {
    const t = await running();
    answer(t.worker, 1);
    t.host.values(5, ["hp"], mosaic(5));
    await end(t);
    expect(t.onValues).toHaveBeenCalledExactlyOnceWith(5, null);
    expect(t.onUnavailable).not.toHaveBeenCalled();
    expect(t.workers).toHaveLength(1);
  },
);

// Where this goes (FR-027): the shapes of the catalog are asked in the background, after every tree and value.
test("a shape waits for the trees and the values, and comes back to onShape", async () => {
  const t = await running();
  t.host.shape(7, "hp", mosaic(7));
  t.host.values(5, ["hp"], mosaic(5));
  t.host.request(2, HP, mosaic(2));
  answer(t.worker, 1);
  t.worker.emit("message", { type: "treeResult", id: 2, tree: {} });
  t.worker.emit("message", { type: "valuesResult", id: 5, values: {} });
  expect(t.worker.sent("shape")).toEqual([
    { type: "shape", id: 7, treeId: "hp", mosaic: mosaic(7) },
  ]);
  t.worker.emit("message", { type: "shapeResult", id: 7, shape: [["k", "n"]] });
  expect(t.onShape).toHaveBeenCalledExactlyOnceWith(7, [["k", "n"]]);
});

test.each([
  ["that failed", { failed: true }],
  ["with no parts", {}],
])("a shape answer %s is null", async (_name, body) => {
  const t = await running();
  answer(t.worker, 1);
  t.host.shape(7, "hp", mosaic(7));
  t.worker.emit("message", { type: "shapeResult", id: 7, ...body });
  expect(t.onShape).toHaveBeenCalledExactlyOnceWith(7, null);
});

test("a shape over a mosaic with no _vars is null before it reaches the worker", async () => {
  const t = await running();
  answer(t.worker, 1);
  t.host.shape(7, "hp", NO_VARS);
  expect(t.onShape).toHaveBeenCalledExactlyOnceWith(7, null);
  expect(t.worker.sent("shape")).toEqual([]);
});

test("dropCurrent keeps the shapes: the one in flight answers, the one waiting goes next", async () => {
  const t = await running();
  answer(t.worker, 1);
  t.host.shape(7, "hp", mosaic(7));
  t.host.dropCurrent();
  t.host.shape(8, "dropRate", mosaic(8));
  t.host.dropCurrent();
  t.worker.emit("message", { type: "shapeResult", id: 7, shape: [] });
  expect(t.onShape).toHaveBeenCalledExactlyOnceWith(7, []);
  expect(t.worker.sent("shape").map((m) => m.id)).toEqual([7, 8]);
});

test.each([
  [
    "dies",
    async (t: Awaited<ReturnType<typeof running>>) => {
      t.worker.emit("exit", 1);
      await flush();
    },
  ],
  [
    "runs out of time",
    async () => {
      await vi.advanceTimersByTimeAsync(TREE_REQUEST_MS);
    },
  ],
])(
  "a shape whose worker %s is null, with the waiting one, and neither is tried again",
  async (_name, end) => {
    const t = await running();
    answer(t.worker, 1);
    t.host.shape(7, "hp", mosaic(7));
    t.host.shape(8, "hp", mosaic(8));
    await end(t);
    expect(t.onShape.mock.calls).toEqual([
      [7, null],
      [8, null],
    ]);
    expect(t.onUnavailable).not.toHaveBeenCalled();
    expect(t.workers).toHaveLength(1);
  },
);

test.each(["stop", "setFiles"] as const)(
  "%s drops the waiting shape with no answer",
  async (end) => {
    const t = await running();
    t.host.shape(7, "hp", mosaic(7));
    if (end === "stop") t.host.stop();
    else t.host.setFiles(RESOURCES);
    t.host.request(2, HP, mosaic(2));
    await flush();
    const next = nth(t.workers, 1);
    next.emit("message", { type: "ready" });
    answer(next, 2);
    expect(next.sent("shape")).toEqual([]);
    expect(t.onShape).not.toHaveBeenCalled();
  },
);
