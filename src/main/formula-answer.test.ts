// The clock of the silent rebuilds (spec 009 FR-015, NFR-002): at most one in 10 s since the last tree came, and how long
// a change still waits, so the pipeline can ask the tree when the time is past with no reading coming.
import { expect, test } from "vitest";
import { REBUILD_EVERY_MS, rebuildClock } from "./formula-answer.ts";

function clock() {
  let t = 0;
  const c = rebuildClock(() => t);
  return {
    c,
    at: (ms: number) => {
      t = ms;
    },
  };
}

test("wait: with no change waiting, or the pipeline busy, nothing is waited for", () => {
  const { c } = clock();
  expect(c.wait(true)).toBe(null);
  c.changed(1);
  expect(c.wait(false)).toBe(null);
});

test("wait: a change waiting gives the time left of the 10 s since the last tree came, then 0, as take", () => {
  const { c, at } = clock();
  at(1_000);
  c.came(1);
  c.changed(2);
  at(4_000);
  expect(c.wait(true)).toBe(REBUILD_EVERY_MS - 3_000);
  expect(c.take(true)).toBe(false);
  at(11_000);
  expect(c.wait(true)).toBe(0);
  expect(c.take(true)).toBe(true);
  expect(c.wait(true)).toBe(null);
});

test("wait: a tree asked in silence that failed starts the 10 s again", () => {
  const { c, at } = clock();
  c.changed(1);
  at(5_000);
  c.failed();
  c.changed(2);
  expect(c.wait(true)).toBe(REBUILD_EVERY_MS);
});
