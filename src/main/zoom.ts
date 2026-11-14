// Text zoom (spec 008 FR-031): the app has no menu, so its zoom keys and Ctrl+wheel are handled here, from 100% to
// 200% in steps of 10%. No electron import, so tests can load it.

const MIN = 1;
const MAX = 2;
const PER_UNIT = 10; // steps per 100%
const STEP = 1 / PER_UNIT;

/** A saved factor within 100%..200%, else 1.0. */
export function zoomFactor(v: unknown): number {
  return typeof v === "number" && v >= MIN && v <= MAX ? v : MIN;
}

/** The part of Electron's `Input` (`before-input-event`) the zoom keys read. */
interface KeyInput {
  type: string;
  key: string;
  control: boolean;
  alt: boolean;
}

/** The window's zoom: `initial` is the saved factor, `save` stores each new one. */
export function zoomControl(
  initial: unknown,
  page: { setZoomFactor(factor: number): void },
  save: (factor: number) => void,
) {
  let factor = zoomFactor(initial);
  const set = (next: number) => {
    // Rounded to the step, so ten steps from 1.0 land on 2.0 and not on 2.0000000000000004.
    const f = Math.min(
      MAX,
      Math.max(MIN, Math.round(next * PER_UNIT) / PER_UNIT),
    );
    if (f === factor) return;
    factor = f;
    page.setZoomFactor(f);
    save(f);
  };
  return {
    factor: () => factor,
    /** Sets the saved factor on the page: on each load, as a reload starts at 100%. */
    apply: () => {
      page.setZoomFactor(factor);
    },
    /** Ctrl+= or Ctrl++ in, Ctrl+- out, Ctrl+0 back to 100%; true when the key was a zoom key (the caller drops it).
     * Ctrl+Alt is AltGr on some layouts, so it is not a zoom key. */
    key: (input: KeyInput): boolean => {
      if (input.type !== "keyDown" || !input.control || input.alt) return false;
      if (input.key === "=" || input.key === "+") set(factor + STEP);
      else if (input.key === "-") set(factor - STEP);
      else if (input.key === "0") set(MIN);
      else return false;
      return true;
    },
    /** Ctrl+wheel, from the page's `zoom-changed` event. */
    wheel: (direction: "in" | "out") => {
      set(direction === "in" ? factor + STEP : factor - STEP);
    },
  };
}
