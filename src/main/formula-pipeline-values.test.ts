// The live values in the formula pipeline (spec 008 FR-008, plan B; T031): the window's view plus the open tree, over
// the Stats' mosaic, and the `formula:values` payload checked at the main's edge. The tree host is a fake; every value
// and name is invented.
import { expect, test } from "vitest";
import { TREE_CATALOG } from "../shared/index.ts";
import {
  mosaicFor,
  node,
  pairOf,
  pipeline as setup,
} from "./formula-fixture.ts";
import { formulaValuesPayload } from "./payloads.ts";

const LIVE_ID = TREE_CATALOG.find((n) => n.live)?.id ?? "";

test("the window's view and the open tree are calculated over the Stats' mosaic", () => {
  const h = setup();
  h.p.values(["str"]);
  expect(h.host.values).toHaveBeenLastCalledWith(
    expect.any(Number),
    ["str"],
    mosaicFor("Invented"),
  );
  h.p.request({ id: "dropRate", character: null });
  expect(h.host.values.mock.calls.at(-1)?.[1]).toEqual(["dropRate", "str"]);
  h.p.close();
  expect(h.host.values.mock.calls.at(-1)?.[1]).toEqual(["str"]);
});

test("the pinned numbers stay in view whatever the window shows (FR-026)", () => {
  const h = setup();
  h.p.pinned(["hp"]);
  expect(h.host.values.mock.calls.at(-1)?.[1]).toEqual(["hp"]);
  h.p.values(["str"]);
  expect(h.host.values.mock.calls.at(-1)?.[1]).toEqual(["hp", "str"]);
  h.p.values([]);
  expect(h.host.values.mock.calls.at(-1)?.[1]).toEqual(["hp"]);
  h.p.pinned([]);
  h.p.values(["str"]);
  expect(h.host.values.mock.calls.at(-1)?.[1]).toEqual(["str"]);
});

test("each new pair of the Stats asks again, and the answer reaches the window", () => {
  const h = setup();
  h.p.values(["str"]);
  h.values({ str: 4 });
  expect(h.liveSent.at(-1)).toEqual({
    values: { str: 4 },
    calculatedAt: 1_000,
    stale: false,
  });
  h.setPair(pairOf("Invented", 2));
  expect(h.host.values).toHaveBeenLastCalledWith(
    expect.any(Number),
    ["str"],
    mosaicFor("Invented", 2),
  );
});

test("values ids never mix with the tree requests' ids", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: null });
  h.p.values(["str"]);
  h.values(null);
  expect(h.last()).toMatchObject({ state: "calculating" });
  expect(h.liveSent.at(-1)).toMatchObject({ values: { str: null } });
});

test("a character change clears the values; the game closed keeps them, stale", () => {
  const h = setup();
  h.p.values(["str"]);
  h.values({ str: 4 });
  h.p.status({ game: "closed", reader: "connecting" });
  expect(h.liveSent.at(-1)).toMatchObject({ values: { str: 4 }, stale: true });
  h.setPair(null);
  expect(h.liveSent.at(-1)).toEqual({
    values: {},
    calculatedAt: 0,
    stale: true,
  });
});

test("replay sends the last live values again", () => {
  const h = setup();
  h.p.values(["str"]);
  h.values({ str: 4 });
  h.p.replay();
  expect(h.liveSent).toHaveLength(2);
  expect(h.liveSent[1]).toEqual(h.liveSent[0]);
});

test("a live-game number's tree is asked like any other, and comes ready when its actor was read (US12)", () => {
  const h = setup();
  h.p.request({ id: LIVE_ID, character: null });
  expect(h.last()).toMatchObject({ state: "calculating" });
  h.tree(node({ value: 4 }));
  expect(h.last()).toMatchObject({ state: "ready", rootText: "4" });
});

test("a live-game number whose root came with no value is unavailable: its actor is not on the map (US12)", () => {
  const h = setup();
  h.p.request({ id: LIVE_ID, character: null });
  h.tree(node({ value: null }));
  expect(h.last()).toEqual({
    state: "unavailable",
    request: { type: "number", id: LIVE_ID, character: 0 },
  });
});

test("another number whose root came with no value still shows its tree", () => {
  const h = setup();
  h.p.request({ id: "dropRate", character: 1 });
  h.tree(node({ value: null }));
  expect(h.last()).toMatchObject({ state: "ready", rootText: "unavailable" });
});

test.each<[string, unknown, unknown]>([
  ["catalog ids", { ids: ["hp", "str"] }, { ids: ["hp", "str"] }],
  ["no id", { ids: [] }, { ids: [] }],
  [
    "every id of the catalog",
    { ids: TREE_CATALOG.map((n) => n.id) },
    { ids: TREE_CATALOG.map((n) => n.id) },
  ],
])("formulaValuesPayload takes %s", (_name, payload, expected) => {
  expect(formulaValuesPayload(payload)).toEqual(expected);
});

test.each<[string, unknown]>([
  ["no object", ["hp"]],
  ["no list", { ids: "hp" }],
  ["an id outside the catalog", { ids: ["hp", "notInTheCatalog"] }],
  ["an id of the object's prototype", { ids: ["constructor"] }],
  ["a repeated id", { ids: ["hp", "hp"] }],
  ["an unknown key", { ids: ["hp"], extra: 1 }],
  [
    "more ids than the catalog",
    { ids: [...TREE_CATALOG.map((n) => n.id), "hp"] },
  ],
])("formulaValuesPayload refuses %s", (_name, payload) => {
  expect(formulaValuesPayload(payload)).toBe(null);
});

test("new game files close the tree and take its number out of view", () => {
  const h = setup();
  h.p.values(["str"]);
  h.p.request({ id: "dropRate", character: null });
  h.p.gameFiles("C:/invented");
  expect(h.host.values.mock.calls.at(-1)?.[1]).toEqual(["str"]);
});
