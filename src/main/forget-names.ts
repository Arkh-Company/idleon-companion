// FR-012: the names the user typed in the previous version are deleted, on every start (research R7).
import { rmSync } from "node:fs";
import { join } from "node:path";

const OLD_NAMES = ["names.json", "names.json.bak", "names.json.bad"];

export function forgetOldNames(dataDir: string): void {
  for (const name of OLD_NAMES) {
    try {
      rmSync(join(dataDir, name), { force: true });
    } catch {
      // A locked file stops nothing: the next start tries again.
    }
  }
}
