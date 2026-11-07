// Public API of src/main/steam: src/main/index.ts and remove-from-steam.ts import from here only.
export {
  addPart,
  companionPart,
  hasConsoleScript,
  optionState,
  removePart,
} from "./launch-option.ts";
export { IDLEON_APP_ID, readSteam } from "./locate.ts";
export type { FsLike, Runner, SteamFiles } from "./locate.ts";
export { VdfShapeError, getLaunchOptions, setLaunchOptions } from "./vdf.ts";
