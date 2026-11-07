// Fake system operations and an in-memory store for the setup tests: no Steam, no registry, no process, no file.
import { readFileSync } from "node:fs";
import { join, win32 } from "node:path";
import type { SetupProgress } from "../../shared/index.ts";
import type { SteamSetupFile } from "../setup-store.ts";
import type { SteamFiles } from "./locate.ts";
import { runSetup } from "./setup.ts";
import type { SetupStoreLike, SteamSystem } from "./setup.ts";

export const LOCALCONFIG = readFileSync(
  join(import.meta.dirname, "fixtures", "localconfig.vdf"),
);
export const STEAM = "C:\\Steam";
export const FILE = win32.join(
  STEAM,
  "userdata",
  "102",
  "config",
  "localconfig.vdf",
);
export const BACKUP = "C:\\Data\\steam-backup\\102-localconfig.vdf";
export const PART = '"C:\\Apps\\IdleOn Companion.exe" --keeper ';
export const BEFORE = '"C:\\Tools\\fps.exe" %command% -windowed';
export const AFTER = `"C:\\Tools\\fps.exe" ${PART}%command% -windowed`;
export const esc = (s: string) =>
  s.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

export interface World {
  /** What readSteam gives; its localConfig text is read from `disk` at each call. */
  files: SteamFiles | Error;
  disk: Map<string, Buffer>;
  running: Set<string>;
  /** Steam exits this long after `-shutdown` (Infinity: never). */
  closesAfterMs: number;
  onShutdown?: () => void;
  startFails?: boolean;
  copyFails?: boolean;
}

export const steamFiles = (): SteamFiles => ({
  steamPath: STEAM,
  account: { id: "102", name: "Test Two" },
  gameInstalled: true,
  localConfig: { path: FILE, text: undefined },
});

export function setup(o: Partial<World> = {}) {
  const w: World = {
    files: steamFiles(),
    disk: new Map([[FILE, LOCALCONFIG]]),
    running: new Set(["steam.exe"]),
    closesAfterMs: 2000,
    ...o,
  };
  const calls: string[] = [];
  let time = 1_000_000;
  let closeAt = Infinity;
  const steamUp = () => w.running.has("steam.exe") && time < closeAt;
  const sys: SteamSystem = {
    readSteam: () => {
      calls.push("readSteam");
      if (w.files instanceof Error) return Promise.reject(w.files);
      const f = w.files;
      const lc = f.localConfig && {
        path: f.localConfig.path,
        text: w.disk.get(f.localConfig.path)?.toString("utf8"),
      };
      return Promise.resolve({ ...f, localConfig: lc });
    },
    isRunning: (image) =>
      Promise.resolve(image === "steam.exe" ? steamUp() : w.running.has(image)),
    shutdownSteam: (steamPath) => {
      calls.push(`shutdown ${steamPath}`);
      closeAt = time + w.closesAfterMs;
      w.onShutdown?.();
      return Promise.resolve();
    },
    startSteam: (steamPath) => {
      calls.push(`start ${steamPath}`);
      return w.startFails
        ? Promise.reject(new Error("spawn failed"))
        : Promise.resolve();
    },
    copyFile: (from, to) => {
      if (w.copyFails) return Promise.reject(new Error("disk full"));
      if (steamUp()) throw new Error("copy with Steam open");
      calls.push(`copy ${from} ${to}`);
      const b = w.disk.get(from);
      if (!b) throw new Error("no file");
      w.disk.set(to, b);
      return Promise.resolve();
    },
    writeFileAtomic: (path, text) => {
      if (steamUp()) throw new Error("write with Steam open");
      calls.push(`write ${path}`);
      w.disk.set(path, Buffer.from(text, "utf8"));
      return Promise.resolve();
    },
    readFile: (path) => Promise.resolve(w.disk.get(path)),
    now: () => time,
    sleep: (ms) => {
      time += ms;
      return Promise.resolve();
    },
  };
  let saved: SteamSetupFile = { accounts: {} };
  const store: SetupStoreLike = {
    load: () => saved,
    save: (s) => {
      calls.push("save");
      saved = s;
    },
    backupPath: (id) => `C:\\Data\\steam-backup\\${id}-localconfig.vdf`,
  };
  const progress: SetupProgress[] = [];
  const run = () =>
    runSetup(sys, store, PART, (p) => {
      progress.push(p);
    });
  return {
    w,
    sys,
    store,
    calls,
    progress,
    run,
    time: () => time,
    saved: () => saved,
    /** Calls that change something: Steam's state or a file. */
    changes: () => calls.filter((c) => c !== "readSteam"),
  };
}
