// The Pin strip (spec 008 FR-026, FR-031, FR-036, FR-040, FR-041): up to 5 pinned numbers under the status bar, three
// to a line, each with its short name and live value. A value that changed since the player last tapped it is
// highlighted, with the word "changed" beside the color and no announcement; a tap opens its tree. The pins are the
// main's (pins.json), only which numbers, never values.
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_PINS, PINS_FULL } from "../shared/index.ts";
import type { LiveValues, Pin } from "../shared/index.ts";
import { nameOf, valueText } from "./FormulasTab.tsx";
import type { OpenTree } from "./FormulasTab.tsx";

/** The pins, loaded once, and the sentence of the last refusal, failed write or reset, also given to `announce`. */
export function usePins(announce: (text: string) => void): {
  pins: Pin[];
  note: string | null;
  /** Pins a number, or unpins it when it is pinned; a sixth is refused (FR-036). */
  toggle: (id: string) => void;
} {
  const [pins, setPins] = useState<Pin[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const say = useCallback(
    (text: string) => {
      setNote(text);
      announce(text);
    },
    [announce],
  );
  useEffect(() => {
    void window.companion.getPins().then((r) => {
      setPins(r.pins);
      if (r.warning) say(r.warning);
    });
  }, [say]);

  async function save(next: Pin[]): Promise<void> {
    setPins(next);
    setNote(null);
    // A failed write keeps the pins for this session, as the main does.
    const refused = await window.companion.setPins(next);
    if (refused) say(refused);
  }
  function toggle(id: string): void {
    if (pins.some((p) => p.treeId === id))
      void save(pins.filter((p) => p.treeId !== id));
    else if (pins.length >= MAX_PINS) say(PINS_FULL);
    else void save([...pins, { treeId: id, nodeId: null }]);
  }
  return { pins, note, toggle };
}

export function PinStrip({
  pins,
  note,
  live,
  onOpen,
  onUnpin,
  onEmpty,
}: {
  pins: readonly Pin[];
  note: string | null;
  live: LiveValues | null;
  onOpen: OpenTree;
  onUnpin: (id: string) => void;
  /** The last pin went with the focus on it: somewhere else takes the focus (FR-039). */
  onEmpty: () => void;
}) {
  /** Each pin's text when the player last saw it: what differs now is highlighted. */
  const [seen, setSeen] = useState<Readonly<Record<string, string>>>({});
  useEffect(() => {
    setSeen((before) => {
      const next: Record<string, string> = {};
      for (const { treeId } of pins) {
        const v = live?.values[treeId];
        // No value (another character, unavailable): the next one is not a change.
        if (typeof v === "number")
          next[treeId] = before[treeId] ?? valueText(treeId, v);
      }
      return next;
    });
  }, [pins, live]);

  const strip = useRef<HTMLElement>(null);
  /** The place of the pin just unpinned from here: the focus goes to the one taking it. */
  const unpinned = useRef<number | null>(null);
  useEffect(() => {
    const at = unpinned.current;
    if (at === null) return;
    unpinned.current = null;
    const left = strip.current?.querySelectorAll<HTMLElement>(".pin-unpin");
    const next = left?.[Math.min(at, left.length - 1)];
    if (next) next.focus();
    else onEmpty();
  }, [pins, onEmpty]);

  if (pins.length === 0 && !note) return null;
  return (
    <section className="pins" aria-label="Pinned numbers" ref={strip}>
      {pins.length > 0 && (
        <ul>
          {pins.map(({ treeId }, i) => {
            const name = nameOf(treeId);
            const text = valueText(treeId, live?.values[treeId]);
            const was = seen[treeId];
            const changed = was !== undefined && was !== text;
            return (
              <li key={treeId} className={changed ? "pin pin--changed" : "pin"}>
                <button
                  type="button"
                  className="pin-open"
                  onClick={(e) => {
                    setSeen((s) => ({ ...s, [treeId]: text }));
                    onOpen(
                      {
                        label: name,
                        text,
                        trees: [[treeId, name]],
                        id: treeId,
                      },
                      e.currentTarget,
                    );
                  }}
                >
                  <span className="pin-name">{name}</span> {text}
                  {changed && (
                    <>
                      {" "}
                      <span className="pin-changed">changed</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="pin-unpin"
                  aria-label={`Unpin ${name}`}
                  onClick={() => {
                    unpinned.current = i;
                    onUnpin(treeId);
                  }}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {note && <p className="note">{note}</p>}
    </section>
  );
}
