// The live values of what is in view (FR-008, plan B; research R4): each new mosaic of the Stats recalculates only the
// ids in view, with `values` and never a recording. Every value is invented.
import { expect, test, vi } from "vitest";
import { TREE_CATALOG } from "../shared/index.ts";
import { liveValues } from "./live-values.ts";

const LIVE_ID = TREE_CATALOG.find((n) => n.live)?.id ?? "";
const M1 = '{"n":1}';
const M2 = '{"n":2}';

function setup() {
  const ask = vi.fn<(id: number, ids: string[], mosaic: string) => void>();
  const send = vi.fn();
  const lv = liveValues({ ask, send });
  return { lv, ask, send, last: () => send.mock.calls.at(-1)?.[0] as unknown };
}

test("each new mosaic recalculates only the ids in view, with no recording", () => {
  const t = setup();
  t.lv.setInView(["hp", "dropRate"]);
  expect(t.ask).not.toHaveBeenCalled(); // no reading yet
  t.lv.onMosaic(M1, 1_000);
  expect(t.ask).toHaveBeenCalledExactlyOnceWith(1, ["dropRate", "hp"], M1);
  t.lv.received(1, { dropRate: 2, hp: 3 });
  expect(t.last()).toEqual({
    values: { dropRate: 2, hp: 3 },
    calculatedAt: 1_000,
    stale: false,
  });
  t.lv.onMosaic(M1, 1_000);
  expect(t.ask).toHaveBeenCalledOnce(); // the same mosaic: nothing new
  t.lv.onMosaic(M2, 2_000);
  expect(t.ask).toHaveBeenLastCalledWith(2, ["dropRate", "hp"], M2);
});

test("nothing in view asks nothing", () => {
  const t = setup();
  t.lv.onMosaic(M1, 1_000);
  t.lv.setInView([]);
  expect(t.ask).not.toHaveBeenCalled();
});

test("a new view asks at once over the last mosaic; the same ids in another order do not", () => {
  const t = setup();
  t.lv.onMosaic(M1, 1_000);
  t.lv.setInView(["hp"]);
  expect(t.ask).toHaveBeenCalledExactlyOnceWith(1, ["hp"], M1);
  t.lv.setInView(["hp", "hp"]);
  t.lv.setInView(["str", "hp"]);
  t.lv.setInView(["hp", "str"]);
  expect(t.ask.mock.calls.map((c) => c[1])).toEqual([["hp"], ["hp", "str"]]);
});

test("an earlier ask's answer still shows while a later one is in flight: the host answers in order", () => {
  const t = setup();
  t.lv.setInView(["hp"]);
  t.lv.onMosaic(M1, 1_000);
  t.lv.onMosaic(M2, 2_000); // a batch slower than the mosaics
  t.lv.received(1, { hp: 3 });
  expect(t.last()).toEqual({
    values: { hp: 3 },
    calculatedAt: 1_000,
    stale: false,
  });
  t.lv.received(2, { hp: 4 });
  expect(t.last()).toEqual({
    values: { hp: 4 },
    calculatedAt: 2_000,
    stale: false,
  });
  t.lv.received(1, { hp: 9 }); // already answered
  expect(t.send).toHaveBeenCalledTimes(2);
});

test("an ask the host replaced before answering is forgotten once a later one answers", () => {
  const t = setup();
  t.lv.onMosaic(M1, 1_000);
  t.lv.setInView(["hp"]);
  t.lv.setInView(["str"]);
  t.lv.setInView(["luk"]);
  t.lv.received(3, { luk: 5 });
  t.lv.received(2, { str: 4 });
  expect(t.send).toHaveBeenCalledOnce();
  expect(t.last()).toMatchObject({ values: { luk: 5 } });
});

test("values that failed, or that are no finite number, are unavailable; ids not asked are ignored", () => {
  const t = setup();
  t.lv.onMosaic(M1, 1_000);
  t.lv.setInView(["hp", "str", "luk"]);
  t.lv.received(1, { hp: "3", str: Infinity, other: 1 });
  expect(t.last()).toMatchObject({
    values: { hp: null, str: null, luk: null },
  });
  t.lv.onMosaic(M2, 2_000);
  t.lv.received(2, null);
  expect(t.last()).toMatchObject({
    values: { hp: null, str: null, luk: null },
    calculatedAt: 2_000,
  });
});

test("a live-game number is unavailable without asking the worker (until US12)", () => {
  const t = setup();
  t.lv.onMosaic(M1, 1_000);
  t.lv.setInView([LIVE_ID, "hp"]);
  expect(t.ask).toHaveBeenCalledExactlyOnceWith(1, ["hp"], M1);
  expect(t.last()).toMatchObject({ values: { [LIVE_ID]: null } });
});

test("no reading or another character clears the values, and a late answer is dropped", () => {
  const t = setup();
  t.lv.onMosaic(M1, 1_000);
  t.lv.setInView(["hp"]);
  t.lv.received(1, { hp: 3 });
  t.lv.setInView(["hp", "str"]);
  t.lv.onMosaic(null);
  expect(t.last()).toEqual({ values: {}, calculatedAt: 0, stale: false });
  t.lv.received(2, { hp: 3, str: 4 });
  expect(t.last()).toEqual({ values: {}, calculatedAt: 0, stale: false });
  t.lv.onMosaic(null);
  expect(t.send).toHaveBeenCalledTimes(2);
});

test("the game closed keeps the values, stale, and replay sends the last again", () => {
  const t = setup();
  t.lv.replay();
  expect(t.send).not.toHaveBeenCalled();
  t.lv.onMosaic(M1, 1_000);
  t.lv.setInView(["hp"]);
  t.lv.received(1, { hp: 3 });
  t.lv.setStale(true);
  expect(t.last()).toEqual({
    values: { hp: 3 },
    calculatedAt: 1_000,
    stale: true,
  });
  t.lv.setStale(true);
  t.lv.replay();
  expect(t.send).toHaveBeenCalledTimes(3);
  expect(t.last()).toMatchObject({ stale: true });
});
