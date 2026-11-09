// The check of the Stats pipeline against the game's own StatList (FR-023). Every number and name here is invented.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  piece,
  reading,
  setup,
  statList,
  vars,
} from "./stats-pipeline-fixture.ts";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test("the numbers are checked against the character's StatList", async () => {
  const h = setup();
  await h.showing([vars, statList([900, 22, 33, 44])]);
  const row = (label: string) => {
    const last = h.last();
    return last?.state === "ready"
      ? last.rows.find((r) => r.label === label)?.text
      : undefined;
  };
  expect(row("STR")).toBe("11");

  await vi.advanceTimersByTimeAsync(20_000);
  h.slice([], { fast: 1, all: 1 });
  await vi.advanceTimersByTimeAsync(20_000);
  h.slice([], { fast: 1, all: 1 });
  await vi.advanceTimersByTimeAsync(11_000);
  h.rotation([vars, statList([900, 22, 33, 45]), piece("Cards", 1)]); // a whole character alone is not due
  expect(h.worker().calcs()).toHaveLength(2);
  h.answer();

  expect(row("STR")).toBe("unavailable");
  expect(row("AGI")).toBe("22");
});

test("the check starts over with a new character", async () => {
  const h = setup();
  await h.showing([vars, statList([900, 22, 33, 44])]);
  await vi.advanceTimersByTimeAsync(20_000);
  h.slice([], { fast: 1, all: 1 });
  await vi.advanceTimersByTimeAsync(20_000);
  h.slice([], { fast: 1, all: 1 });

  h.p.reading(reading("Other"));
  h.restartCycles();
  await vi.advanceTimersByTimeAsync(5_000);
  h.rotation([vars, statList([900, 22, 33, 44], "Other")], "Other");
  await h.ready();
  await vi.advanceTimersByTimeAsync(6_000);
  h.answer();

  const last = h.last();
  expect(last?.state === "ready" && last.rows[4]).toEqual({
    label: "STR",
    text: "11",
  });
});
