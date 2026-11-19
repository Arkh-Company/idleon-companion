// The patch radar (spec 008 US10, FR-029, FR-035, FR-041): when the game's version changes, the feeds index hands over
// the shapes of the last version before it clears them, and each tree's new shape, as the background asks bring them, is
// compared with its old one by piece key. While the update is open, `tree-shapes.json` keeps the old trees not compared
// yet, the changes and how many of them the player closed (contracts/saved-files.md), written with the index's shapes:
// a restart goes on comparing and shows the band again until Close. A new change lights a closed band again. The band
// also says once that the shapes file could not be read. No electron import, so tests can load it.
import type { RadarChange, RadarUpdate } from "../shared/index.ts";
import type { savedFiles } from "./saved-files.ts";

type Parts = readonly (readonly [key: string, name: string])[];

/** A scratch box's key as the 0.8.0 kept it, [character, path]; and the [character, path] of a key of now. */
const boxOf = (key: string, length: number): string | null => {
  try {
    const k: unknown = JSON.parse(key);
    return Array.isArray(k) && k.length === length
      ? JSON.stringify(k.slice(0, 2))
      : null;
  } catch {
    return null;
  }
};
/**
 * fix/tree-scratch-keys: a shape of the 0.8.0 kept a scratch box by its path; now a box read at two moments is two
 * pieces ([character, path, writer, write]). The old key is the box's piece when the new shape has only one of that box.
 */
function rematched(before: Parts, after: Parts): Map<string, string> {
  const now = new Set(after.map(([k]) => k));
  const byBox = new Map<string, string[]>();
  for (const [k] of after) {
    const box = boxOf(k, 4);
    if (box) byBox.set(box, [...(byBox.get(box) ?? []), k]);
  }
  const was = new Map(before);
  return new Map(
    before.map(([k, name]) => {
      const box = now.has(k) ? [] : (byBox.get(boxOf(k, 2) ?? "") ?? []);
      const [only] = box;
      return only !== undefined && box.length === 1 && !was.has(only)
        ? [only, name]
        : [k, name];
    }),
  );
}

/** What changed in one tree between two shapes, by piece key, never by order; null when nothing did. */
export function shapeChange(
  catalogId: string,
  before: Parts,
  after: Parts,
): RadarChange | null {
  const was = rematched(before, after);
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
  /** The saved shapes, the same the feeds index fills and writes. */
  shapes: ReturnType<typeof savedFiles>["shapes"];
}): {
  /** A new game version: the last version's shapes (still in `shapes`), before the index clears them. */
  patched(gameSha: string): void;
  /** One tree's shape in the new version. */
  shaped(catalogId: string, parts: Parts): void;
  /** The index has nothing more to ask: an old tree still not compared (a failed ask) never will be. */
  done(): void;
  /** `radar:dismiss`: the band goes until a new change. */
  dismiss(): void;
  /** A new page gets what the band shows. */
  replay(): void;
} {
  /** The warning of a file that could not be read, given once (FR-041). */
  let warning = deps.shapes.warning();
  const saved = () => deps.shapes.get();

  function current(): RadarUpdate {
    const p = saved().patch;
    const lit = p !== undefined && p.changed.length > p.dismissed;
    if (!lit && warning === null) return null;
    return {
      changed: lit ? [...p.changed] : [],
      checking: lit && p.previous.trees.size > 0,
      warning,
    };
  }
  const send = () => {
    deps.send(current());
  };
  /** Everything compared and seen: the update leaves the file at its next write. */
  function settle(): void {
    const s = saved();
    const p = s.patch;
    if (p?.previous.trees.size === 0 && p.changed.length <= p.dismissed)
      delete s.patch;
  }

  return {
    patched(gameSha) {
      const s = saved();
      // ponytail: a new update replaces one still open; its old trees not compared yet are left out.
      s.patch = {
        previous: { gameSha, trees: new Map(s.trees) },
        changed: [],
        dismissed: 0,
      };
    },
    shaped(catalogId, parts) {
      const p = saved().patch;
      const was = p?.previous.trees.get(catalogId);
      if (!p || !was) return;
      p.previous.trees.delete(catalogId);
      const change = shapeChange(catalogId, was, parts);
      if (change) p.changed.push(change);
      settle();
      if (change || p.previous.trees.size === 0) send();
    },
    done() {
      const p = saved().patch;
      if (!p || p.previous.trees.size === 0) return;
      p.previous.trees.clear();
      settle();
      send();
    },
    dismiss() {
      warning = null;
      const s = saved();
      if (s.patch) {
        s.patch.dismissed = s.patch.changed.length;
        settle();
        // Written now: Close holds after a restart. A failed write keeps it for this session.
        deps.shapes.save(s);
      }
      send();
    },
    replay: send,
  };
}
