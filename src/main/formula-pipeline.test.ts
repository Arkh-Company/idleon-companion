// From a tree request of the window to the FormulaTree it gets back: the Stats pair, the parity with the Stats, the
// character change and the game closed (spec 008, T012). The tree host is a fake; every value and name is invented.
import { expect, test } from "vitest";
import {
  mosaicFor,
  node,
  pairOf,
  pipeline as setup,
} from "./formula-fixture.ts";
import { MAX_TREE_NODES } from "./formula-answer.ts";
import { formulaRequestPayload } from "./payloads.ts";
import type { StatsPair } from "./stats-pipeline.ts";
import { CALCULATED } from "./stats-pipeline-fixture.ts";

const DROP = { type: "number", id: "dropRate", character: 0 } as const;

test.each<[string, unknown, unknown]>([
  ["a catalog id", { id: "dropRate" }, { id: "dropRate", character: null }],
  [
    "a catalog id and a character",
    { id: "hp", character: 2 },
    { id: "hp", character: 2 },
  ],
  [
    "an expand",
    { treeId: "dropRate", nodeId: "root/Base" },
    { treeId: "dropRate", nodeId: "root/Base" },
  ],
])("formulaRequestPayload takes %s", (_name, payload, expected) => {
  expect(formulaRequestPayload(payload)).toEqual(expected);
});

test.each<[string, unknown]>([
  ["no object", "dropRate"],
  ["an id outside the catalog", { id: "notInTheCatalog" }],
  ["an id of the object's prototype", { id: "constructor" }],
  ["a character that is text", { id: "dropRate", character: "0" }],
  ["a character that is not whole", { id: "dropRate", character: 1.5 }],
  ["a negative character", { id: "dropRate", character: -1 }],
  ["an unknown key", { id: "dropRate", extra: 1 }],
  ["a __proto__ key", JSON.parse('{"id":"dropRate","__proto__":{"x":1}}')],
  ["both shapes at once", { id: "dropRate", treeId: "t", nodeId: "n" }],
  ["an expand without the node", { treeId: "dropRate" }],
  ["an expand with a long node", { treeId: "t", nodeId: "x".repeat(2_001) }],
])("formulaRequestPayload refuses %s", (_name, payload) => {
  expect(formulaRequestPayload(payload)).toBe(null);
});

test("a request uses the Stats' pair of result and mosaic, never anything newer", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  expect(h.last()).toEqual({ state: "calculating", request: DROP });
  expect(h.host.request).toHaveBeenCalledExactlyOnceWith(
    h.asked(),
    DROP,
    mosaicFor("Invented"),
  );
});

test("a root equal to the Stats is a ready tree, with the Stats' text and time", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  const root = node({ value: CALCULATED.dropRate });
  h.tree(root);
  expect(h.last()).toEqual({
    state: "ready",
    request: DROP,
    title: "Drop Rate",
    rootText: "6x",
    statsValue: CALCULATED.dropRate,
    character: 0,
    activeCharacter: 0,
    calculatedAt: 1_000,
    checkedOnThisGame: true,
    stale: false,
    comparingWith: null,
    counts: { nodes: 1 },
    root,
  });
  expect(h.log).not.toHaveBeenCalled();
});

test("a tree on a game code the rules were not checked on is ready with the band, and its values stay (FR-018)", () => {
  const h = setup(pairOf(), false);
  h.p.request({ id: "dropRate", character: null });
  const root = node({ value: CALCULATED.dropRate });
  h.tree(root);
  expect(h.last()).toMatchObject({
    state: "ready",
    rootText: "6x",
    checkedOnThisGame: false,
    root,
  });
});

test("a root that differs from the Stats is diverged, with a log of label and id only (FR-019)", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  h.tree(node({ value: 999.5, name: "Invented" }));
  expect(h.last()).toEqual({
    state: "diverged",
    request: DROP,
    statsText: "6x",
  });
  expect(h.log).toHaveBeenCalledExactlyOnceWith({
    event: "treeDiverged",
    label: "Drop Rate",
    id: "dropRate",
  });
  expect(JSON.stringify(h.log.mock.calls)).not.toMatch(/999|6|Invented/);
});

test("a tree the check refuses is unavailable, with a log without values or names (FR-010b)", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  h.tree({ ...node({ name: "Invented" }), extra: "function(){}" });
  expect(h.last()).toEqual({ state: "unavailable", request: DROP });
  expect(h.log).toHaveBeenCalledExactlyOnceWith({
    event: "treeRejected",
    id: "dropRate",
  });
});

test("a tree larger than the ceiling is unavailable", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  const kids = Array.from({ length: MAX_TREE_NODES }, (_, i) =>
    node({ id: `root/${String(i)}` }),
  );
  h.tree(node({ value: CALCULATED.dropRate, kids }));
  expect(h.last()).toEqual({ state: "unavailable", request: DROP });
});

test("a request the host could not answer is unavailable", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  h.unavailable();
  expect(h.last()).toEqual({ state: "unavailable", request: DROP });
});

test("a tree the worker failed to build (its mould too) leaves one log line with a label and the id (spec 009, NFR-005)", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  h.unavailable();
  expect(h.log).toHaveBeenCalledExactlyOnceWith({
    event: "treeFailed",
    id: "dropRate",
  });
});

