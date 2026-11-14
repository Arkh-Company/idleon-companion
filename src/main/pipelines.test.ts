// The Stats and the trees joined as the app runs them (src/main/index.ts): a tree request uses the mosaic the Stats
// calculated, its root reaches the window, and nothing of the trees reaches the Stats (FR-017, FR-019). The workers are
// fakes; every value and name is invented.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { IPC } from "../shared/index.ts";
import { FakeWorker } from "./calculator-host-fixture.ts";
import { node } from "./formula-fixture.ts";
import type { GameBytes } from "./game-files.ts";
import { startPipelines } from "./pipelines.ts";
import {
  ATTACHED,
  CALCULATED,
  flush,
  piece,
  reading,
  RESOURCES,
  vars,
} from "./stats-pipeline-fixture.ts";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const CHARACTER = [
  piece("UserInfo", ["Invented"]),
  piece("GetPlayersUsernames", ["Someone", "Invented"]),
];

function setup() {
  const workers: { worker: FakeWorker; heap: number }[] = [];
  const sent: { channel: string; value: unknown }[] = [];
  /** The window gone for the trees only. */
  let treesFail = false;
  const send = vi.fn((channel: string, value: unknown) => {
    if (treesFail && channel === IPC.formulaUpdate)
      throw new Error("window gone");
    sent.push({ channel, value });
  });
  const log = vi.fn();
  const p = startPipelines({
    send,
    createWorker: (o) => {
      const worker = new FakeWorker();
      workers.push({
        worker,
        heap: o.resourceLimits?.maxOldGenerationSizeMb ?? 0,
      });
      return worker;
    },
    readFiles: (): Promise<GameBytes> =>
      Promise.resolve({
        code: Uint8Array.from([1]),
        pak: Uint8Array.from([2]),
      }),
    log,
  });
  const workerOf = (heap: number) => {
    const w = workers.find((x) => x.heap === heap)?.worker;
    if (!w) throw new Error("no such worker");
    return w;
  };
  const on = (channel: string) =>
    sent.filter((s) => s.channel === channel).map((s) => s.value);
  return {
    p,
    send,
    failTrees() {
      treesFail = true;
    },
    log,
    on,
    stats: () => workerOf(1024),
    trees: () => workerOf(2048),
    slice(fast: number, pieces: typeof CHARACTER, char = "Invented") {
      p.stats.message({
        type: "state",
        slice: {
          sentinel: { char, map: 5 },
          pieces,
          at: 1,
          cycles: { fast, all: fast },
        },
      });
    },
    /** The game open, a character read and its Stats answered. */
    async showing() {
      p.stats.status(ATTACHED);
      p.stats.reading(reading());
      p.stats.message({ type: "gameFiles", resources: RESOURCES });
      p.formula.gameFiles(RESOURCES);
      this.slice(0, []);
      this.slice(1, [vars, ...CHARACTER]);
      await flush();
      this.stats().emit("message", { type: "ready" });
      this.stats().emit("message", { type: "result", numbers: CALCULATED });
    },
  };
}

test("a tree request goes with the Stats' mosaic and its root reaches the window", async () => {
  const h = setup();
  await h.showing();
  await h.p.handlers[IPC.formulaRequest]?.({ id: "dropRate" });
  await flush();
  h.trees().emit("message", { type: "ready" });
  const [asked] = h.trees().sent("tree");
  expect(asked?.mosaic).toBe(h.stats().calcs()[0]);
  expect(asked?.request).toEqual({
    type: "number",
    id: "dropRate",
    character: 1,
  });

  h.trees().emit("message", {
    type: "treeResult",
    id: asked?.id,
    tree: node({ value: CALCULATED.dropRate }),
  });
  expect(h.on(IPC.formulaUpdate).at(-1)).toMatchObject({
    state: "ready",
    rootText: "6x",
    character: 1,
  });
});

test("a character change reaches the open tree through the Stats", async () => {
  const h = setup();
  await h.showing();
  await h.p.handlers[IPC.formulaRequest]?.({ id: "dropRate" });
  h.p.stats.reading(reading(null));
  expect(h.on(IPC.formulaUpdate).at(-1)).toEqual({ state: "waiting" });
});

test("a tree that fails to reach the window never touches the Stats (FR-017)", async () => {
  const h = setup();
  await h.showing();
  h.failTrees();
  await expect(
    Promise.resolve().then(() =>
      h.p.handlers[IPC.formulaRequest]?.({ id: "dropRate" }),
    ),
  ).rejects.toThrow("window gone");
  h.p.stats.reading(reading("Other"));
  h.slice(2, [], "Other"); // the new character: the tree would go to waiting, and cannot reach the window
  expect(h.on(IPC.statsUpdate).at(-1)).toEqual({ state: "calculating" });
  expect(h.on(IPC.statsUpdate)).not.toContainEqual({ state: "unavailable" });
});

test.each<[string, unknown]>([
  ["no body", undefined],
  ["an id outside the catalog", { id: "notInTheCatalog" }],
])(
  "formula:request with %s is refused before any worker",
  async (_name, payload) => {
    const h = setup();
    await expect(
      Promise.resolve().then(() => h.p.handlers[IPC.formulaRequest]?.(payload)),
    ).rejects.toThrow("formula:request: invalid request");
  },
);

test("formula:close takes no body and closes the tree", async () => {
  const h = setup();
  await expect(
    Promise.resolve().then(() => h.p.handlers[IPC.formulaClose]?.({ x: 1 })),
  ).rejects.toThrow("formula:close: no body expected");
  await h.p.handlers[IPC.formulaClose]?.(undefined);
  expect(h.on(IPC.formulaUpdate).at(-1)).toEqual({ state: "none" });
});

test("formula:values asks the tree worker with the Stats' mosaic, never the Stats worker (SC-004)", async () => {
  const h = setup();
  await h.showing();
  await h.p.handlers[IPC.formulaValues]?.({ ids: ["hp", "str"] });
  await flush();
  h.trees().emit("message", { type: "ready" });
  const [asked] = h.trees().sent("values");
  expect(asked).toMatchObject({
    ids: ["hp", "str"],
    mosaic: h.stats().calcs()[0],
  });
  expect(h.stats().sent("values")).toEqual([]);
  h.trees().emit("message", {
    type: "valuesResult",
    id: asked?.id,
    values: { hp: 3, str: 4 },
  });
  expect(h.on(IPC.formulaLiveValues).at(-1)).toMatchObject({
    values: { hp: 3, str: 4 },
    stale: false,
  });
});

test("formula:values with an id outside the catalog is refused before any worker", async () => {
  const h = setup();
  await expect(
    Promise.resolve().then(() =>
      h.p.handlers[IPC.formulaValues]?.({ ids: ["notInTheCatalog"] }),
    ),
  ).rejects.toThrow("formula:values: invalid ids");
});
