// A box's total beside the entries that make it (deferred A43; spec 009, FR-007, FR-008): a call that starts a working
// value of the game, adds each entry into it and returns it (N.js RoyalG "TotalStatz": the Kingdom stats) has, in the
// 008's rows, the box's read, its start (a read of the same box) and each entry. The total opens into its start and its
// entries, its rows, so none is counted twice; any check stays beside it.
import { isCond, near, vOf } from "./formulas.ts";
import type { Row } from "./rows.ts";

/** The rows of a level of value `v`, a box's total that its start and entries add up to holding them; else as they are. */
export function boxTotal(rows: readonly Row[], v: number): Row[] {
  const parts = rows.filter((r) => !isCond(r));
  const total = parts.find(
    (t) =>
      (t.node.code ?? "").startsWith("DNSM.") &&
      !t.group?.length &&
      near(vOf(t), v) &&
      parts.some((r) => r !== t && r.node.code === t.node.code),
  );
  const entries = parts.filter((r) => r !== total);
  if (
    !total ||
    entries.length < 2 ||
    !near(
      entries.reduce((a, r) => a + vOf(r), 0),
      v,
    )
  )
    return [...rows];
  const box: Row = {
    ...total,
    node: { ...total.node, kids: [] },
    open: null,
    group: entries,
  };
  return [box, ...rows.filter((r) => isCond(r))];
}
