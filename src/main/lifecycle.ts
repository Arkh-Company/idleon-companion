// What the app does on each lifecycle event (plan Task 10). Pure: no electron import, so tests can load it.
import type { Settings, Status } from "../shared/index.ts";

/** What the window shows while no keeper answers on the link. */
export const NOT_CONNECTED: Status = { game: "not-launched", reader: "error" };

/**
 * The status when the link drops: after the game closed the keeper ends and the link with it, and the window keeps
 * "Game closed · last reading N s ago" (spec, Open Questions, 07/11); any other drop means not connected.
 */
export function statusOnLinkDrop(current: Status): Status {
  return current.game === "closed" ? current : NOT_CONNECTED;
}

/**
 * Which event a launch is. The keeper starts the app with `--from-steam`: a Steam launch follows "Show window when
 * the game starts", also in a second instance; only a manual one brings the first window forward (decided on 07/11).
 */
export function launchEvent(
  argv: readonly string[],
  first: boolean,
): LifecycleEvent {
  if (argv.includes("--from-steam")) return "start-from-steam";
  return first ? "start-manual" : "second-instance";
}

export type TrayItem =
  "Show/Hide" | "Let the game close" | "Reconnect" | "Quit";

/** The tray menu in the spec's order (FR-031): the reader's item only when there is a game to let go or read again. */
export function trayItems(status: Status): TrayItem[] {
  if (status.game === "running" && status.reader === "attached")
    return ["Show/Hide", "Let the game close", "Quit"];
  if (status.game === "running" && status.reader === "released")
    return ["Show/Hide", "Reconnect", "Quit"];
  return ["Show/Hide", "Quit"];
}

/** Calls `setMenu` only when the items change: the status repeats every second while reading, and replacing a menu that
 * is open could close it. */
export function trayUpdater(
  setMenu: (items: TrayItem[]) => void,
): (status: Status) => void {
  let shown = "";
  return (status) => {
    const items = trayItems(status);
    if (items.join() === shown) return;
    shown = items.join();
    setMenu(items);
  };
}

/** Runs one job at a time: a call while one runs gets that job's result and starts nothing. */
export function oneAtATime<T>(): (job: () => Promise<T>) => Promise<T> {
  let running: Promise<T> | null = null;
  return (job) => {
    running ??= job().finally(() => {
      running = null;
    });
    return running;
  };
}

const RELOADS_PER_MINUTE = 3;

/**
 * Spec §7.1: a crashed window reloads alone, at most 3 times a minute (`reloads` holds the times of the past ones),
 * and never after a clean exit or once the window is gone.
 */
export function shouldReload(
  reason: string,
  windowAlive: boolean,
  reloads: readonly number[],
  now: number,
): boolean {
  if (!windowAlive || reason === "clean-exit") return false;
  return reloads.filter((t) => now - t < 60_000).length < RELOADS_PER_MINUTE;
}

export type LifecycleEvent =
  | "start-from-steam"
  | "start-manual"
  | "second-instance"
  | "game-exited"
  | "tray-click"
  | "window-close";
export type LifecycleAction =
  "show-window" | "hide-window" | "focus-window" | "quit";

export function decide(
  event: LifecycleEvent,
  s: Settings,
  windowVisible: boolean,
  /** Quit was asked (tray "Quit", the game exiting with closeWithGame, the system shutting down). */
  quitting = false,
): LifecycleAction[] {
  switch (event) {
    case "start-from-steam":
      return s.showWindowOnGameStart ? ["show-window"] : [];
    case "start-manual":
      return ["show-window"];
    case "second-instance":
      return ["focus-window"];
    case "game-exited":
      return s.closeWithGame ? ["quit"] : [];
    case "tray-click":
      return windowVisible ? ["hide-window"] : ["show-window"];
    case "window-close":
      // v1 has no shortcut to reopen the app, so X keeps it alive in the tray (decided on 07/11).
      return quitting ? [] : ["hide-window"];
  }
}
