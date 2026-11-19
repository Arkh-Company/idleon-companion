// A file of the app's data folder written whole (settings.json and the saved files): to `.tmp` and renamed over the
// file, so a failed write of `.tmp` never leaves half a file. On Windows another process can hold the file a moment
// (EPERM, EBUSY): the rename is tried again, and then the file is written directly, the only write that is not atomic.
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Throws when `.tmp` cannot be written, the file left as it was; false when the direct write is refused too. */
export function replaceFile(file: string, text: string): boolean {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, text);
  for (let tries = 3; tries > 0; tries--) {
    try {
      renameSync(tmp, file);
      return true;
    } catch {
      // Windows: another process holds the file a moment (EPERM, EBUSY)
    }
  }
  try {
    writeFileSync(file, text);
    rmSync(tmp, { force: true });
    return true;
  } catch {
    return false;
  }
}
