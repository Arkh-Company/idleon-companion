// What the app does on each lifecycle event (plan Task 10). Pure: no electron import, so tests can load it.
import type { Settings } from "../shared/index.ts";

export type LifecycleEvent =
  | "start-from-steam"
  | "start-manual"
  | "second-instance"
  | "game-exited"
  | "tray-click";
export type LifecycleAction =
  "show-window" | "hide-window" | "focus-window" | "quit";

export function decide(
  event: LifecycleEvent,
  s: Settings,
  windowVisible: boolean,
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
  }
}
