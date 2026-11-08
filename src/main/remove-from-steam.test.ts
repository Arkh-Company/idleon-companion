// The uninstaller reads this mode's exit code (contracts/command-line.md; build/installer.nsh).
import { expect, test } from "vitest";
import type { SetupProgress } from "../shared/index.ts";
import { exitCodeFor, exitCodeOf } from "./remove-from-steam.ts";

test.each<[SetupProgress, number]>([
  ["done", 0],
  [{ step: "failed", reason: "game-open" }, 2],
  [{ step: "failed", reason: "steam-did-not-close" }, 3],
  [{ step: "failed", reason: "unreadable-config" }, 4],
  [{ step: "failed", reason: "steam-did-not-open" }, 0], // the option is already clean
])("%o exits with %i", (progress, code) => {
  expect(exitCodeFor(progress)).toBe(code);
});

test("a removal that throws exits with 4, so the uninstaller shows the text to remove", async () => {
  expect(await exitCodeOf(Promise.reject(new Error("disk full")))).toBe(4);
  expect(await exitCodeOf(Promise.resolve("done"))).toBe(0);
});
