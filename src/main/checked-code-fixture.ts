// The game code of the pipelines' tests (pipelines-fixture.ts): the version band counts the rules as checked on these
// bytes (FR-018). Alone in its file, with no import of the app, so the `vi.mock` of version-band.ts can load it.
import { createHash } from "node:crypto";

export const CHECKED_CODE = Uint8Array.from([1]);
export const CHECKED_SHA = createHash("sha256")
  .update(CHECKED_CODE)
  .digest("hex");
