// The open rows of the tree view. Every part shows in its place, in the game's order (spec 009, FR-016: no "Small" and
// no "Show all N parts").

/** The set with `key` added, or removed when it was there. */
export function flip(s: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(s);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
