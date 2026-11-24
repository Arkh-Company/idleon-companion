// A line with a link in the draft (spec 010, T200, Open Questions 23/11, night): a part whose reference is the root of
// another blueprint is that number, with a tree of its own; the draft writes `tree: <id>` in place of its descent.
import type { Blueprint } from "./blueprint.ts";
import { refKey } from "./refs.ts";
import type { Ref } from "./refs.ts";

/**
 * The other blueprint whose root is `ref`, by the declared reference, never by the value; none when it is the draft's
 * own, or when two blueprints have that root (the link would be picked by order).
 */
export function linkedTree(
  ref: Ref,
  own: string,
  trees: readonly Pick<Blueprint, "id" | "root">[],
  character: number,
): string | undefined {
  const k = refKey(ref, character);
  const ids = trees.flatMap((b) =>
    b.id !== own && b.root.ref && refKey(b.root.ref, character) === k
      ? [b.id]
      : [],
  );
  return ids.length === 1 ? ids[0] : undefined;
}
