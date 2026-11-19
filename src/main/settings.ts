// settings.json (spec §5.5): a missing or broken file gives the defaults, key by key.
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { DEFAULT_SETTINGS, DEFAULT_VIEW } from "../shared/index.ts";
import type { Settings, ViewPrefs } from "../shared/index.ts";
import { zoomFactor } from "./zoom.ts";

/** The file's object, or {} when it is missing, broken or not an object. */
function read(file: string): Partial<Record<string, unknown>> {
  try {
    const v: unknown = JSON.parse(readFileSync(file, "utf8"));
    return typeof v === "object" && v !== null ? v : {};
  } catch {
    return {};
  }
}

/** Every key the app keeps, each as its loader reads it, with `patch` over them: no save loses another's keys. Written
 * to `.tmp` and renamed over the file (as saved-files.ts), so a failed write never leaves half a file. */
function write(file: string, patch: object): void {
  const v = {
    ...loadSettings(file),
    zoom: loadZoom(file),
    ...loadView(file),
    ...patch,
  };
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  const text = JSON.stringify(v);
  writeFileSync(tmp, text);
  for (let tries = 3; tries > 0; tries--) {
    try {
      renameSync(tmp, file);
      return;
    } catch {
      // Windows: another process holds the file a moment (EPERM, EBUSY)
    }
  }
  // Still held: a direct write keeps the setting, and the main process never gets the error (no caller catches it).
  try {
    writeFileSync(file, text);
    rmSync(tmp, { force: true });
  } catch {
    // this save is lost; the next one tries again
  }
}

/** The user's settings: unknown keys dropped, a key of the wrong type gets its default. */
export function loadSettings(file: string): Settings {
  const s = read(file);
  const pick = (k: keyof Settings) => {
    const x = s[k];
    return typeof x === "boolean" ? x : DEFAULT_SETTINGS[k];
  };
  return {
    showWindowOnGameStart: pick("showWindowOnGameStart"),
    closeWithGame: pick("closeWithGame"),
    alwaysOnTop: pick("alwaysOnTop"),
  };
}

/** Keeps the saved zoom and the tree's toggles, which the window's settings do not carry. */
export function saveSettings(file: string, s: Settings): void {
  write(file, s);
}

/** The window's zoom factor (FR-031): 1.0 when missing or out of 100%..200%. Main-process only, so not in `Settings`. */
export function loadZoom(file: string): number {
  return zoomFactor(read(file).zoom);
}

export function saveZoom(file: string, zoom: number): void {
  write(file, { zoom });
}

/** The tree's toggles (spec 009, contracts/ipc.md): each off when missing or not a boolean; the file is never deleted. */
export function loadView(file: string): ViewPrefs {
  const v = read(file);
  const pick = (k: keyof ViewPrefs) => {
    const x = v[k];
    return typeof x === "boolean" ? x : DEFAULT_VIEW[k];
  };
  return { changes: pick("changes"), share: pick("share") };
}

/** Only the two toggles reach the file (SEC-005). */
export function saveView(file: string, v: ViewPrefs): void {
  write(file, { changes: v.changes, share: v.share });
}
