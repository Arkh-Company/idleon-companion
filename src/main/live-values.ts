// The live values of what is in view (spec 008 FR-008, plan B; research R4): the open groups, panels, pins and the open
// tree, recalculated over each new mosaic of the Stats with the tree worker's `values`, never a recording. No electron
// import, so tests can load it.
import { isObject, TREE_CATALOG } from "../shared/index.ts";
import type { LiveValues } from "../shared/index.ts";

/** Numbers that need a map actor's field: unavailable until the actor is read (US12, FR-023). */
const LIVE_GAME = new Set(TREE_CATALOG.filter((n) => n.live).map((n) => n.id));

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
  let calculatedAt = 0;
  let stale = false;
  const values = new Map<string, number | null>();
  let asked: { id: number; ids: string[] } | null = null;
  let seq = 0;
  let last: LiveValues | null = null;

  function show(): void {
    last = { values: Object.fromEntries(values), calculatedAt, stale };
    deps.send(last);
  }

  function ask(): void {
    if (mosaic === null) return;
    const offline = inView.filter(
      (id) => LIVE_GAME.has(id) && values.get(id) !== null,
    );
    for (const id of offline) values.set(id, null);
    if (offline.length > 0) show();
    const ids = inView.filter((id) => !LIVE_GAME.has(id));
    if (ids.length === 0) return;
    asked = { id: ++seq, ids };
    deps.ask(seq, ids, mosaic);
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
        asked = null;
        values.clear();
        show();
        return;
      }
      ask();
    },
    received(id, raw) {
      const ids = asked?.id === id ? asked.ids : null;
      if (!ids) return;
      asked = null;
      for (const key of ids) {
        const v = isObject(raw) && Object.hasOwn(raw, key) ? raw[key] : null;
        values.set(key, typeof v === "number" && Number.isFinite(v) ? v : null);
      }
      show();
    },
    setStale(on) {
      if (on === stale) return;
      stale = on;
      if (last) show();
    },
    replay() {
      if (last) deps.send(last);
    },
  };
}
