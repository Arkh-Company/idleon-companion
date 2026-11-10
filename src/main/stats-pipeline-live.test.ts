// The Stats pipeline after the first lap: a number for each change (R7). Every number and character name here is invented.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  CALCULATED,
  CALCULATING,
  flush,
  piece,
  setup,
  vars,
} from "./stats-pipeline-fixture.ts";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test("the first number appears only after the first lap", async () => {
  const h = setup();
  h.open();
  h.files();
  h.slice();
  h.slice([vars, piece("Cards", "invented")], { fast: 3, all: 0 });
  await flush();
  expect(h.workers).toEqual([]);
  expect(h.last()).toEqual(CALCULATING);

  h.slice([], { fast: 4, all: 1 });
  await h.ready();
  h.answer();
  expect(h.last()?.state).toBe("ready");
});

test("a changed fast piece reaches the tab with no new rotation", async () => {
  const h = setup();
  await h.showing([vars, piece("Cards", 1)]);

  h.slice([piece("Cards", 2)], { fast: 1, all: 1 });
  await vi.advanceTimersByTimeAsync(60);
  expect(JSON.parse(h.worker().calcs()[1] ?? "")).toMatchObject({
    attrs: { Cards: 2 },
  });

  h.answer({ ...CALCULATED, hp: 30 });
  const last = h.last();
  expect(last?.state === "ready" && last.rows[2]).toEqual({
    label: "HP",
    text: "30",
  });
});
