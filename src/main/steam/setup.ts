// The setup flow (FR-005 to FR-010, ADR 0004): what the setup screen shows, and the one click that closes Steam the
// normal way, keeps a copy, adds the companion's part to the launch option and reopens Steam. Every system operation
// is injected (SteamSystem), so the tests touch no Steam, no registry and no process; nothing here can kill a process.
import type { SetupProgress, SteamState } from "../../shared/index.ts";
import { recordSetup } from "../setup-store.ts";
import type { SteamSetupFile } from "../setup-store.ts";
import { addPart, hasConsoleScript, optionState } from "./launch-option.ts";
import { IDLEON_APP_ID } from "./locate.ts";
import type { SteamFiles } from "./locate.ts";
import { getLaunchOptions, setLaunchOptions } from "./vdf.ts";

export const STEAM_IMAGE = "steam.exe";
export const GAME_IMAGE = "LegendsOfIdleon.exe";
const CLOSE_WAIT_MS = 30_000;
const POLL_MS = 500;

/** The system side (src/main/steam/system.ts); there is deliberately no way to kill a process (FR-010). */
export interface SteamSystem {
  readSteam(): Promise<SteamFiles>;
  isRunning(image: string): Promise<boolean>;
  /** `steam.exe -shutdown` from the Steam folder: asks Steam to close the normal way. */
  shutdownSteam(steamPath: string): Promise<void>;
  /** `steam.exe` from the Steam folder, detached; rejects when it cannot be started. */
  startSteam(steamPath: string): Promise<void>;
  /** Never overwrites `to`. */
  copyFile(from: string, to: string): Promise<void>;
  writeFileAtomic(path: string, text: string): Promise<void>;
  /** The file's bytes, or undefined when it does not exist. */
  readFile(path: string): Promise<Buffer | undefined>;
  now(): number;
  sleep(ms: number): Promise<void>;
}

/** steam-setup.json and the folder of the copies, in the companion's data folder. */
export interface SetupStoreLike {
  load(): SteamSetupFile;
  save(s: SteamSetupFile): void;
  backupPath(accountId: string): string;
}

type Reason = Extract<SetupProgress, { step: "failed" }>["reason"];
const failed = (reason: Reason): SetupProgress => ({ step: "failed", reason });

/** The account's current option; throws when the text is missing or the option could not be written safely. */
function currentOption(text: string | undefined): string {
  if (text === undefined) throw new Error("localconfig.vdf not found");
  setLaunchOptions(text, IDLEON_APP_ID, ""); // a dry run: throws VdfShapeError on a shape it cannot edit
  return getLaunchOptions(text, IDLEON_APP_ID) ?? "";
}

const unreadable = (e: unknown) =>
  `Steam's settings could not be read (${e instanceof Error ? e.message : String(e)}). Nothing was changed.`;

/** What the setup screen shows, read from Steam's files now. Nothing is written. */
export async function steamState(
  sys: SteamSystem,
  store: SetupStoreLike,
  part: string,
): Promise<SteamState> {
  const gameOpen = await sys.isRunning(GAME_IMAGE);
  let files: SteamFiles;
  try {
    files = await sys.readSteam();
  } catch (e) {
    // readSteam reads the files only once it found Steam in the registry
    return {
      steam: "found",
      account: null,
      game: "not-installed",
      option: null,
      configured: false,
      gameOpen,
      error: unreadable(e),
      details: null,
    };
  }
  const { account, localConfig } = files;
  const state: SteamState = {
    steam: files.steamPath ? "found" : "not-found",
    account,
    game: files.gameInstalled ? "installed" : "not-installed",
    option: null,
    configured: false,
    gameOpen,
    details:
      account && localConfig
        ? { file: localConfig.path, backup: store.backupPath(account.id) }
        : null,
  };
  if (!localConfig) return state;
  try {
    const current = currentOption(localConfig.text);
    const s = optionState(current, part);
    state.option = {
      current,
      next: addPart(current, part).next,
      state: s,
      consoleScript: hasConsoleScript(current),
    };
    state.configured = s === "companion";
  } catch (e) {
    state.error = unreadable(e);
  }
  return state;
}

/** Waits for Steam to be gone after `-shutdown`, polling up to 30 s; false when it is still running. */
async function closeSteam(
  sys: SteamSystem,
  steamPath: string,
): Promise<boolean> {
  if (!(await sys.isRunning(STEAM_IMAGE))) return true;
  await sys.shutdownSteam(steamPath);
  const deadline = sys.now() + CLOSE_WAIT_MS;
  while (await sys.isRunning(STEAM_IMAGE)) {
    if (sys.now() >= deadline) return false;
    await sys.sleep(POLL_MS);
  }
  return true;
}

interface Target {
  steamPath: string;
  accountId: string;
  file: string;
}

/** With Steam closed: reads the file again (Steam rewrites it when it exits), keeps the first copy, writes only the
 * option and records what was added. False, with nothing written, when the file is missing, is not UTF-8 (its bytes
 * would change) or has a shape that cannot be edited. */
async function writeOption(
  sys: SteamSystem,
  store: SetupStoreLike,
  t: Target,
  part: string,
): Promise<boolean> {
  const bytes = await sys.readFile(t.file);
  if (!bytes) return false;
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) return false;
  let before: string;
  let out: string;
  let inserted: string;
  try {
    before = currentOption(text);
    const added = addPart(before, part);
    inserted = added.inserted;
    out = setLaunchOptions(text, IDLEON_APP_ID, added.next);
  } catch {
    return false;
  }
  if (inserted === "") return true; // the part is there already: nothing to write
  const backupFile = store.backupPath(t.accountId);
  if ((await sys.readFile(backupFile)) === undefined)
    await sys.copyFile(t.file, backupFile);
  await sys.writeFileAtomic(t.file, out);
  store.save(
    recordSetup(store.load(), t.accountId, {
      inserted,
      before,
      backupFile,
      setAt: sys.now(),
    }),
  );
  return true;
}

/** "Close Steam and set up" for the most recent account. Every step goes to `onProgress`, the last one is returned. */
export async function runSetup(
  sys: SteamSystem,
  store: SetupStoreLike,
  part: string,
  onProgress: (p: SetupProgress) => void,
): Promise<SetupProgress> {
  const finish = (p: SetupProgress) => {
    onProgress(p);
    return p;
  };
  let t: Target;
  let current: string;
  try {
    const { steamPath, account, localConfig } = await sys.readSteam();
    // ponytail: no reason of its own: the screen offers no setup button without Steam or an account
    if (!steamPath || !account || !localConfig)
      throw new Error("Steam or its account not found");
    t = { steamPath, accountId: account.id, file: localConfig.path };
    current = currentOption(localConfig.text);
  } catch {
    return finish(failed("unreadable-config"));
  }
  if (optionState(current, part) === "companion") return finish("done");
  if (await sys.isRunning(GAME_IMAGE)) return finish(failed("game-open"));

  onProgress("closing-steam");
  if (!(await closeSteam(sys, t.steamPath)))
    return finish(failed("steam-did-not-close"));
  onProgress("setting-up");
  let written: boolean;
  try {
    written = await writeOption(sys, store, t, part);
  } catch (e) {
    // a failed copy or write: Steam is not left closed
    await sys.startSteam(t.steamPath).catch(() => undefined);
    throw e;
  }
  onProgress("opening-steam");
  const opened = await sys.startSteam(t.steamPath).then(
    () => true,
    () => false,
  );
  if (!written) return finish(failed("unreadable-config"));
  return finish(opened ? "done" : failed("steam-did-not-open"));
}
