// Two passes of pieces.cjs `explainOnce0` (spec 008, T022) from the bench at BASELINE-4: a block that only returns one
// cache shows the cache's own computation, and a block with no step and one check that returns a table cell or 0
// (OPUS4-T2) shows that outcome beside the check. [F2-TOP], the third, is in tree-build.ts, beside the block's rows.
import type { RecNode } from "../recording.ts";
import { near } from "./math.ts";
import { row } from "./rows.ts";
import type { CacheOpen, Row } from "./rows.ts";

/**
 * A block with no row of its own whose data rows all have its value, one of them a cache that opens: that cache's rows
 * (`open`), or null.
 */
export function onlyCache(
  n: RecNode,
  data: readonly Row[],
  open: (o: CacheOpen) => Row[] | null,
): Row[] | null {
  const same = data.filter(
    (x) => Math.abs(Number(x.node.value) - Number(n.v)) < 1e-9,
  );
  if (!same.length || same.length !== data.length) return null;
  for (const x of same)
    if (x.open !== null && typeof x.open !== "number") {
      const rows = open(x.open);
      if (rows?.length) return rows;
    }
  return null;
}

/**
 * OPUS4-T2: the outcome of a block's one check, when the check passed and the block returned a cell of the game's
 * tables it read, or when it failed and the block returned 0; else null.
 */
export function checkOutcome(n: RecNode, conds: readonly Row[]): Row | null {
  const answer = conds[0]?.node.value;
  const cell = (n.r ?? []).find(
    ([p, v]) =>
      p.startsWith("CustomLists.") &&
      typeof v === "string" &&
      v !== "" &&
      near(Number(v), n.v),
  );
  const fixed = (name: string, value: number, code: string | null): Row => ({
    node: row({
      pieceKey: null,
      value,
      code,
      name,
      leaf: "fixedValue",
      flags: {},
    }),
    open: null,
  });
  if (answer === 1 && cell && Number(n.v) !== 0)
    return fixed("Bonus when the check passes", Number(n.v), cell[0]);
  if (answer === 0 && Number(n.v) === 0)
    return fixed("Value when the check fails", 0, null);
  return null;
}
