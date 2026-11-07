// Starts the game with a private debugging pipe (no TCP port): fd 3 carries CDP to it, fd 4 back from it. With
// `debugPipe: false` (a suspicious or uncheckable game code, or a keeper that could not start) the game opens with
// only its own args and no pipe at all.
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import type { Readable, Writable } from "node:stream";
import { createCdp } from "./cdp.ts";
import type { Cdp } from "./cdp.ts";

export function launchGame(
  exe: string,
  args: string[],
  logFile: string,
  { debugPipe = true }: { debugPipe?: boolean } = {},
  spawnImpl: typeof spawn = spawn,
): {
  child: ChildProcess;
  cdp: Cdp | undefined;
  exited: Promise<number | null>;
} {
  let log: number | "ignore" = "ignore";
  try {
    log = openSync(logFile, "w");
  } catch {
    // no game log (the data folder could not be made): the game still starts
  }
  let child: ChildProcess;
  // The keeper runs with ELECTRON_RUN_AS_NODE; the game, an Electron app, would start as plain Node with it.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: "1",
  };
  delete env.ELECTRON_RUN_AS_NODE;
  try {
    // No shell: the exe path and every arg reach the game as they are, spaces and parentheses included.
    child = debugPipe
      ? spawnImpl(exe, [...args, "--remote-debugging-pipe"], {
          stdio: ["ignore", log, log, "pipe", "pipe"],
          env,
        })
      : spawnImpl(exe, args, { stdio: ["ignore", log, log], env });
  } finally {
    if (log !== "ignore") closeSync(log); // the game keeps its own copy of the handle
  }
  const cdp = debugPipe
    ? createCdp(child.stdio[3] as Writable, child.stdio[4] as Readable)
    : undefined;
  const exited = new Promise<number | null>((resolve) => {
    child.once("exit", (code: number | null) => {
      resolve(code);
    });
    // A game that cannot start: no throw out of here, the same as a game that closed.
    child.once("error", () => {
      resolve(null);
    });
  });
  void exited.then(() => {
    cdp?.close();
  });
  return { child, cdp, exited };
}
