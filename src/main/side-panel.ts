// The window that widens for the side panel (spec 008 FR-005): by one window's width, toward the side with room on the
// screen (the right when it fits), and back when the panel closes. Type-only import: tests load it without Electron.
import type { Rectangle } from "electron";
import { sidePanelPayload } from "./payloads.ts";
import { WINDOW_WIDTH } from "./window-options.ts";

interface Resizable {
  getBounds(): Rectangle;
  setBounds(bounds: Partial<Rectangle>): void;
}

export function sidePanelControl(
  win: Resizable,
  workArea: () => Rectangle,
): { set(open: boolean): void } {
  /** How far the window moved left to widen; null while the panel is closed. */
  let shift: number | null = null;
  return {
    set(open) {
      if (open === (shift !== null)) return;
      const b = win.getBounds();
      if (open) {
        const area = workArea();
        const width = b.width + WINDOW_WIDTH;
        const x = Math.max(area.x, Math.min(b.x, area.x + area.width - width));
        shift = b.x - x;
        win.setBounds({ x, width });
      } else {
        // Narrowed by the player while open, the window still keeps one window's width.
        const width = Math.max(WINDOW_WIDTH, b.width - WINDOW_WIDTH);
        win.setBounds({ x: b.x + (shift ?? 0), width });
        shift = null;
      }
    },
  };
}

/** The `window:sidePanel` handler: the body is checked before the window moves. */
export function sidePanelHandler(control: {
  set(open: boolean): void;
}): (payload: unknown) => void {
  return (payload) => {
    const r = sidePanelPayload(payload);
    if (!r) throw new Error("window:sidePanel: invalid request");
    control.set(r.open);
  };
}
