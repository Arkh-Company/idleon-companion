// pieces.cjs `tidy` (spec 008, T022) from the bench at BASELINE-4, the ×1 group aside (rows.ts `timesOne`, applied when
// a level is finished): the rows of a step's terms with the repeats of an earlier value and of a cache read taken out.
import type { RecNode, RecValue } from "../recording.ts";
import type { Expr } from "./steps.ts";
import { topOp } from "./expr.ts";
import { termName } from "./names.ts";
import { near, num } from "./math.ts";
import { callText, row, valueOf } from "./rows.ts";
import type { Row } from "./rows.ts";

/** A constant of the game's code, named by its place. */
export const fixed = (name: string, v: unknown): Row => ({
  node: row({
    pieceKey: null,
    value: valueOf(v as RecValue),
    code: null,
    name,
    leaf: "fixedValue",
    flags: {},
  }),
  open: null,
});

/** pieces.cjs `kids.length` for a row built now: whether it opens into rows. */
export const hasKids = (r: Row) =>
  r.open !== null || (r.group?.length ?? 0) > 0 || r.node.kids === "lazy";

/**
 * pieces.cjs `tidy` (the ×1 group aside): a value from an earlier step that another row already shows, or that is 0
 * outside a product, leaves; one equal to a number the caller passed is that number; a cache read with nothing under
 * it beside another row of the same value leaves.
 */
export function tidy(
  rows: Row[],
  op: string | null,
  args: readonly RecValue[],
  parent?: RecNode,
): Row[] {
  const isEarlier = (r: Row) => !!r.earlier && !hasKids(r);
  const passed = args.filter((x) => typeof x === "number");
  const out = rows
    .filter(
      (r) =>
        !(
          isEarlier(r) &&
          rows.some(
            (o) => o !== r && !isEarlier(o) && near(o.node.value, r.node.value),
          )
        ),
    )
    .filter(
      (r) =>
        !(isEarlier(r) && Math.abs(Number(r.node.value)) < 1e-12 && op !== "*"),
    )
    .map((r): Row => {
      if (!isEarlier(r) || !passed.some((x) => near(x, r.node.value))) return r;
      return fixed(
        `Value passed by the calling block: ${num(r.node.value)}`,
        r.node.value,
      );
    });
  // a row that only repeats its block (the block's name and value, nothing under it) says nothing
  const own = parent && termName(callText(parent));
  return out.filter(
    (r) =>
      !(
        own &&
        r.node.name === own &&
        near(r.node.value, parent.v) &&
        !hasKids(r)
      ) &&
      !(
        (r.node.code ?? "").startsWith("DNSM.") &&
        !hasKids(r) &&
        out.some(
          (o) =>
            o !== r &&
            near(o.node.value, r.node.value) &&
            (hasKids(o) || !(o.node.code ?? "").startsWith("DNSM.")),
        )
      ),
  );
}

/**
 * pieces.cjs `cacheStepRows`: in a step that is no sum nor product (the bench's `!op`, the same top operator as
 * terms.ts `rowsAt`: min, max, pow, a difference, a quotient, one term), the one row with no name, nothing under it and
 * the cache's value says nothing of the cache, and leaves.
 */
export const loneCall = (
  e: Expr,
  rows: Row[],
  value: unknown,
  opens: (r: Row) => boolean,
): Row[] =>
  topOp(e) === null
    ? rows.filter(
        (r) =>
          !(r.node.flags.unnamed && !opens(r) && near(r.node.value, value)),
      )
    : rows;
