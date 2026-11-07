// settings.json (spec §5.5): a missing or broken file gives the defaults, key by key.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DEFAULT_SETTINGS } from "../shared/index.ts";
import type { Settings } from "../shared/index.ts";

/** The user's settings: unknown keys dropped, a key of the wrong type gets its default. */
export function loadSettings(file: string): Settings {
  let v: unknown;
  try {
    v = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  const s: Partial<Record<keyof Settings, unknown>> =
    typeof v === "object" && v !== null ? v : {};
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

export function saveSettings(file: string, s: Settings): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(s));
}
