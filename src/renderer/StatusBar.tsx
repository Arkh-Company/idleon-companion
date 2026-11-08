// The status bar (spec §5.6): game, reader, last reading, and the keeper's message. Its buttons: "Connect next time" on
// the update warning (spec §7.2, decided on 07/11), and "Let the game close" / "Reconnect" (002, US2).
import { useEffect, useState } from "react";
import type { Status } from "../shared/index.ts";

const NOT_LAUNCHED =
  "Live reading needs the game to be launched through Steam with the companion launch option.";
const GAME: Record<Exclude<Status["game"], "not-launched">, string> = {
  running: "Game running",
  closed: "Game closed",
};
// A game update stops the reader until the game reopens: "Reconnect" would do nothing (spec, Open Questions, 08/11).
const GAME_UPDATED = "Game updated: the reader needs an update";
const READER: Record<Status["reader"], string> = {
  attached: "Reader attached",
  connecting: "Reader connecting",
  error: "Reader off",
  released: "Reader off",
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
  const running = status.game === "running";
  const attached = running && status.reader === "attached";
  const released = running && status.reader === "released";
  // A reconnect that fails keeps "Reconnect" (spec, Edge Cases), until reading is back or the game closes.
  const [afterRelease, setAfterRelease] = useState(false);
  if (released && !afterRelease) setAfterRelease(true);
  if (afterRelease && (attached || !running)) setAfterRelease(false);
  const canReconnect =
    message !== GAME_UPDATED &&
    (released || (afterRelease && status.reader === "error"));
  return (
    <div className="status-bar" role="status">
      {status.game === "not-launched" ? (
        <p>{NOT_LAUNCHED}</p>
      ) : (
        <p>
          <span>{GAME[status.game]}</span>
          {" · "}
          <span>{READER[status.reader]}</span>
          {released && (
            <>
              {" · "}
              <span>You can close the game now</span>
            </>
          )}
          {lastReadingAt !== undefined && (
            <>
              {" · "}
              <span>{`last reading ${String(Math.max(0, Math.floor((now - lastReadingAt) / 1000)))} s ago`}</span>
            </>
          )}
        </p>
      )}
      {message !== undefined && <p className="message">{message}</p>}
      {attached && (
        <>
          <p>To close the game, press Let the game close first.</p>
          <button
            type="button"
            onClick={() => {
              void window.companion.releaseGame();
            }}
          >
            Let the game close
          </button>
        </>
      )}
      {canReconnect && (
        <button
          type="button"
          onClick={() => {
            void window.companion.reconnect();
          }}
        >
          Reconnect
        </button>
      )}
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
