// Where this goes (FR-027) and the patch radar (FR-029, FR-035, FR-041) in the pipelines as the app runs them
// (src/main/index.ts): the tree worker gets the shapes of the catalog in the background, once it read the game's code,
// `feeds:list` answers from them, and a new game version lights the radar. The workers are fakes; every value and name
// is invented.
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { IPC, TREE_CATALOG } from "../shared/index.ts";
import { CHECKED_CODE } from "./checked-code-fixture.ts";
import { node } from "./formula-fixture.ts";
import { setup } from "./pipelines-fixture.ts";
import { savedFiles, SHAPES_RESET } from "./saved-files.ts";
import { CALCULATED, flush } from "./stats-pipeline-fixture.ts";

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

// Where this goes (FR-027): the tree worker gets the shapes of the catalog in the background, once it read the game's
// code, and `feeds:list` answers from them.
test("after the tree, the tree worker is asked a shape over the Stats' mosaic", async () => {
  const h = setup();
  await h.showing();
  await h.p.handlers[IPC.formulaRequest]?.({ id: "dropRate" });
  await flush();
  h.trees().emit("message", { type: "ready" });
  const [asked] = h.trees().sent("tree");
  expect(h.trees().sent("shape")).toEqual([]);
  h.trees().emit("message", {
    type: "treeResult",
    id: asked?.id,
    tree: node({ value: CALCULATED.dropRate }),
  });
  // The open number's live value goes first: a shape waits for every tree and value.
  const [values] = h.trees().sent("values");
  expect(h.trees().sent("shape")).toEqual([]);
  h.trees().emit("message", {
    type: "valuesResult",
    id: values?.id,
    values: {},
  });
  const [shape] = h.trees().sent("shape");
  expect(shape?.mosaic).toBe(h.stats().calcs()[0]);
  expect(shape?.treeId).toBe(TREE_CATALOG.find((n) => !n.live)?.id);
});

test("feeds:list gives the catalog numbers of a piece, from the saved shapes", async () => {
  const saved = savedFiles(mkdtempSync(join(tmpdir(), "feeds-")));
  saved.shapes.save({
    gameSha: "a".repeat(64),
    trees: new Map([
      ["hp", [['["Sword"]', "Game value"]]],
      ["str", [['["Sword"]', "Game value"]]],
    ]),
  });
  const h = setup(CHECKED_CODE, saved);
  expect(
    await h.p.handlers[IPC.feedsList]?.({ pieceKey: '[2,"Sword"]' }),
  ).toEqual(
    TREE_CATALOG.map((n) => n.id).filter((id) => ["hp", "str"].includes(id)),
  );
});

test.each<[string, unknown]>([
  ["no body", undefined],
  ["a key that is no text", { pieceKey: 3 }],
  ["an empty key", { pieceKey: "" }],
  ["a key too long", { pieceKey: "k".repeat(2_001) }],
  ["another field", { pieceKey: "k", id: "hp" }],
])("feeds:list refuses %s", async (_name, payload) => {
  const h = setup();
  await expect(
    Promise.resolve().then(() => h.p.handlers[IPC.feedsList]?.(payload)),
  ).rejects.toThrow("feeds:list: invalid piece");
});

test("a new game version lights the patch radar with the trees whose shape changed, and a new page gets it again until Close (FR-035)", async () => {
  const first = TREE_CATALOG.find((n) => !n.live)?.id ?? "";
  const saved = savedFiles(mkdtempSync(join(tmpdir(), "radar-")));
  // Saved on another game version than the code the tree host reads.
  saved.shapes.save({
    gameSha: "a".repeat(64),
    trees: new Map([[first, [['["Sword"]', "Sword"]]]]),
  });
  const h = setup(CHECKED_CODE, saved);
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
  const [values] = h.trees().sent("values");
  h.trees().emit("message", {
    type: "valuesResult",
    id: values?.id,
    values: {},
  });
  const [shape] = h.trees().sent("shape");
  expect(shape?.treeId).toBe(first);
  expect(h.on(IPC.radarUpdate)).toEqual([]);
  h.trees().emit("message", {
    type: "shapeResult",
    id: shape?.id,
    shape: [
      ['[1,"Sword"]', "Sword"],
      ['[1,"Shield"]', "Shield"],
    ],
  });
  const lit = {
    changed: [
      { catalogId: first, added: ["Shield"], removed: [], renamed: [] },
    ],
    checking: false,
    warning: null,
  };
  expect(h.on(IPC.radarUpdate)).toEqual([lit]);
  h.p.formula.replay();
  expect(h.on(IPC.radarUpdate)).toEqual([lit, lit]);
  // radar:dismiss takes no body; with none, the band goes.
  await expect(
    Promise.resolve().then(() => h.p.handlers[IPC.radarDismiss]?.({ x: 1 })),
  ).rejects.toThrow("radar:dismiss: no body expected");
  expect(h.on(IPC.radarUpdate)).toHaveLength(2);
  await h.p.handlers[IPC.radarDismiss]?.(undefined);
  expect(h.on(IPC.radarUpdate).at(-1)).toBe(null);
});

test("an unreadable shapes file is said on the patch radar to a new page (FR-041)", () => {
  const dir = mkdtempSync(join(tmpdir(), "radar-"));
  writeFileSync(join(dir, "tree-shapes.json"), "{");
  const h = setup(CHECKED_CODE, savedFiles(dir));
  h.p.formula.replay();
  expect(h.on(IPC.radarUpdate)).toEqual([
    { changed: [], checking: false, warning: SHAPES_RESET },
  ]);
});
