// The settings view (spec §5.5): three checkboxes, each saved at once through the main process.
import { useEffect, useState } from "react";
import type { Settings } from "../shared/index.ts";

const LABELS: Record<keyof Settings, string> = {
  showWindowOnGameStart: "Show window when the game starts",
  closeWithGame: "Close companion when the game closes",
  alwaysOnTop: "Always on top",
};

export function SettingsView() {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    void window.companion.getSettings().then(setSettings);
  }, []);
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
    </fieldset>
  );
}
