// Setting up and removing never run together: a second click while one runs gets that one's result.
import type { SetupProgress } from "../../shared/index.ts";
import { oneAtATime } from "../lifecycle.ts";
import { runRemove } from "./remove.ts";
import { runSetup } from "./setup.ts";
import type { SetupStoreLike, SteamSystem } from "./setup.ts";

export function steamJobs(
  sys: SteamSystem,
  store: SetupStoreLike,
  part: string,
  onProgress: (p: SetupProgress) => void,
): { setup(): Promise<SetupProgress>; remove(): Promise<SetupProgress> } {
  const job = oneAtATime<SetupProgress>();
  return {
    setup: () => job(() => runSetup(sys, store, part, onProgress)),
    remove: () => job(() => runRemove(sys, store, part, onProgress)),
  };
}
