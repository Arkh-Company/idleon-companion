// What the app does on each lifecycle event (plan Task 10). Pure: no electron import, so tests can load it.
import type { Settings } from "../shared/index.ts";

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
