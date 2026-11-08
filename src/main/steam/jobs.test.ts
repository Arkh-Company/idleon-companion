// The lock over setting up and removing, on fake system operations.
import { expect, test } from "vitest";
import type { SetupProgress } from "../../shared/index.ts";
import { AFTER, BACKUP, BEFORE, FILE, PART, setup } from "./fake-system.ts";
import { steamJobs } from "./jobs.ts";
import { getLaunchOptions } from "./vdf.ts";

const GAME = "1476970";

test("setting up and removing at once: one shutdown, and the second gets the first's result", async () => {
  // A record, so the removal alone would close Steam too.
  const s = setup({
    records: {
      accounts: {
        "102": { inserted: PART, before: "", backupFile: BACKUP, setAt: 1 },
      },
    },
  });
  const progress: SetupProgress[] = [];
  const jobs = steamJobs(s.sys, s.store, PART, (p) => progress.push(p));

  const results = await Promise.all([jobs.setup(), jobs.remove()]);

  expect(results).toEqual(["done", "done"]);
  expect(s.calls.filter((c) => c.startsWith("shutdown"))).toHaveLength(1);
  expect(progress).toContain("closing-steam");
});

test("setup and remove are each their own flow, one after the other", async () => {
  const s = setup();
  const jobs = steamJobs(s.sys, s.store, PART, () => undefined);
  const option = () =>
    getLaunchOptions(s.w.disk.get(FILE)?.toString("utf8") ?? "", GAME);

  expect(await jobs.setup()).toBe("done");
  expect(option()).toBe(AFTER);
  expect(await jobs.remove()).toBe("done");
  expect(option()).toBe(BEFORE);
});
