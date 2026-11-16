// The patch radar's band (spec 008 FR-029, FR-031, FR-035, FR-041): at the top, under the status bar, on every tab, after
// a game update changed the shape of some trees, "so far" while old trees are still compared. "Show" lists each of them
// with up to 5 named changes; Close puts the band out until a new change. It also carries the warning of a shapes file that could not be read. Plain text, no
// live region: the window says the warning once.
import { useState } from "react";
import type { RadarChange, RadarUpdate } from "../shared/index.ts";
import { nameOf } from "./FormulasTab.tsx";

/** How many named changes each tree shows; the rest is a count. */
const SHOWN = 5;

const plural = (n: number, one: string, many: string) =>
  `${String(n)} ${n === 1 ? one : many}`;

/** Each change of a tree as words: parts new, parts gone, then names changed. */
const changesOf = (c: RadarChange): string[] => [
  ...c.added.map((n) => `New: ${n}`),
  ...c.removed.map((n) => `Gone: ${n}`),
  ...c.renamed.map(([was, now]) => `Renamed: ${was}, now ${now}`),
];

export function PatchBand({
  radar,
  onClose,
  onFocus,
}: {
  /** The window shows the band only with an update: a band that comes back starts closed. */
  radar: NonNullable<RadarUpdate>;
  onClose: () => void;
  /** Where the focus is, for the window to give it somewhere else when the band goes (FR-039). */
  onFocus: (e: React.FocusEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  const trees = radar.changed.length;
  return (
    <section className="band patch" aria-label="Game update" onFocus={onFocus}>
      {radar.warning && <p>{radar.warning}</p>}
      {trees > 0 && (
        <p>
          Game updated: {plural(trees, "tree", "trees")} changed
          {radar.checking && " so far"} <span aria-hidden="true">·</span>{" "}
          <button
            type="button"
            aria-expanded={open}
            aria-controls="patch-trees"
            aria-label="Show what changed"
            onClick={() => {
              setOpen(!open);
            }}
          >
            Show
          </button>
        </p>
      )}
      {open && trees > 0 && (
        <ul id="patch-trees">
          {radar.changed.map((c) => {
            const all = changesOf(c);
            return (
              <li key={c.catalogId}>
                <span>{nameOf(c.catalogId)}</span>
                <ul>
                  {all.slice(0, SHOWN).map((text, i) => (
                    // Two parts can share a name.
                    <li key={`${String(i)} ${text}`}>{text}</li>
                  ))}
                  {all.length > SHOWN && (
                    <li>
                      {plural(
                        all.length - SHOWN,
                        "more change",
                        "more changes",
                      )}
                    </li>
                  )}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        aria-label="Close the game update"
        onClick={onClose}
      >
        Close
      </button>
    </section>
  );
}
