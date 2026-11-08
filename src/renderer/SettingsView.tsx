// The settings view (spec §5.5): three checkboxes, each saved at once through the main process, and "Set up Steam" and
// "Remove from Steam" (FR-012, FR-014, FR-029). The removal itself runs in the main process (src/main/steam/remove.ts).
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type {
  SetupFailure,
  SetupProgress,
  Settings,
  SteamState,
  UpdateState,
} from "../shared/index.ts";
import { errorText } from "./SetupView.tsx";

const LABELS: Record<keyof Settings, string> = {
  showWindowOnGameStart: "Show window when the game starts",
  closeWithGame: "Close companion when the game closes",
  alwaysOnTop: "Always on top",
};

type Step = Exclude<SetupProgress, "done" | { step: "failed" }>;

const STEP: Record<Step, string> = {
  "closing-steam": "Closing Steam…",
  "setting-up": "Removing…",
  "opening-steam": "Opening Steam…",
};
const DONE = "Removed from Steam.";
const REMOVAL_FAILURE: Record<Exclude<SetupFailure, "game-open">, string> = {
  "steam-did-not-close": "Steam did not close. Nothing was changed.",
  "unreadable-config":
    "Some of Steam's settings could not be read. Those accounts were not changed.",
  "steam-did-not-open": "Removed from Steam. Open Steam yourself.",
};

export function SteamSettings({
  gameOpen,
  onReload,
  onSteam,
  onRemoveStart,
}: {
  gameOpen: boolean;
  /** Reads Steam's state again. */
  onReload: () => void;
  /** Steam's state just read, with the last account not set up: the window opens the setup screen. */
  onSteam: (s: SteamState) => void;
  onRemoveStart: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  const [line, setLine] = useState<string | null>(null);

  useEffect(
    () =>
      window.companion.onSetupProgress((p) => {
        if (typeof p === "string" && p !== "done") setStep(p);
      }),
    [],
  );
  // The same reload as the setup screen: a click on the window after closing the game wakes the button.
  useEffect(() => {
    if (removing) return undefined;
    window.addEventListener("focus", onReload);
    return () => {
      window.removeEventListener("focus", onReload);
    };
  }, [removing, onReload]);

  const setUp = () => {
    setLine(null);
    setAsking(false);
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

  const remove = () => {
    setAsking(false);
    setStep(null);
    setRemoving(true);
    onRemoveStart();
    void window.companion
      .removeFromSteam()
      .then(
        (result) => {
          if (typeof result !== "object") setLine(DONE);
          else if (result.reason === "game-open") onReload();
          else setLine(REMOVAL_FAILURE[result.reason]);
        },
        (e: unknown) => {
          setLine(`Remove did not finish: ${errorText(e)}`);
        },
      )
      .finally(() => {
        setRemoving(false);
      });
  };

  return (
    <div className="steam-settings">
      <button type="button" disabled={removing} onClick={setUp}>
        Set up Steam
      </button>
      <button
        type="button"
        disabled={removing || gameOpen}
        onClick={() => {
          setLine(null);
          setAsking(true);
        }}
      >
        Remove from Steam
      </button>
      {gameOpen && <p>Close the game first</p>}
      {asking && (
        <>
          <p>
            Steam will close to remove the companion from the launch option of
            Legends of Idleon. Continue?
          </p>
          <button type="button" disabled={gameOpen} onClick={remove}>
            Close Steam and remove
          </button>
          <button
            type="button"
            onClick={() => {
              setAsking(false);
            }}
          >
            Cancel
          </button>
        </>
      )}
      {removing && step && <p role="status">{STEP[step]}</p>}
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
