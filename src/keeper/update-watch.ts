// The update watch (spec §7.2): before the reader attaches, the installed game code is hashed; when it changed since
// the last session, it is scanned for the text a debugger detection would need.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const DETECTION_MARKERS = [
  "debugger",
  "devtools",
  "remote-debugging",
  "isDevToolsOpened",
  "outerWidth",
  "Function.prototype.toString",
];

/** The markers found in the game code: case-sensitive, and `debugger` only as a whole word. */
export function scanGameCode(code: string): string[] {
  return DETECTION_MARKERS.filter((m) =>
    m === "debugger" ? /\bdebugger\b/.test(code) : code.includes(m),
  );
}

function lastHash(statePath: string): string | undefined {
  try {
    const { hash } = JSON.parse(readFileSync(statePath, "utf8")) as {
      hash?: unknown;
    };
    return typeof hash === "string" ? hash : undefined;
  } catch {
    return undefined; // missing or unreadable: the code counts as changed
  }
}

/** Compares the code with the hash of the last session, records the new one, and scans the code when it changed. */
export function checkGameUpdate(
  code: string,
  statePath: string,
): { changed: boolean; hash: string; markers: string[] } {
  const hash = createHash("sha256").update(code).digest("hex");
  const changed = lastHash(statePath) !== hash;
  if (changed) {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify({ hash }));
  }
  return { changed, hash, markers: changed ? scanGameCode(code) : [] };
}

/** The game's N.js inside its app.asar (Electron's fs reads inside .asar, also under ELECTRON_RUN_AS_NODE). */
export function readInstalledGameCode(asarPath: string): string {
  return readFileSync(join(asarPath, "distBuild/static/game/N.js"), "utf8");
}
