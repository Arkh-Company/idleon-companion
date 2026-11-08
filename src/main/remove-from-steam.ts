// The uninstaller's mode (`--remove-from-steam`, contracts/command-line.md; research R6): the removal flow
// with no window and no single-instance lock, reported by the exit code. electron is imported only when the mode runs,
// so the tests can load this file.
import { join } from "node:path";
import type { SetupFailure, SetupProgress } from "../shared/index.ts";
import { setupStoreIn } from "./setup-store.ts";
import { companionPart, runRemove, steamSystem } from "./steam/index.ts";

type ExitCode = 0 | 2 | 3 | 4;

const EXIT: Record<SetupFailure, ExitCode> = {
  "game-open": 2,
  "steam-did-not-close": 3,
  "unreadable-config": 4,
  "steam-did-not-open": 0, // the option is already clean
};

export const exitCodeFor = (p: SetupProgress): ExitCode =>
  typeof p === "string" ? 0 : EXIT[p.reason];

/** A removal that throws (a failed copy or write) is 4: the uninstaller shows the text to remove and goes on. */
export const exitCodeOf = (run: Promise<SetupProgress>): Promise<ExitCode> =>
  run.then(exitCodeFor, () => 4);

export async function removeFromSteam(): Promise<void> {
  const { app } = await import("electron");
  const part = companionPart({
    execPath: process.execPath,
    defaultApp: process.defaultApp, // undefined when packaged, though typed boolean
    appPath: app.getAppPath(),
  });
  const store = setupStoreIn(join(app.getPath("appData"), "IdleOn Companion"));
  app.exit(
    await exitCodeOf(runRemove(steamSystem, store, part, () => undefined)),
  );
}
