// Starts the game with a private debugging pipe (no TCP port): fd 3 carries CDP to it, fd 4 back from it.
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
  spawnImpl: typeof spawn = spawn,
): { child: ChildProcess; cdp: Cdp; exited: Promise<number | null> } {
  const log = openSync(logFile, "w");
  let child: ChildProcess;
  try {
    // No shell: the exe path and every arg reach the game as they are, spaces and parentheses included.
    child = spawnImpl(exe, [...args, "--remote-debugging-pipe"], {
      stdio: ["ignore", log, log, "pipe", "pipe"],
      env: { ...process.env, ELECTRON_ENABLE_LOGGING: "1" },
    });
  } finally {
    closeSync(log); // the game keeps its own copy of the handle
  }
  const cdp = createCdp(child.stdio[3] as Writable, child.stdio[4] as Readable);
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
    cdp.close();
  });
  return { child, cdp, exited };
}
