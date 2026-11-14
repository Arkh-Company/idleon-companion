// The patch radar (spec 008 US10, FR-029, FR-035, FR-041): when the game's version changes, the feeds index hands over
// the shapes of the last version before it clears them, and each tree's new shape, as the background asks bring them, is
// compared with its old one by piece key. A tree that changed lights the band; Close puts it out until the next patch.
// The band also says once that the shapes file could not be read. No electron import, so tests can load it.
import type { RadarUpdate } from "../shared/index.ts";

type Parts = readonly (readonly [key: string, name: string])[];
type Change = NonNullable<RadarUpdate>["changed"][number];

/** What changed in one tree between two shapes, by piece key, never by order; null when nothing did. */
export function shapeChange(
  catalogId: string,
  before: Parts,
  after: Parts,
): Change | null {
  const was = new Map(before);
  const now = new Map(after);
  const added = [...now].filter(([k]) => !was.has(k)).map(([, n]) => n);
  const removed = [...was].filter(([k]) => !now.has(k)).map(([, n]) => n);
  const renamed = [...now].flatMap(([k, n]): [string, string][] => {
    const old = was.get(k);
    return old !== undefined && old !== n ? [[old, n]] : [];
  });
  return added.length + removed.length + renamed.length > 0
    ? { catalogId, added, removed, renamed }
    : null;
}

export function patchRadar(deps: {
  send: (r: RadarUpdate) => void;
  /** The warning of a shapes file that could not be read, given once (FR-041). */
  warning: string | null;
}): {
  /** A new game version: the last version's shapes, before the index clears them. */
  patched(before: ReadonlyMap<string, Parts>): void;
  /** One tree's shape in the new version. */
  shaped(catalogId: string, parts: Parts): void;
  /** `radar:dismiss`: the band goes until the next patch. */
  dismiss(): void;
  /** A new page gets what the band shows. */
  replay(): void;
} {
  // ponytail: the comparison lives in memory: closed before the background asks end, the trees not asked yet are never
  // compared, and the band does not come back after a restart. Saving the old shapes beside the new would change the
  // file's contract.
  let before = new Map<string, Parts>();
  let changed: Change[] = [];
  let warning = deps.warning;
  let dismissed = false;

  const current = (): RadarUpdate =>
    !dismissed && (changed.length > 0 || warning !== null)
      ? { changed: [...changed], warning }
      : null;
  const send = () => {
    deps.send(current());
  };

  return {
    patched(old) {
      before = new Map(old);
      changed = [];
      dismissed = false;
    },
    shaped(catalogId, parts) {
      const was = before.get(catalogId);
      if (!was) return;
      before.delete(catalogId);
      const change = shapeChange(catalogId, was, parts);
      if (!change) return;
      changed.push(change);
      if (!dismissed) send();
    },
    dismiss() {
      dismissed = true;
      warning = null;
      send();
    },
    replay: send,
  };
}
