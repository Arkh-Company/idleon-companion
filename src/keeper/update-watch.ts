// The update watch (spec §7.2): before the reader attaches, the installed game code is hashed; when it changed since
// the last session, it is scanned for the text a debugger detection would need.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

/**
 * Compares the code with the hash recorded last, and scans it when it changed. Clean code is recorded at once; code
 * with markers only through recordGameHash, after the user confirms (spec §7.2), so the warning holds until then.
 */
export function checkGameUpdate(
  code: string,
  statePath: string,
): { changed: boolean; hash: string; markers: string[] } {
  const hash = createHash("sha256").update(code).digest("hex");
  if (lastHash(statePath) === hash)
    return { changed: false, hash, markers: [] };
  const markers = scanGameCode(code);
  if (markers.length === 0) recordGameHash(hash, statePath);
  return { changed: true, hash, markers };
}

/** Records the game code the user accepted: the next sessions with the same code read without a warning. */
export function recordGameHash(hash: string, statePath: string): void {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify({ hash }));
}

/**
 * The game's N.js inside its app.asar (Electron's fs reads inside .asar, also under ELECTRON_RUN_AS_NODE).
 * Undefined when there is no app.asar (not the Steam game, e.g. Edge in the tests); throws when app.asar is there but
 * its N.js cannot be read.
 */
export function readInstalledGameCode(asarPath: string): string | undefined {
  if (!existsSync(asarPath)) return undefined;
  return readFileSync(join(asarPath, "distBuild/static/game/N.js"), "utf8");
}
