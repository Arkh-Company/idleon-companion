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
  });
  host.setFiles(RESOURCES);
  return { host, workers, options, readFiles, onTree, onValues, onUnavailable };
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
