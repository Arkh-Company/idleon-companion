// The Stats pipeline with the game closed (FR-022 of 008): the tab keeps the last reading, marked stale, instead of going
// blank, and the last result stays in memory for the trees. These were "a closed game sends none" in
// stats-pipeline.test.ts, changed with Vinicius's approval (13/11). Every number and character name here is invented.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Status } from "../shared/index.ts";
import {
  CALCULATED,
  CALCULATING,
  NONE,
  piece,
  reading,
  setup,
  vars,
} from "./stats-pipeline-fixture.ts";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test.each<[string, Status["reader"]]>([
  ["a closed game", "error"],
  ["a closed game with the reader still attached", "attached"],
])(
  "%s keeps the last numbers, stale, and wipes the mosaic",
  async (_name, reader) => {
    const h = setup();
    await h.showing([vars, piece("Cards", "OLD-VALUE")]);
    const shown = h.last();
    const calculatedAt = Date.now();
    const first = h.worker();
    await vi.advanceTimersByTimeAsync(5_000);

    h.p.status({ game: "closed", reader });
    expect(h.last()).toEqual({ ...shown, stale: true, calculatedAt });
    expect(first.terminated).toBe(1);

    h.open();
    h.restartCycles();
    h.files();
    h.rotation();
    await h.ready();
    expect(h.last()).toEqual(CALCULATING);
    expect(h.worker().calcs().join()).not.toContain("OLD-VALUE");
  },
);

test("a closed game with no number yet sends none", async () => {
  const h = setup();
  h.open();
  h.files();
  h.rotation();
  await h.ready();
  h.p.status({ game: "closed", reader: "error" });
  expect(h.last()).toEqual(NONE);
});

test("a closed game repeated keeps the stale numbers", async () => {
  const h = setup();
  await h.showing();
  h.p.status({ game: "closed", reader: "error" });
  const stale = h.last();
  h.p.status({ game: "closed", reader: "error" });
  expect(h.last()).toEqual(stale);
  expect(stale).toMatchObject({ stale: true });
});

test("a slice of the game open again ends the stale numbers", async () => {
  const h = setup();
  await h.showing();
  h.p.status({ game: "closed", reader: "error" });
  h.open();
  h.slice();
  expect(h.last()).toEqual(CALCULATING);
});

test("no character after the game closed clears the stale numbers", async () => {
  const h = setup();
  await h.showing();
  h.p.status({ game: "closed", reader: "error" });
  h.p.reading(reading(null));
  expect(h.last()).toEqual(NONE);
});

test("the last result and its mosaic stay with the game closed, and go with the character", async () => {
  const h = setup();
  expect(h.p.pair()).toBe(null);
  await h.showing([vars, piece("Cards", "kept")]);
  const pair = h.p.pair();
  expect(pair?.numbers).toEqual(CALCULATED);
  expect(pair?.mosaicJson).toBe(h.worker().calcs()[0]);
  expect(pair?.calculatedAt).toBe(Date.now());

  h.p.status({ game: "closed", reader: "error" });
  expect(h.p.pair()).toEqual(pair);

  h.p.reading(reading(null));
  expect(h.p.pair()).toBe(null);
});

test("a new character drops the last result", async () => {
  const h = setup();
  await h.showing();
  h.p.reading(reading("Other"));
  h.restartCycles();
  h.rotation([vars], "Other");
  expect(h.p.pair()).toBe(null);
});
