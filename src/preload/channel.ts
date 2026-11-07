// One main → window channel of the preload. No electron import (the preload passes `ipcRenderer.on`), so tests load it.

type On = (
  name: string,
  listener: (e: unknown, value: unknown) => void,
) => void;

/** Listens on one channel from the start. With `replay`, it keeps the last value and gives it at once to a subscriber
 * that comes after the main process sent (React effects run after the page loads); without it (`steam:progress`, a
 * step of a flow), a subscriber gets only what comes after it. The returned function unsubscribes. */
export function channel(
  on: On,
  name: string,
  replay: boolean,
): (cb: (value: never) => void) => () => void {
  let last: { value: unknown } | undefined;
  const subscribers = new Set<(value: unknown) => void>();
  on(name, (_e, value) => {
    if (replay) last = { value };
    for (const cb of subscribers) cb(value);
  });
  return (cb) => {
    // The main process sends this channel's type only (IPC.contextUpdate: GameContext, IPC.statusUpdate: Status, …).
    const f = cb as (value: unknown) => void;
    subscribers.add(f);
    if (last) f(last.value);
    return () => {
      subscribers.delete(f);
    };
  };
}
