// One setup at a time: a second click while one runs gets that one's result.
import type { SetupProgress } from "../../shared/index.ts";
import { oneAtATime } from "../lifecycle.ts";
import { runSetup } from "./setup.ts";
import type { SetupStoreLike, SteamSystem } from "./setup.ts";

export function steamSetupJob(
  sys: SteamSystem,
  store: SetupStoreLike,
  part: string,
  onProgress: (p: SetupProgress) => void,
): () => Promise<SetupProgress> {
  const job = oneAtATime<SetupProgress>();
  return () => job(() => runSetup(sys, store, part, onProgress));
}
