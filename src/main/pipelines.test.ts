// The Stats and the trees joined as the app runs them (src/main/index.ts): a tree request uses the mosaic the Stats
// calculated, its root reaches the window, and nothing of the trees reaches the Stats (FR-017, FR-019). The workers are
// fakes; every value and name is invented. Where this goes and the patch radar are in pipelines-feeds.test.ts.
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { IPC, NO_TABLES } from "../shared/index.ts";
import { CHECKED_CODE } from "./checked-code-fixture.ts";
import { node } from "./formula-fixture.ts";
import { answerShape, setup } from "./pipelines-fixture.ts";
import { savedFiles } from "./saved-files.ts";
import { CALCULATED, flush, piece, reading } from "./stats-pipeline-fixture.ts";

vi.mock("./version-band.ts", async (importOriginal) => {
  const real = await importOriginal<typeof import("./version-band.ts")>();
  const { CHECKED_SHA } = await import("./checked-code-fixture.ts");
  return { ...real, versionBand: () => real.versionBand(CHECKED_SHA) };
});

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

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

test.each([
  ["the code the rules were checked on has no band", CHECKED_CODE, true],
  ["another game code has the band", Uint8Array.from([9]), false],
])(
  "the tree's version band comes from the game code the tree host read: %s (FR-018)",
  async (_name, code, checked) => {
    const h = setup(code);
    await h.showing();
    await h.p.handlers[IPC.formulaRequest]?.({ id: "dropRate" });
    await flush();
    h.trees().emit("message", { type: "ready" });
    const [asked] = h.trees().sent("tree");
    h.trees().emit("message", {
      type: "treeResult",
      id: asked?.id,
      tree: node({ value: CALCULATED.dropRate }),
    });
    expect(h.on(IPC.formulaUpdate).at(-1)).toMatchObject({
      state: "ready",
      checkedOnThisGame: checked,
    });
  },
);

test("a character change reaches the open tree and the picker through the Stats, the classes once read; a new page gets the list again", async () => {
  const h = setup();
  await h.showing();
  h.p.formula.tables({ ...NO_TABLES, classes: ["0", "Novice"] });
  h.p.formula.replay();
  await h.p.handlers[IPC.formulaRequest]?.({ id: "dropRate" });
  h.p.stats.reading(reading(null));
  expect(h.on(IPC.formulaUpdate).at(-1)).toEqual({ state: "waiting" });
  const list = { active: 1, classes: [null, "Novice"] };
  expect(h.on(IPC.formulaCharacters)).toMatchObject([{}, list, list, null]);
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

test("the saved pins are in view from the start, and pins:set changes what is in view (FR-026, FR-036)", async () => {
  const saved = savedFiles(mkdtempSync(join(tmpdir(), "pins-")));
  saved.pins.set([{ treeId: "hp", nodeId: null }]);
  const h = setup(CHECKED_CODE, saved);
  await h.showing();
  await flush();
  h.trees().emit("message", { type: "ready" });
  const [first] = h.trees().sent("values");
  expect(first).toMatchObject({ ids: ["hp"] });
  h.trees().emit("message", {
    type: "valuesResult",
    id: first?.id,
    values: { hp: 3 },
  });
  expect(h.on(IPC.formulaLiveValues).at(-1)).toMatchObject({
    values: { hp: 3 },
  });
  await h.p.handlers[IPC.pinsSet]?.([
    { treeId: "hp", nodeId: null },
    { treeId: "str", nodeId: null },
  ]);
  answerShape(h.trees());
  expect(h.trees().sent("values").at(-1)).toMatchObject({ ids: ["hp", "str"] });
  expect(await h.p.handlers[IPC.pinsGet]?.(undefined)).toEqual({
    pins: [
      { treeId: "hp", nodeId: null },
      { treeId: "str", nodeId: null },
    ],
    warning: null,
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

test("each new Stats pair asks the live values again, even when the Stats texts stay the same (FR-008)", async () => {
  const h = setup();
  await h.showing();
  await h.p.handlers[IPC.formulaValues]?.({ ids: ["str"] });
  await flush();
  h.trees().emit("message", { type: "ready" });
  const [first] = h.trees().sent("values");
  h.trees().emit("message", {
    type: "valuesResult",
    id: first?.id,
    values: { str: 4 },
  });
  // Another mosaic of the same character, with the same 11 numbers: the Stats tab has nothing new to show.
  h.slice(2, [piece("Cards", 2)]);
  await vi.advanceTimersByTimeAsync(100); // the Stats host's gap between two calculations
  h.stats().emit("message", { type: "result", numbers: CALCULATED });
  answerShape(h.trees());
  const calcs = h.stats().calcs();
  expect(calcs).toHaveLength(2);
  expect(
    h
      .trees()
      .sent("values")
      .map((m) => m.mosaic),
  ).toEqual(calcs);
});
