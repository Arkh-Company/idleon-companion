// Two passes of pieces.cjs `explainOnce0` (spec 008, T022) from the bench at BASELINE-4: a block that only returns one
// cache shows the cache's own computation, and a block with no step and one check that returns a table cell or 0
// (OPUS4-T2) shows that outcome beside the check. [F2-TOP], the third, is in tree-build.ts, beside the block's rows.
import type { RecNode } from "../recording.ts";
import { withWriterFormula } from "./cache-formulas.ts";
import type { Opened } from "./cache-formulas.ts";
import type { Pair } from "./formulas.ts";
import { near } from "./math.ts";
import { WORN_TURN } from "./term-passes.ts";
import { row } from "./rows.ts";
import type { CacheOpen, Row } from "./rows.ts";

/** [NR-G 2b] the cache whose ⓘ (its writer's step) goes up with its rows to the block that only returns it. */
export const OPEN_XF = {
  test: WORN_TURN.test,
  proof: "bench pieces.cjs explainOnce0 NR-G 2b; N.js TotalStats",
};

/**
 * A block with no row of its own whose data rows all have its value, one of them a cache that opens: that cache's rows
 * (`open`) and, for an OPEN_XF cache, its writer's ⓘ for the block; or null.
 */
export function onlyCache(
  n: RecNode,
  data: readonly Row[],
  open: (o: CacheOpen) => Opened | null,
): { rows: Row[]; xf: Pair | null } | null {
  const same = data.filter(
    (x) => Math.abs(Number(x.node.value) - Number(n.v)) < 1e-9,
  );
  if (!same.length || same.length !== data.length) return null;
  for (const x of same)
    if (x.open !== null && typeof x.open !== "number") {
      const got = open(x.open);
      if (got?.rows.length)
        return {
          rows: got.rows,
          xf: x.open.path.startsWith(OPEN_XF.test)
            ? (withWriterFormula(x, got.f).xf ?? null)
            : null,
        };
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
