// The preload's bridge (src/preload/index.ts): the window's only way to the main process.
import type { CompanionApi } from "../shared/index.ts";

declare global {
  interface Window {
    companion: CompanionApi;
  }
}
