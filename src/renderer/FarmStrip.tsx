// The farm strip (spec 008 FR-028, FR-031, FR-040): always under the status bar, on every tab. Idle, one short line of
// waiting; while the character farms or the count is paused in a town, two short lines, and "Items" opens the items per
// hour. Only what the main measured. The numbers change with each update, so nothing here is a live region.
import { useState } from "react";
import type { FarmUpdate } from "../shared/index.ts";

const COMPACT = new Intl.NumberFormat("en", { notation: "compact" });

/** A rate as the strip shows it: 1.2M, 48K, 120, 0.5. */
export const perHour = (n: number): string => COMPACT.format(n);

/** "/h" for the eye, "per hour" for a screen reader. */
function Rate({ n }: { n: number }) {
  return (
    <>
      {perHour(n)}
      <span aria-hidden="true">/h</span>
      <span className="sr-only"> per hour</span>
    </>
  );
}

export function FarmStrip({
  farm,
  onFocus,
}: {
  farm: FarmUpdate | null;
  /** Where the focus is, for the window to give it somewhere else when Items goes (FR-039). */
  onFocus: (e: React.FocusEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!farm || farm.state === "idle")
    return (
      <section className="farm" aria-label="Farm">
        <p>Farm: waiting for a map</p>
      </section>
    );
  return (
    <section className="farm" aria-label="Farm" onFocus={onFocus}>
      <p>
        {farm.state === "paused"
          ? `Paused in town · ${String(farm.minutes)} min`
          : `Farming ${String(farm.minutes)} min`}
      </p>
      <p>
        XP <Rate n={farm.xpPerHour} /> · Gold <Rate n={farm.goldPerHour} /> ·{" "}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="farm-items"
          onClick={() => {
            setOpen(!open);
          }}
        >
          Items <span aria-hidden="true">▸</span>
        </button>
      </p>
      {open &&
        (farm.items.length > 0 ? (
          <ul id="farm-items">
            {farm.items.map(({ name, perHour: n }, i) => (
              // Two ids of the game can share a name.
              <li key={`${String(i)} ${name}`}>
                {name} <Rate n={n} />
              </li>
            ))}
          </ul>
        ) : (
          <p id="farm-items">No items yet.</p>
        ))}
    </section>
  );
}
