// The live values of what is in view (spec 008 FR-008, plan B; research R4): the open groups, panels, pins and the open
// tree, recalculated over each new mosaic of the Stats with the tree worker's `values`, never a recording. No electron
// import, so tests can load it.
import { isObject } from "../shared/index.ts";
import type { LiveValues } from "../shared/index.ts";

export function liveValues(deps: {
  /** The tree host's `values`, with this loop's own count of ids. */
  ask: (id: number, ids: string[], mosaicJson: string) => void;
  send: (v: LiveValues) => void;
}): {
  setInView(ids: string[]): void;
  /** The mosaic of the Stats' pair and its time; null when there is no reading or no character. */
  onMosaic(json: string | null, calculatedAt?: number): void;
  /** The worker's answer to an ask, or null when it failed. */
  received(id: number, values: unknown): void;
  setStale(stale: boolean): void;
  replay(): void;
} {
  let inView: string[] = [];
  let mosaic: string | null = null;
  /** The time of the current mosaic, and of the values shown (an answer can be of an earlier mosaic). */
  let calculatedAt = 0;
  let shownAt = 0;
  let stale = false;
  const values = new Map<string, number | null>();
  /** Every ask not answered yet, since the last clear: the host answers in order, so a slow batch still shows. */
  const asked = new Map<number, { ids: string[]; at: number }>();
  let seq = 0;
  let last: LiveValues | null = null;

  function show(): void {
    last = {
      values: Object.fromEntries(values),
      calculatedAt: shownAt,
      stale,
    };
    deps.send(last);
  }

  function ask(): void {
    if (mosaic === null || inView.length === 0) return;
    asked.set(++seq, { ids: inView, at: calculatedAt });
    deps.ask(seq, inView, mosaic);
  }

  return {
    setInView(ids) {
      const next = [...new Set(ids)].sort();
      if (next.join("\n") === inView.join("\n")) return;
      inView = next;
      ask();
    },
    onMosaic(json, at = 0) {
      if (json === mosaic) return;
      mosaic = json;
      calculatedAt = json === null ? 0 : at;
      if (json === null) {
        // Another character's numbers never stay (FR-034).
        asked.clear();
        values.clear();
        shownAt = 0;
        show();
        return;
      }
      ask();
    },
    received(id, raw) {
      const ask = asked.get(id);
      if (!ask) return;
      // The asks before this one were replaced in the host and will never be answered.
      for (const k of asked.keys()) if (k <= id) asked.delete(k);
      shownAt = ask.at;
      for (const key of ask.ids) {
        const v = isObject(raw) && Object.hasOwn(raw, key) ? raw[key] : null;
        values.set(key, typeof v === "number" && Number.isFinite(v) ? v : null);
      }
      show();
    },
    setStale(on) {
      // The game closed: what was asked never comes with values (the worker ended); the last ones stay on screen.
      if (on) asked.clear();
      if (on === stale) return;
      stale = on;
      if (last) show();
    },
    replay() {
      if (last) deps.send(last);
    },
  };
}
