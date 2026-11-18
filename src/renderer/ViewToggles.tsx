// The tree's two toggles (spec 009 FR-013, FR-014, NFR-004): "Changes" shows each row's arrow, "Share" each row's share.
// Both are buttons with their state (aria-pressed), so the keyboard reaches them and the reader says "pressed" or not.
import type { ViewPrefs } from "../shared/index.ts";

export function ViewToggles({
  view,
  onFlip,
}: {
  view: ViewPrefs;
  onFlip: (k: keyof ViewPrefs) => void;
}) {
  const button = (k: keyof ViewPrefs, label: string) => (
    <button
      type="button"
      aria-pressed={view[k]}
      onClick={() => {
        onFlip(k);
      }}
    >
      {label}
    </button>
  );
  return (
    <div className="view-toggles" role="group" aria-label="View">
      {button("changes", "Changes")}
      {button("share", "Share")}
    </div>
  );
}
