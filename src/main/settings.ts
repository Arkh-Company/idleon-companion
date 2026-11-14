// settings.json (spec §5.5): a missing or broken file gives the defaults, key by key.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DEFAULT_SETTINGS } from "../shared/index.ts";
import type { Settings } from "../shared/index.ts";
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

function write(file: string, v: object): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(v));
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

/** Keeps the saved zoom, which the window's settings do not carry. */
export function saveSettings(file: string, s: Settings): void {
  write(file, { ...s, zoom: loadZoom(file) });
}

/** The window's zoom factor (FR-031): 1.0 when missing or out of 100%..200%. Main-process only, so not in `Settings`. */
export function loadZoom(file: string): number {
  return zoomFactor(read(file).zoom);
}

export function saveZoom(file: string, zoom: number): void {
  write(file, { ...loadSettings(file), zoom });
}
