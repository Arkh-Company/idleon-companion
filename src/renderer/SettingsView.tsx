// The settings view (spec §5.5): three checkboxes, each saved at once through the main process, and "Set up Steam"
// (FR-014, FR-029). Undoing the setup is the uninstaller's alone (FR-013).
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Settings, SteamState, UpdateState } from "../shared/index.ts";
import { errorText } from "./SetupView.tsx";

const LABELS: Record<keyof Settings, string> = {
  showWindowOnGameStart: "Show window when the game starts",
  closeWithGame: "Close companion when the game closes",
  alwaysOnTop: "Always on top",
};

export function SteamSettings({
  onReload,
  onSteam,
}: {
  /** Reads Steam's state again. */
  onReload: () => void;
  /** Steam's state just read, with the last account not set up: the window opens the setup screen. */
  onSteam: (s: SteamState) => void;
}) {
  const [line, setLine] = useState<string | null>(null);

  // The same reload as the setup screen: a click on the window after signing in to another account shows that screen.
  useEffect(() => {
    window.addEventListener("focus", onReload);
    return () => {
      window.removeEventListener("focus", onReload);
    };
  }, [onReload]);

  const setUp = () => {
    setLine(null);
    void window.companion.steamState().then(
      (s) => {
        if (s.configured && s.account)
          setLine(`Steam is already set up for ${s.account.name}`);
        else onSteam(s);
      },
      (e: unknown) => {
        setLine(`Steam could not be checked: ${errorText(e)}`);
      },
    );
  };

  return (
    <div className="steam-settings">
      <button type="button" onClick={setUp}>
        Set up Steam
      </button>
      {line && <p role="status">{line}</p>}
    </div>
  );
}

export function SettingsView({ children }: { children?: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    void window.companion.getSettings().then(setSettings);
  }, []);
  const [update, setUpdate] = useState<UpdateState | null>(null);
  useEffect(() => window.companion.onUpdate(setUpdate), []);
  if (!settings) return null;

  return (
    <fieldset className="settings">
      <legend>Settings</legend>
      {(Object.keys(LABELS) as (keyof Settings)[]).map((key) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={settings[key]}
            onChange={(e) => {
              const next = { ...settings, [key]: e.target.checked };
              setSettings(next);
              void window.companion.setSettings(next);
            }}
          />
          {LABELS[key]}
        </label>
      ))}
      {children}
      {update?.state === "check-failed" && <p>Could not check for updates</p>}
    </fieldset>
  );
}
