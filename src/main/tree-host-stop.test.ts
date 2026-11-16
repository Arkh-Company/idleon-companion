// The game closing or new game files with a shape or values in flight (review of the feature, CR4): the job is lost,
// so it answers null as a failure does, and whoever waits for it goes on. The worker is a fake; every value is invented.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { RESOURCES } from "./calculator-host-fixture.ts";
import { answer, mosaic, running } from "./tree-host-fixture.ts";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test.each(["stop", "setFiles"] as const)(
  "%s answers null to the shape in flight",
  async (end) => {
    const t = await running();
    answer(t.worker, 1);
    t.host.shape(7, "hp", mosaic(7));
    if (end === "stop") t.host.stop();
    else t.host.setFiles(RESOURCES);
    expect(t.onShape).toHaveBeenCalledExactlyOnceWith(7, null);
  },
);

test.each(["stop", "setFiles"] as const)(
  "%s answers null to the values in flight",
  async (end) => {
    const t = await running();
    answer(t.worker, 1);
    t.host.values(5, ["hp"], mosaic(5));
    if (end === "stop") t.host.stop();
    else t.host.setFiles(RESOURCES);
    expect(t.onValues).toHaveBeenCalledExactlyOnceWith(5, null);
    expect(t.onUnavailable).not.toHaveBeenCalled();
  },
);
