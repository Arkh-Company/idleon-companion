// The first level of a tree (spec 008, FR-006; spec Open Questions, the shape of the Drop Rate mould): the game's steps
// of the root's block, in the game's order, as the assembly gives them (tree-build.ts), each with its bonus's name, and
// never a name by its shape such as "Fixed +2" (the bench's V1 page, build-v1mold.cjs, is not this shape: no pools, no
// system buckets). A step with no proven name says so: the generic name and `unnamed` (FR-012a).
import { CONSTANT_NAME } from "./formulas.ts";
import { GENERIC_NAME } from "./rows.ts";
import type { Row } from "./rows.ts";

const GROUPS = new Set(["atZero", "atOne"]);

/**
 * The root's rows as its steps: a step named by its shape loses that name. The rows of its groups at 0 and at ×1 are
 * steps too; a branch's own rows are its parts, with their names by shape for its ⓘ.
 */
export function mould(rows: readonly Row[]): Row[] {
  return rows.map((r) => {
    const own = CONSTANT_NAME.test(r.node.name)
      ? {
          ...r,
          node: {
            ...r.node,
            name: GENERIC_NAME,
            flags: { ...r.node.flags, unnamed: true },
          },
        }
      : r;
    return own.group && GROUPS.has(own.node.role)
      ? { ...own, group: mould(own.group) }
      : own;
  });
}
