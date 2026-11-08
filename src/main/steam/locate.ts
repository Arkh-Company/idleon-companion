// Where Steam, its last account and the game are (research R4). The text parsers are pure; `readSteam` gets the
// command runner and the file reads injected, so its tests touch no registry, no Steam and no real process.
import { win32 } from "node:path";
import { findPath, parseVdf } from "./vdf.ts";

/** Legends of Idleon's Steam appid (checked on Vinicius's machine, 07/11). */
export const IDLEON_APP_ID = "1476970";
const STEAMID64_BASE = 76561197960265728n;

/** Runs `file` with `args` directly (execFile, never a shell) and resolves with its stdout; rejects on a failure. */
export type Runner = (file: string, args: readonly string[]) => Promise<string>;
/** Reads a text file; resolves undefined when it does not exist, rejects on any other error. */
export interface FsLike {
  readText(path: string): Promise<string | undefined>;
}

export interface SteamFiles {
  steamPath: string | null;
  /** `name` is PersonaName, for the screen only: never saved nor logged (FR-028). */
  account: { id: string; name: string } | null;
  gameInstalled: boolean;
  /** Where the account's localconfig.vdf is (it may not exist); null without Steam or an account. */
  localConfig: { path: string } | null;
}

/** The account of loginusers.vdf marked `"MostRecent" "1"`: `id` is the 32-bit id of its `userdata` folder. */
export function mostRecentAccount(
  loginusersText: string,
): { id: string; name: string } | null {
  const users = findPath(parseVdf(loginusersText), ["users"])?.children ?? [];
  for (const u of users) {
    if (!/^\d+$/.test(u.key) || findPath(u, ["MostRecent"])?.value !== "1")
      continue;
    const id = BigInt(u.key) - STEAMID64_BASE;
    if (id < 0n) continue;
    return {
      id: id.toString(),
      name: findPath(u, ["PersonaName"])?.value ?? "",
    };
  }
  return null;
}

/** The library folders of libraryfolders.vdf: `"<n>" { "path" "…" }`, or `"<n>" "…"` in the old format. */
export function libraryPaths(libraryfoldersText: string): string[] {
  const folders =
    findPath(parseVdf(libraryfoldersText), ["libraryfolders"])?.children ?? [];
  return folders
    .filter((f) => /^\d+$/.test(f.key))
    .map((f) => f.value ?? findPath(f, ["path"])?.value)
    .filter((p): p is string => p !== undefined);
}

/** `SteamPath` from the output of `reg query HKCU\Software\Valve\Steam /v SteamPath`, with backslashes. */
export function steamPathFromReg(regOutput: string): string | null {
  const m = /^\s*SteamPath\s+REG_\w+\s+(.+?)\s*$/im.exec(regOutput);
  return m?.[1] ? m[1].replaceAll("/", "\\") : null;
}

export const localConfigPath = (steamPath: string, accountId: string) =>
  win32.join(steamPath, "userdata", accountId, "config", "localconfig.vdf");

/** Reads Steam's folder, last account, whether the game is installed and where that account's localconfig.vdf is. Nothing is
 * written. A broken loginusers.vdf or libraryfolders.vdf rejects with VdfShapeError. */
export async function readSteam(run: Runner, fs: FsLike): Promise<SteamFiles> {
  let steamPath: string | null = null;
  try {
    steamPath = steamPathFromReg(
      await run("reg", [
        "query",
        "HKCU\\Software\\Valve\\Steam",
        "/v",
        "SteamPath",
      ]),
    );
  } catch {
    // reg exits 1 when the key or the value is missing: Steam is not installed for this user
  }
  if (!steamPath)
    return {
      steamPath: null,
      account: null,
      gameInstalled: false,
      localConfig: null,
    };

  const loginusers = await fs.readText(
    win32.join(steamPath, "config", "loginusers.vdf"),
  );
  const account =
    loginusers === undefined ? null : mostRecentAccount(loginusers);
  const libraries = await fs.readText(
    win32.join(steamPath, "config", "libraryfolders.vdf"),
  );
  const folders = [
    steamPath,
    ...(libraries === undefined ? [] : libraryPaths(libraries)),
  ];
  const unique = [
    ...new Map(folders.map((f) => [f.toLowerCase(), f])).values(),
  ];
  let gameInstalled = false;
  for (const lib of unique) {
    const manifest = win32.join(
      lib,
      "steamapps",
      `appmanifest_${IDLEON_APP_ID}.acf`,
    );
    if ((await fs.readText(manifest)) !== undefined) {
      gameInstalled = true;
      break;
    }
  }
  if (!account) return { steamPath, account, gameInstalled, localConfig: null };
  return {
    steamPath,
    account,
    gameInstalled,
    localConfig: { path: localConfigPath(steamPath, account.id) },
  };
}
