// The setup screen (FR-005 to FR-011, FR-014, FR-029): what was found in Steam and the one button that sets it up. The
// flow itself runs in the main process (src/main/steam/setup.ts); this only shows its steps.
import { useCallback, useEffect, useState } from "react";
import type { SetupProgress, SteamState } from "../shared/index.ts";

type Reason = Extract<SetupProgress, { step: "failed" }>["reason"];
type Step = Exclude<SetupProgress, "done" | { step: "failed" }>;

const STEP: Record<Step, string> = {
  "closing-steam": "Closing Steam…",
  "setting-up": "Setting up…",
  "opening-steam": "Opening Steam…",
};
const FAILURE: Record<Reason, string | null> = {
  "game-open": null, // the reloaded state disables the button and says it
  "steam-did-not-close": "Steam did not close. Nothing was changed.",
  "unreadable-config":
    "Steam's settings could not be read. Nothing was changed.",
  "steam-did-not-open": "Setup is done. Open Steam yourself.",
};
const ALL_SET = "All set. Press Play in Steam as usual.";

const reasonOf = (p: SetupProgress | null): Reason | null =>
  typeof p === "object" && p !== null ? p.reason : null;
const isFinished = (p: SetupProgress | null) =>
  p === "done" || reasonOf(p) === "steam-did-not-open";

/** The text of a failed call, without the prefix Electron adds to what crosses IPC. */
const errorText = (e: unknown) =>
  (e instanceof Error ? e.message : String(e)).replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    "",
  );

/** What the screen shows when the main process gave no answer: the error, and nothing to paste or to set up. */
export const steamUnknown = (e: unknown): SteamState => ({
  steam: "not-found",
  account: null,
  game: "not-installed",
  option: null,
  configured: false,
  gameOpen: false,
  error: `Steam could not be checked (${errorText(e)}).`,
  details: null,
  manualOption: "",
});

export function SetupView({
  state,
  onReload,
  onFinished,
}: {
  state: SteamState;
  onReload: () => void;
  onFinished: () => void;
}) {
  const [progress, setProgress] = useState<SetupProgress | null>(null);
  // From the click to the first step, which the main process only sends after reading Steam's files.
  const [starting, setStarting] = useState(false);
  const [crash, setCrash] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const show = useCallback(
    (p: SetupProgress) => {
      setProgress(p);
      if (isFinished(p)) onFinished();
    },
    [onFinished],
  );
  useEffect(() => window.companion.onSetupProgress(show), [show]);

  const step =
    typeof progress === "string" && progress !== "done" ? progress : null;
  const busy = starting || step !== null;
  const finished = isFinished(progress);

  // ponytail: reloads on focus, so a click on the window after closing the game wakes the button; poll if that annoys.
  useEffect(() => {
    if (busy || finished) return undefined;
    window.addEventListener("focus", onReload);
    return () => {
      window.removeEventListener("focus", onReload);
    };
  }, [busy, finished, onReload]);

  const reason = reasonOf(progress);
  if (finished)
    return (
      <p role="status">
        {reason === "steam-did-not-open" ? FAILURE[reason] : ALL_SET}
      </p>
    );

  const run = () => {
    setCrash(null);
    setProgress(null);
    setStarting(true);
    void window.companion.setupSteam().then(
      (result) => {
        setStarting(false);
        show(result);
        if (typeof result === "object" && !isFinished(result)) onReload();
      },
      (e: unknown) => {
        // no reload: a save that failed after the write would swap the window and lose this error
        setStarting(false);
        setProgress(null);
        setCrash(`Setup did not finish: ${errorText(e)}`);
      },
    );
  };

  const { error, account, option, details, manualOption } = state;
  const steamFound = state.steam === "found";
  const canSetUp = option !== null && state.game === "installed";
  const alert = crash ?? error ?? (reason && FAILURE[reason]);
  const retry = crash !== null || (reason !== null && reason !== "game-open");
  const pasteNow = error !== undefined && manualOption !== "";
  const detailOption = pasteNow ? "" : (option?.next ?? manualOption);
  const hasDetails =
    detailOption !== "" || account !== null || details !== null;

  return (
    <section className="setup">
      <h2>Set up Steam</h2>
      {steamFound ? (
        <p>Steam found</p>
      ) : (
        error === undefined && <p>Steam not found</p>
      )}
      {account && <p>{`Account: ${account.name}`}</p>}
      {steamFound && !account && error === undefined && (
        <p>Sign in to Steam once, then come back.</p>
      )}
      {state.game === "installed" ? (
        <p>Legends of Idleon found</p>
      ) : (
        steamFound && error === undefined && <p>Legends of Idleon not found</p>
      )}

      {option?.state === "not-set" && <p>Launch option: not set</p>}
      {option?.state === "other" && (
        <>
          <p>Launch option now:</p>
          <p>
            <code>{option.current}</code>
          </p>
          <p>Launch option after setup:</p>
          <p>
            <code>{option.next}</code>
          </p>
          <p>
            The companion only adds to your launch option; nothing is removed.
          </p>
        </>
      )}
      {option?.consoleScript && (
        <p>
          This launch option also runs a console script; the gem store may not
          open.
        </p>
      )}

      {alert && (
        <p className="alert" role="alert">
          {alert}
        </p>
      )}
      {pasteNow && (
        <>
          <p>To set it up by hand, paste this as the game's launch option:</p>
          <p>
            <code>{manualOption}</code>
          </p>
        </>
      )}
      {step && <p role="status">{STEP[step]}</p>}

      {canSetUp && (
        <button type="button" disabled={busy || state.gameOpen} onClick={run}>
          {retry ? "Try again" : "Close Steam and set up"}
        </button>
      )}
      {hasDetails && (
        <button
          type="button"
          disabled={busy}
          aria-expanded={showDetails}
          onClick={() => {
            setShowDetails(!showDetails);
          }}
        >
          Details
        </button>
      )}
      {canSetUp && state.gameOpen && <p>Close the game first</p>}

      {showDetails && (
        <dl>
          {detailOption !== "" && (
            <>
              <dt>
                {canSetUp ? "Launch option" : "Launch option to paste by hand"}
              </dt>
              <dd>
                <code>{detailOption}</code>
              </dd>
            </>
          )}
          {account && (
            <>
              <dt>Account</dt>
              <dd>{account.name}</dd>
            </>
          )}
          {details && (
            <>
              <dt>File that changes</dt>
              <dd>
                <code>{details.file}</code>
              </dd>
              <dt>Copy kept at</dt>
              <dd>
                <code>{details.backup}</code>
              </dd>
            </>
          )}
        </dl>
      )}
    </section>
  );
}
