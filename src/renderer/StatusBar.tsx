// The status bar (spec §5.6): game, reader, last reading, and the keeper's message. Only the update warning
// (spec §7.2, decided on 07/11) has a button: "Connect next time" records the game code for the next session.
import { useEffect, useState } from "react";
import type { Status } from "../shared/index.ts";

const NOT_LAUNCHED =
  "Live reading needs the game to be launched through Steam with the companion launch option.";
const GAME: Record<Exclude<Status["game"], "not-launched">, string> = {
  running: "Game running",
  closed: "Game closed",
};
const READER: Record<Status["reader"], string> = {
  attached: "Reader attached",
  connecting: "Reader connecting",
  error: "Reader off",
};

export function StatusBar({ status }: { status: Status }) {
  const [now, setNow] = useState(Date.now);
  // The message the user confirmed: a new warning shows its button again.
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  const { message, lastReadingAt } = status;
  const warning = message?.startsWith("The game code changed") === true;
  return (
    <div className="status-bar" role="status">
      {status.game === "not-launched" ? (
        <p>{NOT_LAUNCHED}</p>
      ) : (
        <p>
          <span>{GAME[status.game]}</span>
          {" · "}
          <span>{READER[status.reader]}</span>
          {lastReadingAt !== undefined && (
            <>
              {" · "}
              <span>{`last reading ${String(Math.max(0, Math.floor((now - lastReadingAt) / 1000)))} s ago`}</span>
            </>
          )}
        </p>
      )}
      {message !== undefined && <p className="message">{message}</p>}
      {warning &&
        (confirmedFor === message ? (
          <p>Reading starts next time the game opens.</p>
        ) : (
          <button
            type="button"
            onClick={() => {
              void window.companion.confirmAttach().then(() => {
                setConfirmedFor(message);
              });
            }}
          >
            Connect next time
          </button>
        ))}
    </div>
  );
}
