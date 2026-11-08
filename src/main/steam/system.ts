// The real SteamSystem (research R4): Windows tools by full path through execFile (never a shell), Steam asked to close
// the normal way (`steam.exe -shutdown`) and started detached, files written through `.tmp` + rename. There is no way
// to kill a process here (FR-010).
import { execFile, spawn } from "node:child_process";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, win32 } from "node:path";
import { promisify } from "node:util";
import { readSteam } from "./locate.ts";
import type { FsLike, Runner } from "./locate.ts";
import type { SteamSystem } from "./setup.ts";

const exec = promisify(execFile);

/** `<SystemRoot>\System32\<name>.exe`: by name alone, Windows would look in the working folder first. */
export function systemTool(
  name: string,
  systemRoot: string | undefined,
): string {
  return win32.join(systemRoot ?? "C:\\Windows", "System32", `${name}.exe`);
}

/** Runs a Windows tool of System32 (`reg`, `tasklist`) by its full path. */
const run: Runner = async (name, args) =>
  (
    await exec(systemTool(name, process.env.SystemRoot), args, {
      windowsHide: true,
      timeout: 10_000,
    })
  ).stdout;

/** The file, or undefined when it does not exist. */
async function readOrUndefined<T>(
  read: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await read();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw e;
  }
}

const fs: FsLike = {
  readText: (path) => readOrUndefined(() => readFile(path, "utf8")),
};

/** Starts `steam.exe` of the Steam folder, detached; resolves once it started, rejects when it could not. */
function launchSteam(steamPath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(win32.join(steamPath, "steam.exe"), args, {
      cwd: steamPath,
      detached: true,
      stdio: "ignore",
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

export const steamSystem: SteamSystem = {
  readSteam: () => readSteam(run, fs),
  isRunning: async (image) => {
    // tasklist lists only the exact image name the filter asks for, or prints a line without it
    const out = await run("tasklist", ["/FI", `IMAGENAME eq ${image}`, "/NH"]);
    return out.toLowerCase().includes(image.toLowerCase());
  },
  shutdownSteam: (steamPath) => launchSteam(steamPath, ["-shutdown"]),
  startSteam: (steamPath) => launchSteam(steamPath, []),
  copyFile: async (from, to) => {
    await mkdir(dirname(to), { recursive: true });
    await copyFile(from, to, constants.COPYFILE_EXCL);
  },
  writeFileAtomic: async (path, text) => {
    const tmp = `${path}.tmp`;
    await writeFile(tmp, text, "utf8");
    await rename(tmp, path);
  },
  readFile: (path) => readOrUndefined(() => readFile(path)),
  now: () => Date.now(),
  sleep: (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
};
