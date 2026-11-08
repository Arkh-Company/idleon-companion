// The update watch (spec §7.2): before the reader attaches, the installed game code is hashed; when it changed since
// the last session, it is scanned for the text a debugger detection would need.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

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
 * Compares the code with the hash recorded last, and scans it when it changed. Writes nothing: the keeper records
 * clean code at once, and code with markers only after the user confirms (spec §7.2), so the warning holds until then.
 */
export function checkGameUpdate(
  code: string,
  statePath: string,
): { changed: boolean; hash: string; markers: string[] } {
  const hash = createHash("sha256").update(code).digest("hex");
  if (lastHash(statePath) === hash)
    return { changed: false, hash, markers: [] };
  return { changed: true, hash, markers: scanGameCode(code) };
}

/** Records the game code the user accepted: the next sessions with the same code read without a warning. */
export function recordGameHash(hash: string, statePath: string): void {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify({ hash }));
}

const N_JS = "distBuild/static/game/N.js";
/** The Steam game's exe: without game code next to it, it is never launched with the pipe. */
const GAME_EXE = "legendsofidleon.exe";
const isMissing = (e: unknown) =>
  (e as NodeJS.ErrnoException).code === "ENOENT";

/**
 * The installed game's N.js, next to the exe: inside `resources\app.asar` (Electron's fs, which the keeper has in
 * Electron's main process, reads inside .asar) or, without it, in the unpacked `resources\app\`. Undefined when neither
 * is there and the exe is not the game's (e.g. Edge in the tests); throws when the game's exe has neither, or when one
 * is there but cannot be read.
 */
export function readInstalledGameCode(exe: string): string | undefined {
  const resources = join(dirname(exe), "resources");
  // ponytail: not existsSync — under Electron's asar-aware fs it says false for an app.asar that is there but cannot be
  // opened (corrupt, locked), which would skip the check and launch with the pipe. The resources folder is not an asar
  // path, so its native listing answers whether the file exists; any other listing error fails closed.
  let names: string[] = [];
  try {
    names = readdirSync(resources);
  } catch (e) {
    if (!isMissing(e)) throw e;
  }
  if (names.includes("app.asar"))
    return readFileSync(join(resources, "app.asar", N_JS), "utf8");
  try {
    return readFileSync(join(resources, "app", N_JS), "utf8");
  } catch (e) {
    if (!isMissing(e)) throw e;
  }
  if (basename(exe).toLowerCase() === GAME_EXE)
    throw new Error(`no game code to check next to ${exe}`);
  return undefined;
}