test("a tree whose chain of steps is open is shown, and leaves one log line with a label and the id (spec 009, NFR-005)", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  h.tree(node({ value: CALCULATED.dropRate }), "chainOpen");
  expect(h.last()).toMatchObject({ state: "ready" });
  expect(h.log).toHaveBeenCalledExactlyOnceWith({
    event: "chainOpen",
    id: "dropRate",
  });
});

test("an answer to an older request is dropped", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  const first = h.asked();
  h.p.request({ id: "hp", character: null });
  h.tree(node({ value: CALCULATED.hp }));
  expect(h.last()).toMatchObject({ state: "ready", title: "HP" });
  h.sent.length = 0;
  h.answer(first, node({ value: CALCULATED.dropRate }));
  expect(h.sent).toEqual([]);
});

test.each<[string, StatsPair | null]>([
  ["no reading yet", null],
  [
    "a character not in the game's list",
    { ...pairOf(), mosaicJson: mosaicFor("Nobody") },
  ],
])(
  "%s gives waiting, and the tree is asked once the pair comes (FR-034)",
  (_name, start) => {
    const h = setup(start);
    h.p.request({ id: "dropRate", character: null });
    expect(h.last()).toEqual({ state: "waiting" });
    expect(h.host.request).not.toHaveBeenCalled();
    h.setPair(pairOf());
    expect(h.last()).toEqual({ state: "calculating", request: DROP });
  },
);

test("a character change sends none and asks the new character's tree by itself (FR-021)", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  h.tree(node({ value: CALCULATED.dropRate }));
  h.sent.length = 0;

  h.setPair(null);
  expect(h.host.dropCurrent).toHaveBeenCalled();
  expect(h.last()).toEqual({ state: "waiting" });
  h.p.statsChanged(); // the Stats sends again with no pair: waiting is not sent twice
  h.setPair(pairOf("Other", 2));
  expect(h.sent).toEqual([
    { state: "waiting" },
    { state: "none" },
    { state: "calculating", request: { ...DROP, character: 1 } },
  ]);
  expect(h.host.request).toHaveBeenLastCalledWith(
    h.asked(),
    { ...DROP, character: 1 },
    mosaicFor("Other", 2),
  );
});

test("the old character's answer never shows after a change", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  const old = h.asked();
  h.setPair(pairOf("Other", 2));
  h.sent.length = 0;
  h.answer(old, node({ value: CALCULATED.dropRate }));
  expect(h.sent).toEqual([]);
});

test("a new result of the same character leaves the open tree as it is", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  h.tree(node({ value: CALCULATED.dropRate }));
  const shown = h.last();
  h.setPair(pairOf("Invented", 2));
  expect(h.last()).toEqual(shown);
  expect(h.host.request).toHaveBeenCalledTimes(1);
});

test("another character's tree is asked over the Stats' mosaic, and stays out of parity (FR-020)", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: 1 });
  expect(h.host.request).toHaveBeenCalledExactlyOnceWith(
    h.asked(),
    { ...DROP, character: 1 },
    mosaicFor("Invented"),
  );
  // Not the Stats number: the Stats is the active character's.
  h.tree(node({ value: 999.5 }));
  expect(h.last()).toMatchObject({
    state: "ready",
    character: 1,
    activeCharacter: 0,
  });
  expect(h.log).not.toHaveBeenCalled();
});

test("the game closed keeps the tree, stale, and ends the worker (FR-022)", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  h.tree(node({ value: CALCULATED.dropRate }));
  h.p.status({ game: "closed", reader: "error" });
  expect(h.last()).toMatchObject({ state: "ready", stale: true });
  expect(h.host.stop).toHaveBeenCalledOnce();
  h.p.status({ game: "running", reader: "attached" });
  expect(h.last()).toMatchObject({ state: "ready", stale: false });
});

test("the game closes with the tree calculating: unavailable, and a late answer does not show", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  const asked = h.asked();
  h.p.status({ game: "closed", reader: "error" });
  expect(h.host.stop).toHaveBeenCalledOnce();
  expect(h.last()).toEqual({ state: "unavailable", request: DROP });
  h.sent.length = 0;
  h.answer(asked, node({ value: CALCULATED.dropRate }));
  expect(h.sent).toEqual([]);
});

test("a tree that arrives with the game closed is stale", () => {
  const h = setup();
  h.p.status({ game: "closed", reader: "error" });
  h.p.request({ id: "dropRate", character: null });
  h.tree(node({ value: CALCULATED.dropRate }));
  expect(h.last()).toMatchObject({ state: "ready", stale: true });
});

test("new game files send none and give the host the folder", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  h.p.gameFiles("C:\\invented\\resources");
  expect(h.last()).toEqual({ state: "none" });
  expect(h.host.setFiles).toHaveBeenCalledExactlyOnceWith(
    "C:\\invented\\resources",
  );
});

test("close drops the tree and the replay", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  h.p.close();
  expect(h.last()).toEqual({ state: "none" });
  expect(h.host.dropCurrent).toHaveBeenCalled();
  h.setPair(pairOf("Other", 2));
  expect(h.host.request).toHaveBeenCalledTimes(1);
});

test("replay sends the last tree again", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  const shown = h.last();
  h.sent.length = 0;
  h.p.replay();
  expect(h.sent).toEqual([shown]);
});
