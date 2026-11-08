// The lock over setting up, on fake system operations.
import { expect, test } from "vitest";
import type { SetupProgress } from "../../shared/index.ts";
import { PART, setup } from "./fake-system.ts";
import { steamSetupJob } from "./jobs.ts";

test("two setups at once: one shutdown, and the second gets the first's result", async () => {
  const s = setup();
  const progress: SetupProgress[] = [];
  const setUp = steamSetupJob(s.sys, s.store, PART, (p) => progress.push(p));

  const results = await Promise.all([setUp(), setUp()]);

  expect(results).toEqual(["done", "done"]);
  expect(s.calls.filter((c) => c.startsWith("shutdown"))).toHaveLength(1);
  expect(progress).toContain("closing-steam");
});
